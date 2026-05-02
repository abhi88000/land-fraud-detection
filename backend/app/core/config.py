from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "LandGuard API"
    API_V1_STR: str = "/api/v1"

    # Google Cloud Project ID
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "trust-trailblazers")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")

    # Firestore settings
    FIRESTORE_COLLECTION_DOCUMENTS: str = "documents"
    FIRESTORE_COLLECTION_ANALYSIS_REPORTS: str = "analysis_reports"

    # Google Cloud Storage settings
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "land-guard-docs-trust-trailblazers")

    # Redis / Memorystore
    REDIS_HOST: str = os.getenv("REDIS_HOST", "")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_ENABLED: bool = os.getenv("REDIS_ENABLED", "false").lower() == "true"

    # Pub/Sub
    PUBSUB_TOPIC_ANALYSIS: str = os.getenv("PUBSUB_TOPIC_ANALYSIS", "land-guard-analysis-jobs")
    PUBSUB_SUBSCRIPTION_ANALYSIS: str = os.getenv("PUBSUB_SUBSCRIPTION_ANALYSIS", "land-guard-analysis-sub")
    PUBSUB_ENABLED: bool = os.getenv("PUBSUB_ENABLED", "false").lower() == "true"

    # BigQuery
    BIGQUERY_DATASET: str = os.getenv("BIGQUERY_DATASET", "land_guard_analytics")
    BIGQUERY_TABLE_FRAUD: str = "fraud_patterns"
    BIGQUERY_TABLE_ANALYSIS: str = "analysis_events"
    BIGQUERY_ENABLED: bool = os.getenv("BIGQUERY_ENABLED", "false").lower() == "true"

    # Vertex AI
    VERTEX_EMBEDDING_MODEL: str = "text-embedding-005"

    # Security settings (for OAuth 2.0 / Firebase Auth)
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "trust-trailblazers")

    # ADK/Agent settings
    ADK_AGENT_SERVICE_ACCOUNT: str = os.getenv("ADK_AGENT_SERVICE_ACCOUNT", "sa-trust-trailblazers@trust-trailblazers.iam.gserviceaccount.com")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
