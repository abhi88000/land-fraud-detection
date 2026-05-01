# 🛡️ LandGuard — AI-Powered Land Document Fraud Detection

> **Built for the Google Gemini CLI Buildathon**

Buying land is one of the riskiest things a common person can do in India. Most people can't read or understand government land documents, don't know what papers to check, and fraudsters exploit this — selling land they don't own, forging documents, selling the same plot to multiple buyers, or selling restricted land that legally cannot be resold.

**LandGuard fixes this.** Upload your land papers — sale deed, property extract, encumbrance certificate — and AI reads everything, explains it in simple language, and flags what looks wrong: mismatched names, missing signatures, broken ownership history, missing documents. It knows real fraud cases from news and courts, and official land rules for your state and district.

---

## 🎯 What It Does

1. **Upload** any land document (PDF or image, Hindi/English/regional languages)
2. **AI parses** the document — extracts parties, property details, dates, registration info, stamps, signatures
3. **Legal compliance check** — validates against Indian land laws (Transfer of Property Act 1882, Registration Act 1908, state-specific rules)
4. **Fraud detection** — identifies red flags using AI + Google Search grounding with real court cases and news
5. **Risk report** — generates a 0-100 risk score with plain-language findings and a verification checklist

All in real-time with live progress streaming.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│         (Upload → Live Progress → Report View)           │
└──────────────────────┬──────────────────────────────────┘
                       │ SSE + REST API
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Orchestrator Agent                       │ │
│  │                                                     │ │
│  │  ┌──────────────┐                                   │ │
│  │  │  Document     │ ──── Step 1: Parse & Extract     │ │
│  │  │  Parser Agent │       (Gemini 2.5 Vision)        │ │
│  │  └──────┬───────┘                                   │ │
│  │         │                                           │ │
│  │    ┌────▼────┐    ┌────────────┐                    │ │
│  │    │  Legal   │    │   Fraud    │ ── Step 2:        │ │
│  │    │  Rules   │    │ Detection  │    Parallel       │ │
│  │    │  Agent   │    │   Agent    │    Analysis       │ │
│  │    └────┬────┘    └─────┬──────┘                    │ │
│  │         │               │   ▲ Google Search         │ │
│  │         └───────┬───────┘   │ Grounding             │ │
│  │                 │                                   │ │
│  │         ┌───────▼───────┐                           │ │
│  │         │    Report     │ ── Step 3: Risk Score     │ │
│  │         │   Generator   │    & Recommendations      │ │
│  │         └───────────────┘                           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐        │
│  │ Firestore │  │    GCS    │  │  Firebase Auth │        │
│  │(metadata) │  │ (docs)   │  │   (users)      │        │
│  └──────────┘  └───────────┘  └────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

### Multi-Agent Pipeline

| Agent | Model | Purpose |
|-------|-------|---------|
| **Document Parser** | Gemini 2.5 Flash (Vision) | OCR + structured data extraction from land documents |
| **Legal Rules** | Gemini 2.5 Flash | Validates against Indian land laws, stamp duty rules, state restrictions |
| **Fraud Detection** | Gemini 2.5 Flash + Google Search | Detects fraud patterns, cross-references real cases via Search grounding |
| **Report Generator** | Gemini 2.5 Flash | Compiles risk score (0-100), findings, and verification checklist |

---

## 🛠️ Tech Stack

### Google Cloud Services
- **Gemini 2.5 Flash** via Vertex AI — multimodal document analysis
- **Google Search Grounding** — real-world fraud case detection
- **Cloud Firestore** — document metadata, analysis reports, SSE events
- **Cloud Storage (GCS)** — document file storage
- **Firebase Authentication** — user management
- **Cloud Run** — serverless deployment
- **Cloud Build** — CI/CD pipeline
- **Artifact Registry** — container images

### Backend
- Python 3.11+ / FastAPI / Pydantic
- SSE (Server-Sent Events) for real-time streaming
- Full async/await architecture

### Frontend
- Next.js 14 (App Router) / TypeScript / Material UI v5
- Real-time SSE progress tracking
- PDF & image document viewer

### Infrastructure
- Docker multi-stage builds
- Terraform for infrastructure-as-code
- Docker Compose for local development

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
cp .env.example .env      # Configure your environment variables
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
cp .env.local.example .env.local  # Configure Firebase credentials
npm run dev
```

### Docker Compose
```bash
docker-compose up --build
```

---

## 📂 Project Structure

```
land-fraud-detection/
├── backend/
│   ├── app/
│   │   ├── agents/           # Multi-agent system
│   │   │   ├── core/         # Base agent class
│   │   │   ├── parser/       # Document Parser Agent
│   │   │   ├── legal/        # Legal Rules Agent
│   │   │   ├── fraud/        # Fraud Detection Agent
│   │   │   ├── report/       # Report Generator Agent
│   │   │   └── orchestrator.py
│   │   ├── api/v1/           # REST API endpoints
│   │   ├── core/             # Config, auth, models
│   │   ├── models/           # Data models
│   │   ├── services/         # Firestore, GCS services
│   │   └── utils/            # SSE utilities
│   └── tests/
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # React components
│   │   ├── analysis/         # DocumentViewer, ReportDisplay
│   │   ├── dashboard/        # DocumentList, UploadDialog
│   │   └── ui/               # Loading screens
│   └── lib/                  # API client, types, Firebase
├── infra/terraform/          # Infrastructure as Code
├── docker-compose.yml
├── cloudbuild.yaml
└── Makefile
```

---

## 🔒 Security

- Firebase ID token verification on all API endpoints
- User-scoped document isolation (users can only access their own documents)
- File upload validation: type checking, 20MB size limit, filename sanitization
- Guest mode gated behind environment variable (disabled in production)
- GCS signed URLs for document access (no direct bucket exposure)

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

*Built with ❤️ using Google Gemini, Vertex AI, and Google Cloud*
