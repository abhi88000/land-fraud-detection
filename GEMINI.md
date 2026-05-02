## 1. Overview
This project is **LandGuard** — an AI-powered land document verification platform that helps common people detect fraud in Indian land transactions. Built with **Python FastAPI** backend, **Next.js 14 + Material UI** frontend, and **Google Agent Development Kit (ADK)** for multi-agent orchestration. Deployed on **Google Cloud Run** with a full enterprise GCP architecture.

## Key Goals:
- Agentic AI architecture with multiple specialized agents
- Production-grade code quality and security
- Real-time streaming analysis with SSE
- Multi-language Indian document support (Hindi, Tamil, Kannada, Telugu, Marathi, English)
- Enterprise GCP integration: Redis, Pub/Sub, BigQuery, Vertex AI, Secret Manager, Cloud Monitoring

## 2. Tech Stack & Structure
**Backend:**
- Python 3.11+ with FastAPI
- Google ADK (google-adk) for multi-agent orchestration
- Gemini 2.5 Flash via Vertex AI for multimodal document analysis
- Google Cloud Storage for document uploads
- Firestore for persistent storage + OCR cache
- Redis (Memorystore) for high-speed caching layer
- Cloud Pub/Sub for async job processing & fraud alerts
- BigQuery for cross-user fraud pattern analytics
- Vertex AI Embeddings (text-embedding-005) for document similarity
- Cloud Monitoring for custom metrics
- Server-Sent Events (SSE) for real-time streaming

**Frontend:**
- Next.js 14 (App Router)
- Material UI (MUI) v5 with Google color scheme (#4285F4, #EA4335, #FBBC05, #34A853)
- Antigravity-style animated landing page with particle effects
- Collective analysis UX (batch analysis of multiple documents)

**Infrastructure (Terraform-managed):**
- Google Cloud Run for backend (2 CPU, 2GB) and frontend
- Cloud Storage for documents
- Firestore (nam5 multi-region) for data persistence
- Memorystore Redis 7.0 (1GB) for caching
- Pub/Sub (analysis jobs topic + dead letter queue)
- BigQuery (fraud_patterns + analysis_events tables)
- Secret Manager for sensitive configuration
- Artifact Registry for Docker images
- VPC connector for Redis access from Cloud Run
- IAM: Pub/Sub publisher, BigQuery editor, Secret Manager accessor, Vertex AI user, Monitoring writer

## 3. Architecture — Multi-Agent System
4 specialized agents orchestrated by a main agent:
1. **Document Parser Agent** — Gemini Vision to OCR/read land docs, extract: document type, party names, survey/plot numbers, area, dates, registration numbers, stamp duty, signatures, language
2. **Legal Rules Agent** — Indian land law compliance: Transfer of Property Act, Registration Act, state-specific rules, restricted land categories
3. **Fraud Detection Agent** — Name mismatches, broken ownership chains, missing signatures, Google Search grounding for real fraud cases
4. **Report Generator Agent** — Risk score (0-100), category breakdown, plain-language findings, verification checklist

## 4. GCP Data Flow
```
Upload → GCS → Orchestrator → [Redis check → Firestore check → Gemini OCR]
                    ↓
         Parser → Legal + Fraud (parallel) → Report
                    ↓
         Save to Firestore + Redis cache
                    ↓
         Post-analysis (async, non-blocking):
           • BigQuery: log analysis event + fraud patterns
           • Pub/Sub: publish fraud alert if risk ≥ 60
           • Vertex AI: generate text embedding for similarity search
           • Monitoring: record latency, cache hits, fraud counts
```

## 5. Caching Strategy (Multi-Layer)
1. **Redis (Memorystore)** — fastest, TTL 30 days for OCR, 7 days for reports
2. **Firestore** — persistent OCR cache in document entry
3. **Fresh parse** — only when both layers miss

## 6. Python Style
- PEP 8 styling
- Type hints on all functions
- Pydantic models for all data structures
- Async/await for all I/O
- Custom exception classes
- Graceful degradation: all GCP services have `_ENABLED` flags

## 7. REST API Design
- Versioned URLs: /api/v1/documents, /api/v1/analysis/{id}
- Correct HTTP methods and status codes
- Consistent JSON envelope: {status, data, errors}
- Streaming endpoints use SSE (text/event-stream)
- Rate limiting via Redis sliding window (20 req/hr/user/action)

## 8. Frontend Guidelines
- TypeScript strict mode
- MUI components only
- Mobile responsive
- Loading states and error boundaries

## 9. Testing
- pytest for Python
- Jest + React Testing Library for frontend
- Every endpoint must have unit tests