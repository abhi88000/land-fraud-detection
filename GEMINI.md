## 1. Overview
This project is **LandGuard** — an AI-powered land document review and risk-assessment platform that helps common people and lenders evaluate Indian land transactions before they commit. Built with **Python FastAPI** backend, **Next.js 14 + Material UI** frontend, and **Google Agent Development Kit (ADK)** for multi-agent orchestration. Deployed on **Google Cloud Run** with a full enterprise GCP architecture.

**Note on positioning.** We do not claim to detect forgery. The system assumes uploaded documents are genuine and verifies whether they are internally consistent, complete, and aligned with the relevant state's land-law guidelines. The Risk Review agent surfaces concrete inconsistencies (name mismatches, broken chains, missing supporting documents); the Regional News agent surfaces recent land-related news and court rulings for the parcel's district/state, with citations and dates.

**Built end-to-end with Google Gemini.** Gemini is the *only* AI used in this project — both at runtime (Gemini 2.5 Flash via Vertex AI powers every agent) and during development (Gemini was the sole AI pair-programmer used to scaffold, refactor, debug, and document the codebase, infrastructure, and presentation materials). No other AI assistants, copilots, or LLMs were used in any part of the build.

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
- Cloud Pub/Sub for async job processing & high-risk alerts
- BigQuery for cross-user risk-indicator analytics
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
- BigQuery (risk_patterns + analysis_events tables)
- Secret Manager for sensitive configuration
- Artifact Registry for Docker images
- VPC connector for Redis access from Cloud Run
- IAM: Pub/Sub publisher, BigQuery editor, Secret Manager accessor, Vertex AI user, Monitoring writer

## 3. Architecture — Multi-Agent System
6 specialized agents orchestrated by a main agent:
1. **Document Parser Agent** — Gemini Vision to OCR/read land docs, extract: document type, party names, survey/plot numbers, area, dates, registration numbers, stamp duty, signatures, language
2. **Legal Rules Agent** — Indian land law compliance: Transfer of Property Act, Registration Act, state-specific rules, restricted land categories
3. **Risk Review Agent** — Name mismatches, broken ownership chains, missing signatures, internal inconsistencies; Google Search grounding for real case references
4. **Regional News Agent** — Grounded Google Search for recent land disputes, registration scams, RERA actions, and high-court land rulings in the parcel's district/state, with sources and dates
5. **Report Generator Agent** — Trust score (0–100, penalised when supporting documents are missing), category breakdown, plain-language findings, verification checklist
6. **Orchestrator Agent** — Coordinates the above, fans out parallel execution, streams progress over SSE

## 4. GCP Data Flow
```
Upload → GCS → Orchestrator → [Redis check → Firestore check → Gemini OCR]
                    ↓
         Parser → Legal + Risk Review + Regional News (parallel) → Report
                    ↓
         Save to Firestore + Redis cache
                    ↓
         Post-analysis (async, non-blocking):
           • BigQuery: log analysis event + risk-indicator patterns
           • Pub/Sub: publish high-risk alert if risk ≥ 60
           • Vertex AI: generate text embedding for similarity search
           • Monitoring: record latency, cache hits, indicator counts
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

## 10. AI Development Partner — Gemini Only
This project was built using **Google Gemini as the sole AI assistant**, both for product runtime and for the development workflow itself. To keep the build cohesive and fully within the Google ecosystem, no other AI tool (no GitHub Copilot, no Claude, no ChatGPT, no Cursor AI, no third-party LLM) was used at any stage.

Gemini was used for:
- **Code generation & refactoring** — FastAPI endpoints, ADK agent definitions, Next.js components, Pydantic schemas, async orchestration logic.
- **Infrastructure as code** — Terraform modules for Cloud Run, Memorystore, Pub/Sub, BigQuery, Secret Manager, VPC connector, IAM bindings.
- **Debugging** — stack-trace analysis, Cloud Run cold-start tuning, SSE timeout alignment, Redis fail-open verification, rate-limiter review.
- **Documentation** — this `GEMINI.md`, `README.md`, backend `README.md`, evaluator quick-start, sample document descriptions.
- **Presentation materials** — the PowerPoint deck generator (`docs/deck/generate_landshield_deck.ps1`) and slide content.
- **Prompt engineering** — system prompts for the Parser, Legal, Risk Review, Regional News, and Report agents; Google Search grounding configuration.

Runtime AI is exclusively **Gemini 2.5 Flash** via Vertex AI, accessed through `google-genai` and Google ADK. Text embeddings use Google's `text-embedding-005`. There are no calls to OpenAI, Anthropic, or any non-Google model provider anywhere in the codebase — verifiable by grepping `requirements.txt` and the source tree.