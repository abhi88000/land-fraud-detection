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

# --- Cloud Run Backend (API) ---
resource "google_cloud_run_v2_service" "backend" {
  name     = "land-guard-api"
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
