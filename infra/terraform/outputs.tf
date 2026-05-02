output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "gcs_bucket_name" {
  value = google_storage_bucket.documents.name
}

output "firestore_db_name" {
  value = google_firestore_database.database.name
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "redis_port" {
  value = google_redis_instance.cache.port
}

output "pubsub_topic" {
  value = google_pubsub_topic.analysis_jobs.name
}

output "bigquery_dataset" {
  value = google_bigquery_dataset.analytics.dataset_id
}
