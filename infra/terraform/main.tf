provider "google" {
  project = var.project_id
  region  = var.region
}

# --- Artifact Registry ---
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "land-guard"
  description   = "Docker repository for LandGuard"
  format        = "DOCKER"
}

# --- Cloud Storage ---
resource "google_storage_bucket" "documents" {
  name                        = "land-guard-docs-${var.project_id}"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
}

# --- Firestore ---
resource "google_firestore_database" "database" {
  name        = "(default)"
  location_id = "nam5" # Multi-region for reliability
  type        = "FIRESTORE_NATIVE"
}

# --- Memorystore (Redis) for caching ---
resource "google_redis_instance" "cache" {
  name           = "land-guard-cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  redis_version = "REDIS_7_0"

  authorized_network = "projects/${var.project_id}/global/networks/default"

  labels = {
    app = "land-guard"
  }
}

# --- Pub/Sub Topic for async analysis jobs ---
resource "google_pubsub_topic" "analysis_jobs" {
  name = "land-guard-analysis-jobs"

  message_retention_duration = "86400s" # 24 hours
}

resource "google_pubsub_subscription" "analysis_sub" {
  name  = "land-guard-analysis-sub"
  topic = google_pubsub_topic.analysis_jobs.id

  ack_deadline_seconds = 600 # 10 minutes for long analysis

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_topic" "dead_letter" {
  name = "land-guard-dead-letter"
}

# --- BigQuery Dataset & Tables ---
resource "google_bigquery_dataset" "analytics" {
  dataset_id = "land_guard_analytics"
  location   = var.region

  labels = {
    app = "land-guard"
  }
}

resource "google_bigquery_table" "analysis_events" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "analysis_events"

  schema = jsonencode([
    { name = "document_id", type = "STRING", mode = "REQUIRED" },
    { name = "user_id", type = "STRING", mode = "NULLABLE" },
    { name = "file_name", type = "STRING", mode = "NULLABLE" },
    { name = "state", type = "STRING", mode = "NULLABLE" },
    { name = "district", type = "STRING", mode = "NULLABLE" },
    { name = "risk_score", type = "FLOAT", mode = "NULLABLE" },
    { name = "document_type", type = "STRING", mode = "NULLABLE" },
    { name = "fraud_count", type = "INTEGER", mode = "NULLABLE" },
    { name = "legal_issues_count", type = "INTEGER", mode = "NULLABLE" },
    { name = "analysis_duration_ms", type = "INTEGER", mode = "NULLABLE" },
    { name = "cached_ocr", type = "BOOLEAN", mode = "NULLABLE" },
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "fraud_patterns" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "fraud_patterns"

  schema = jsonencode([
    { name = "document_id", type = "STRING", mode = "REQUIRED" },
    { name = "user_id", type = "STRING", mode = "NULLABLE" },
    { name = "fraud_type", type = "STRING", mode = "REQUIRED" },
    { name = "severity", type = "STRING", mode = "NULLABLE" },
    { name = "state", type = "STRING", mode = "NULLABLE" },
    { name = "district", type = "STRING", mode = "NULLABLE" },
    { name = "party_names", type = "STRING", mode = "REPEATED" },
    { name = "property_survey_numbers", type = "STRING", mode = "REPEATED" },
    { name = "evidence", type = "STRING", mode = "NULLABLE" },
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# --- Secret Manager ---
resource "google_secret_manager_secret" "firebase_config" {
  secret_id = "land-guard-firebase-config"

  replication {
    auto {}
  }
}

# --- Cloud Run Backend (API) ---
resource "google_cloud_run_v2_service" "backend" {
  name     = "land-guard-api"
  location = var.region

  template {
    scaling {
      max_instance_count = 10
      min_instance_count = 0
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder - deployed via gcloud
      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }
      env {
        name  = "REDIS_PORT"
        value = "6379"
      }
      env {
        name  = "REDIS_ENABLED"
        value = "true"
      }
      env {
        name  = "PUBSUB_ENABLED"
        value = "true"
      }
      env {
        name  = "BIGQUERY_ENABLED"
        value = "true"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
    }

    vpc_access {
      network_interfaces {
        network = "default"
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
  }
}

# --- Cloud Run Frontend (Web) ---
resource "google_cloud_run_v2_service" "frontend" {
  name     = "land-guard-web"
  location = var.region

  template {
    scaling {
      max_instance_count = 5
      min_instance_count = 0
    }
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder
      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
    }
  }
}

# --- IAM Bindings for Public Access ---
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Service Account Roles for GCP services ---
resource "google_project_iam_member" "sa_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:sa-trust-trailblazers@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "sa_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:sa-trust-trailblazers@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "sa_secretmanager" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:sa-trust-trailblazers@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "sa_vertexai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:sa-trust-trailblazers@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "sa_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:sa-trust-trailblazers@${var.project_id}.iam.gserviceaccount.com"
}
