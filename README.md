# 🛡️ LandGuard — AI-Powered Land Document Fraud Detection

> **Built for the Google Gemini CLI Buildathon** | Team: Trust Trailblazers

Buying land is one of the riskiest things a common person can do in India. Most people can't read or understand government land documents, don't know what papers to check, and fraudsters exploit this — selling land they don't own, forging documents, selling the same plot to multiple buyers, or selling restricted land that legally cannot be resold.

**LandGuard fixes this.** Upload your land papers — sale deed, property extract, encumbrance certificate — and AI reads everything, explains it in simple language, and flags what looks wrong: mismatched names, missing signatures, broken ownership history, missing documents. It knows real fraud cases from news and courts, and official land rules for your state and district.

**Live:** [land-guard-web-593405835352.us-central1.run.app](https://land-guard-web-593405835352.us-central1.run.app)

---

## ⚡ Evaluator quick-start

1. Open the live URL above on desktop or mobile.
2. Sign up with any email (or sign in with Google) — no approval required.
3. From the dashboard, click **Upload** and pick a sample PDF from [`docs/samples/`](docs/samples/) — `docs/samples/fraudulent/karnataka/01-agricultural-land-conversion-fraud.pdf` is a good first run.
4. Watch the live SSE stream: parser → legal → fraud → report. Typical run: 30–90 s.
5. Open the resulting report. The **Findings** tab is sorted by severity; Critical issues are highlighted in red.

Want to try a clean (legitimate) document for contrast? Pick anything under [`docs/samples/legitimate/`](docs/samples/legitimate/).

---

## 🎯 What It Does

1. **Upload** any land document (PDF or image, Hindi/English/regional languages)
2. **AI parses** the document — extracts parties, property details, dates, registration info, stamps, signatures
3. **Legal compliance check** — validates against Indian land laws (Transfer of Property Act 1882, Registration Act 1908, state-specific rules)
4. **Fraud detection** — identifies red flags using AI + Google Search grounding with real court cases and news
5. **Risk report** — generates a 0-100 risk score with plain-language findings and a verification checklist
6. **Analytics dashboard** — risk distribution, fraud type breakdown, trend analysis across all your documents

All in real-time with live progress streaming via SSE.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Next.js 14 Frontend (Cloud Run)                  │
│      Landing Page → Auth → Dashboard → Upload → Report → Analytics   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ SSE + REST API
┌───────────────────────────▼──────────────────────────────────────────┐
│                    FastAPI Backend (Cloud Run)                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                   Orchestrator Agent                           │   │
│  │                                                               │   │
│  │  ┌──────────────┐                                             │   │
│  │  │  Document     │ ──── Step 1: Parse & Extract               │   │
│  │  │  Parser Agent │       (Gemini 2.5 Flash Vision)            │   │
│  │  └──────┬───────┘                                             │   │
│  │         │                                                     │   │
│  │    ┌────▼────┐    ┌────────────┐                              │   │
│  │    │  Legal   │    │   Fraud    │ ── Step 2: Parallel          │   │
│  │    │  Rules   │    │ Detection  │    Analysis                  │   │
│  │    │  Agent   │    │   Agent    │                              │   │
│  │    └────┬────┘    └─────┬──────┘                              │   │
│  │         │               │   ▲ Google Search Grounding          │   │
│  │         └───────┬───────┘                                     │   │
│  │         ┌───────▼───────┐                                     │   │
│  │         │    Report     │ ── Step 3: Risk Score                │   │
│  │         │   Generator   │    & Recommendations                │   │
│  │         └───────────────┘                                     │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────┐ ┌───────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐   │
│  │ Firestore │ │  GCS  │ │ BigQuery │ │ Pub/Sub │ │  Vertex AI   │   │
│  │(metadata) │ │(docs) │ │(events)  │ │(alerts) │ │ (embeddings) │   │
│  └──────────┘ └───────┘ └──────────┘ └─────────┘ └──────────────┘   │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐     │
│  │ Firebase Auth   │  │  Redis Cache   │  │ Cloud Monitoring   │     │
│  │(Google, Apple,  │  │ (Memorystore)  │  │   (metrics)        │     │
│  │ email/password) │  │                │  │                    │     │
│  └────────────────┘  └────────────────┘  └─────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### Multi-Agent Pipeline

| Agent | Model | Purpose |
|-------|-------|---------|
| **Document Parser** | Gemini 2.5 Flash (Vision) | OCR + structured data extraction from land documents |
| **Legal Rules** | Gemini 2.5 Flash | Validates against Indian land laws, stamp duty rules, state restrictions |
| **Fraud Detection** | Gemini 2.5 Flash + Google Search | Detects fraud patterns, cross-references real cases via Search grounding |
| **Report Generator** | Gemini 2.5 Flash | Compiles risk score (0-100), findings, and verification checklist |

### Post-Analysis Pipeline (fire-and-forget)

After each analysis completes, the orchestrator triggers:
1. **BigQuery logging** — analysis events and fraud patterns stored for analytics
2. **Pub/Sub alerts** — fraud alerts published when risk score ≥ 60
3. **Vertex AI embeddings** — document text embedded for similarity search
4. **Cloud Monitoring** — latency and counter metrics flushed

---

## 🛠️ Tech Stack

### Google Cloud Platform
| Service | Purpose |
|---------|---------|
| **Gemini 2.5 Flash** (Vertex AI) | Multimodal document analysis, OCR, reasoning |
| **Google Search Grounding** | Real-world fraud case detection via live search |
| **Cloud Firestore** | Document metadata, analysis reports, SSE events |
| **Cloud Storage (GCS)** | Document file storage with signed URLs |
| **BigQuery** | Analysis event logging, fraud pattern analytics |
| **Pub/Sub** | Async fraud alerts, dead-letter queue |
| **Vertex AI Embeddings** | text-embedding-005 for document similarity |
| **Memorystore (Redis)** | Multi-layer cache (OCR 30d, reports 7d, rate limiting) |
| **Firebase Auth** | Google OAuth, Apple OAuth, email/password |
| **Cloud Run** | Serverless container deployment (backend + frontend) |
| **Cloud Build** | CI/CD pipeline from GitHub |
| **Artifact Registry** | Container image storage |
| **Secret Manager** | API keys and service account credentials |
| **Cloud Monitoring** | Custom metrics (latency, counters) |

### Backend
- Python 3.11 / FastAPI / Pydantic v2
- Gunicorn + Uvicorn workers (2 workers, 300s timeout)
- SSE (Server-Sent Events) for real-time streaming
- Full async/await architecture
- Multi-layer caching: Redis → Firestore → fresh parse

### Frontend
- Next.js 14 (App Router) / TypeScript / Material UI v5
- Real-time SSE progress tracking
- SVG risk gauge + analytics charts
- Google-clean design with particle animations

### Infrastructure
- Docker multi-stage builds (standalone output)
- Terraform for infrastructure-as-code
- Docker Compose for local development
- Cloud Build CI/CD (`cloudbuild.yaml`)

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Cloud project with APIs enabled
- Firebase project configured

### Local Development

```bash
# Clone the repo
git clone https://github.com/abhi88000/land-fraud-detection.git
cd land-fraud-detection

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Docker Compose
```bash
docker-compose up --build
```

### Deploy to Cloud Run
```bash
# Backend
gcloud run deploy land-guard-api --source ./backend \
  --region us-central1 --allow-unauthenticated

# Frontend
gcloud run deploy land-guard-web --source ./frontend \
  --region us-central1 --allow-unauthenticated \
  --set-env-vars "HOSTNAME=0.0.0.0"
```

---

## 📂 Project Structure

```
land-fraud-detection/
├── backend/
│   ├── app/
│   │   ├── agents/              # Multi-agent system
│   │   │   ├── core/            # Base agent class
│   │   │   ├── parser/          # Document Parser Agent
│   │   │   ├── legal/           # Legal Rules Agent
│   │   │   ├── fraud/           # Fraud Detection Agent
│   │   │   ├── report/          # Report Generator Agent
│   │   │   └── orchestrator.py  # Pipeline + post-analysis tasks
│   │   ├── api/v1/              # REST API endpoints
│   │   ├── core/                # Config, auth, models
│   │   ├── models/              # Data models
│   │   ├── services/
│   │   │   ├── firestore.py     # Firestore CRUD
│   │   │   ├── gcs.py           # GCS file storage
│   │   │   ├── cache.py         # Redis multi-layer cache
│   │   │   ├── bigquery.py      # Analytics event logging
│   │   │   ├── pubsub.py        # Fraud alert publishing
│   │   │   ├── embeddings.py    # Vertex AI embeddings
│   │   │   └── monitoring.py    # Cloud Monitoring metrics
│   │   └── utils/               # SSE utilities
│   └── tests/
├── frontend/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx             # Landing page (particle animation)
│   │   ├── (main)/
│   │   │   ├── dashboard/       # Document management
│   │   │   ├── documents/[id]/  # Analysis view
│   │   │   ├── analytics/       # Analytics dashboard
│   │   │   ├── login/           # Sign in
│   │   │   └── signup/          # Create account
│   │   └── api/proxy/           # Backend proxy
│   ├── components/
│   │   ├── analysis/            # ReportDisplay (SVG gauge)
│   │   ├── dashboard/           # DocumentList, UploadDialog
│   │   └── ui/                  # Loading screens
│   └── lib/                     # API client, types, Firebase auth
├── infra/terraform/             # Full GCP infrastructure
├── docker-compose.yml
├── cloudbuild.yaml
└── Makefile
```

---

## 🔒 Security

- **Firebase Auth** — Google OAuth, Apple OAuth, email/password (no anonymous access)
- **Token verification** on all API endpoints via Firebase Admin SDK
- **User-scoped isolation** — users can only access their own documents
- **File validation** — type checking, 20MB size limit, filename sanitization
- **GCS signed URLs** — no direct bucket exposure
- **Secret Manager** — all credentials stored securely, never in code

---

## 🌍 Supported Languages

Land documents in: **Hindi, English, Tamil, Kannada, Telugu, Marathi** — Gemini's multimodal capabilities handle regional language documents natively.

---

## 📊 Enterprise Use Cases

| Sector | Use Case |
|--------|----------|
| **Banking & NBFCs** | Loan-against-property verification before disbursement |
| **Real Estate Platforms** | Automated listing verification for property marketplaces |
| **Legal Firms** | Bulk document review for property dispute cases |
| **Government** | Land registry fraud detection and compliance audits |
| **Insurance** | Property insurance underwriting risk assessment |

---

## 🏆 Why This Matters

- **₹1,000+ crore** lost annually to land fraud in India
- **66%** of civil court cases in India are property disputes
- Most buyers cannot read or understand land documents
- No affordable tool exists for common people to verify land papers

LandGuard democratizes access to expert-level land document verification using AI.

---

## 📄 License

MIT License

---

*Built with ❤️ using Google Gemini 2.5 Flash · Vertex AI · Cloud Run · BigQuery · Pub/Sub*
