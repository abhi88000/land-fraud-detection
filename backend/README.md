# Landshield Backend

This is the backend component of the Landshield platform, an AI-powered system designed to detect fraud in Indian land transactions. It is built to be robust, scalable, and secure, leveraging Google Cloud services and a multi-agent architecture.

---

## Table of Contents

-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Prerequisites](#prerequisites)
-   [Google Cloud Setup](#google-cloud-setup)
    -   [Project and APIs](#project-and-apis)
    -   [Service Accounts & IAM](#service-accounts--iam)
    -   [Firebase Authentication](#firebase-authentication)
    -   [Cloud Storage Bucket](#cloud-storage-bucket)
    -   [Firestore Database](#firestore-database)
-   [Local Development Setup](#local-development-setup)
    -   [Clone Repository](#clone-repository)
    -   [Virtual Environment & Dependencies](#virtual-environment--dependencies)
    -   [Environment Variables (`.env`)](#environment-variables-env)
    -   [Running Locally](#running-locally)
-   [API Endpoints](#api-endpoints)
-   [Deployment (Google Cloud Run)](#deployment-google-cloud-run)
-   [Testing](#testing)
-   [Project Structure](#project-structure)

---

## Features

*   **Document Upload & Management:** Securely upload land documents (PDF, images) to Google Cloud Storage.
*   **Multi-Agent Orchestration:** Utilizes a Google ADK-powered multi-agent system for document analysis:
    *   **Document Parser Agent:** OCR, entity extraction (party names, property details, dates, etc.) using Gemini Vision.
    *   **Legal Rules Agent:** Checks compliance against Indian land laws (e.g., Transfer of Property Act, Registration Act, state-specific rules).
    *   **Fraud Detection Agent:** Identifies discrepancies like name mismatches, broken ownership chains, and suspicious patterns.
    *   **Report Generator Agent:** Compiles findings into a comprehensive analysis report with a risk score and verification checklist.
*   **Real-time Analysis Streaming:** Server-Sent Events (SSE) provide live updates on analysis progress to the frontend.
*   **Secure Authentication:** Integrates with Firebase Authentication (OAuth 2.0) for user management and document access control.
*   **Scalable Backend:** Built with FastAPI and designed for deployment on Google Cloud Run.
*   **Persistent Storage:** Uses Google Firestore for storing document metadata, analysis reports, and agent events.

## Tech Stack

*   **Language:** Python 3.11+
*   **Web Framework:** FastAPI
*   **Asynchronous Operations:** `asyncio`
*   **Data Validation:** Pydantic
*   **Google Cloud Services:**
    *   **Firestore:** NoSQL database for document metadata, reports, and events.
    *   **Cloud Storage (GCS):** Secure storage for uploaded land documents.
    *   **Identity Platform (Firebase Auth):** User authentication and authorization.
    *   **Vertex AI Gemini:** For multimodal document analysis (via the Document Parser Agent).
*   **Agent Framework:** Google Agent Development Kit (ADK)
*   **Real-time Communication:** Server-Sent Events (SSE) via `sse-starlette`

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Python:** Version 3.11 or higher.
*   **Docker:** (Optional, for containerization and local testing of Docker builds)
*   **Google Cloud SDK (`gcloud` CLI):** For authenticating with Google Cloud and managing resources.
*   **An IDE:** (e.g., VS Code) with Python and FastAPI extensions recommended.

---

## Google Cloud Setup

Follow these steps to set up your Google Cloud Project for the Landshield backend.

### Project and APIs

1.  **Create a Google Cloud Project:** If you don't have one, create a new project on the Google Cloud Console. Enable billing for the project.
2.  **Enable Required APIs:** Ensure the following APIs are enabled in your Google Cloud Project:
    *   **Cloud Firestore API**
    *   **Cloud Storage API**
    *   **Identity Platform API** (for Firebase Authentication)
    *   **Vertex AI API** (for Gemini models)
    *   **Cloud IAM API**
    *   (If using Cloud Tasks/Pub/Sub for agent orchestration): **Cloud Tasks API**, **Cloud Pub/Sub API**

### Service Accounts & IAM

You will need at least two service accounts: one for your FastAPI application and one for your ADK agents.

1.  **Application Service Account (for FastAPI):**
    *   Create a new service account in IAM & Admin -> Service Accounts.
    *   Grant it the following roles:
        *   `Cloud Storage Object Admin` (for uploading/downloading documents)
        *   `Cloud Datastore User` or `Cloud Datastore Owner` (for Firestore access)
        *   `Firebase Authentication Admin` (if your backend needs to interact directly with Firebase Auth, e.g., to create custom tokens)
    *   Download the JSON key for this service account and configure your local environment (e.g., `GOOGLE_APPLICATION_CREDENTIALS` environment variable) or ensure it's available to your deployment environment.

2.  **ADK Agent Service Account:**
    *   Create another service account specifically for your ADK agents.
    *   Grant it the following roles:
        *   `Vertex AI User` (for accessing Gemini models)
        *   `Cloud Storage Object Viewer` (to read documents from GCS)
        *   `Cloud Datastore User` (for agents to read/write to Firestore)
    *   Note down its email address, you will need it for the `ADK_AGENT_SERVICE_ACCOUNT` environment variable.

### Firebase Authentication

1.  **Set up Firebase Project:** Go to the Firebase Console, add a project, and select your existing Google Cloud Project.
2.  **Enable Authentication:** In Firebase, navigate to "Authentication" and enable the desired sign-in methods (e.g., Email/Password, Google, etc.).
3.  **Note Firebase Project ID:** This is typically the same as your Google Cloud Project ID, but confirm it in Firebase Project Settings. This will be used for the `FIREBASE_PROJECT_ID` environment variable.

### Cloud Storage Bucket

1.  **Create a GCS Bucket:** In the Google Cloud Console, navigate to Cloud Storage -> Buckets. Create a new bucket.
2.  **Bucket Naming:** Choose a globally unique name.
3.  **Update `.env`:** Set the `GCS_BUCKET_NAME` variable in your `.env` file to the name of this bucket.

### Firestore Database

1.  **Create Firestore Database:** In the Google Cloud Console, navigate to Firestore. Choose "Native mode" and select a location.
2.  No further configuration is needed for collections; they will be created by the application if they don't exist.

---

## Local Development Setup

### Clone Repository

```bash
git clone YOUR_REPOSITORY_URL_HERE
cd land-guard/backend
```

### Virtual Environment & Dependencies

It's highly recommended to use a virtual environment to manage dependencies.

```bash
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
pip install -r requirements.txt
```

### Environment Variables (`.env`)

Create a `.env` file in the `backend/` directory by copying `.env.example`.

```bash
cp .env.example .env
```

Now, edit the `.env` file with your specific Google Cloud and Firebase configurations:

```ini
# Google Cloud Project ID
GCP_PROJECT_ID="your-gcp-project-id"

# Google Cloud Storage bucket name for documents (e.g., "my-landshield-bucket")
GCS_BUCKET_NAME="your-gcs-bucket-name"

# Firebase Project ID for authentication (usually same as GCP_PROJECT_ID)
FIREBASE_PROJECT_ID="your-firebase-project-id"

# Service account email for ADK Agents.
# This SA should have roles like "Vertex AI User", "Cloud Storage Object Viewer", "Cloud Datastore User".
# Example: "adk-agent-sa@your-gcp-project-id.iam.gserviceaccount.com"
ADK_AGENT_SERVICE_ACCOUNT="your-adk-agent-service-account-email"

# Optional: Port for the FastAPI application (default is 8000)
# PORT=8000
```

**Production-only env vars** (set on Cloud Run, not in local `.env`):

| Variable          | Value                | Purpose                                                          |
|-------------------|----------------------|------------------------------------------------------------------|
| `ENABLE_DOCS`     | `false`              | Disables `/docs`, `/redoc`, `/openapi.json` in production.       |
| `LOG_FORMAT`      | `json`               | Emits structured JSON logs for Cloud Logging.                    |
| `LOG_LEVEL`       | `INFO`               | Root log level.                                                  |
| `WEB_CONCURRENCY` | `2`                  | Gunicorn worker count per Cloud Run instance.                    |
| `CORS_ORIGINS`    | `https://<web-url>`  | Comma-separated allowed origins.                                 |
| `REDIS_ENABLED`   | `true`               | Enables Memorystore-backed rate limiting + cache.                |
| `PUBSUB_ENABLED`  | `true`               | Enables async job dispatch via Pub/Sub.                          |
| `BIGQUERY_ENABLED`| `true`               | Enables analytics export.                                        |

The Cloud Run service injects `PORT` automatically; do not override it.

**Authentication for Local Development:**
When running locally, your application will use your `gcloud` authenticated user's credentials by default (`gcloud auth application-default login`). Ensure this user has the necessary permissions (same as the Application Service Account mentioned above).

### Running Locally

To run the FastAPI application locally with auto-reloading:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API documentation (Swagger UI) will be available at `http://localhost:8000/docs`.

---

## API Endpoints

The API is versioned under `/api/v1`.

*   **`POST /api/v1/documents/upload`**: Uploads a land document for analysis.
    *   **Authentication:** Required (Firebase ID Token in `Authorization: Bearer <token>`).
    *   **Request:** `multipart/form-data` with `file`.
    *   **Response:** `{ "document_id": "string", "message": "string" }`
*   **`GET /api/v1/documents`**: Lists documents uploaded by the authenticated user.
    *   **Authentication:** Required.
    *   **Query Params:** `page` (int), `page_size` (int), `status_filter` (DocumentStatus enum).
    *   **Response:** `{ "documents": [Document], "total": int, "page": int, "page_size": int }`
*   **`GET /api/v1/documents/{document_id}`**: Retrieves details of a specific document.
    *   **Authentication:** Required.
    *   **Response:** `{ "document": Document }`
*   **`GET /api/v1/analysis/stream/{document_id}`**: Streams real-time analysis progress using Server-Sent Events (SSE).
    *   **Authentication:** Required.
    *   **Response:** `text/event-stream` with `AnalysisProgressEvent` objects.
*   **`GET /api/v1/analysis/report/{document_id}`**: Retrieves the final analysis report.
    *   **Authentication:** Required.
    *   **Response:** `{ "report": AnalysisReport }`

---

## Deployment (Google Cloud Run)

The backend is designed for serverless deployment on Google Cloud Run.

1.  **Build Docker Image:**
    ```bash
    docker build -t gcr.io/your-gcp-project-id/landguard-backend:latest .
    ```
    (Replace `your-gcp-project-id` with your actual GCP Project ID).

2.  **Push Docker Image to Google Container Registry:**
    ```bash
    docker push gcr.io/your-gcp-project-id/landguard-backend:latest
    ```

3.  **Deploy to Cloud Run:**
    ```bash
    gcloud run deploy landguard-backend 
      --image gcr.io/your-gcp-project-id/landguard-backend:latest 
      --platform managed 
      --region YOUR_GCP_REGION 
      --allow-unauthenticated 
      --update-env-vars GCP_PROJECT_ID="your-gcp-project-id",GCS_BUCKET_NAME="your-gcs-bucket-name",FIREBASE_PROJECT_ID="your-firebase-project-id",ADK_AGENT_SERVICE_ACCOUNT="your-adk-agent-service-account-email" 
      --service-account "your-application-service-account-email" 
      --max-instances 5 
      --min-instances 0 
      --memory 1Gi
    ```
    *   **`--region`**: Choose a GCP region close to your users and other services.
    *   **`--allow-unauthenticated`**: Set this if your frontend directly accesses Cloud Run; authentication will be handled by Firebase Auth within the application. For stricter control, you can enable IAM authentication for Cloud Run and manage access through IAM policies.
    *   **`--update-env-vars`**: Provide all necessary environment variables.
    *   **`--service-account`**: Crucially, specify the email of your **Application Service Account** created in the [Service Accounts & IAM](#service-accounts--iam) section. This service account will be used by your Cloud Run instance to access Firestore, GCS, and Firebase.

## Testing

Unit and integration tests are located in the `tests/` directory.

To run all tests:

```bash
pytest
```

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/          # FastAPI route definitions
│   │   │   └── schemas/            # Pydantic models for API request/response validation
│   │   ├── agents/
│   │   │   ├── core/               # Base agent class and utilities
│   │   │   ├── fraud/              # Fraud Detection Agent logic
│   │   │   ├── legal/              # Legal Rules Agent logic
│   │   │   ├── parser/             # Document Parser Agent logic
│   │   │   ├── report/             # Report Generator Agent logic
│   │   │   └── orchestrator.py     # Main agent orchestrating the workflow
│   │   ├── core/                   # Core application configuration, error handling, security
│   │   ├── models/                 # Core Pydantic data models for the application entities
│   │   ├── services/               # Google Cloud service clients (Firestore, GCS)
│   │   ├── utils/                  # Utility functions (e.g., SSE formatting)
│   │   └── main.py                 # FastAPI application entry point
├── tests/                          # Unit and integration tests
├── Dockerfile                      # Docker container definition
├── requirements.txt                # Python package dependencies
├── .env.example                    # Example environment variables
├── README.md                       # This README file
└── start.sh                        # Script to start the application (useful for Docker/Cloud Run)
```
