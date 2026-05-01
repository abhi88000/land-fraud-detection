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
