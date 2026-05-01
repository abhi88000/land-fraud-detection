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

    # ADK/Agent settings (placeholders)
    ADK_AGENT_SERVICE_ACCOUNT: str = os.getenv("ADK_AGENT_SERVICE_ACCOUNT", "your-adk-agent-sa@your-gcp-project-id.iam.gserviceaccount.com")

    # Security settings (for OAuth 2.0 / Firebase Auth)
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "trust-trailblazers")
    # Add other Firebase/OAuth related settings as needed, e.g., for JWT decoding keys

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
