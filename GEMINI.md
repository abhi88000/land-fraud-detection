## 1. Overview
This project is **LandGuard** — an AI-powered land document verification platform that helps common people detect fraud in Indian land transactions. Built with **Python FastAPI** backend, **Next.js 14 + Material UI** frontend, and **Google Agent Development Kit (ADK)** for multi-agent orchestration. Deployed on **Google Cloud Run**.

## Key Goals:
- Agentic AI architecture with multiple specialized agents
- Production-grade code quality and security
- Real-time streaming analysis with SSE
- Multi-language Indian document support (Hindi, Tamil, Kannada, Telugu, Marathi, English)

## 2. Tech Stack & Structure
**Backend:**
- Python 3.11+ with FastAPI
- Google ADK (google-adk) for multi-agent orchestration
- Gemini 2.5 Pro via Vertex AI for multimodal document analysis
- Google Cloud Storage for document uploads
- Firestore for persistent storage
- Server-Sent Events (SSE) for real-time streaming

**Frontend:**
- Next.js 14 (App Router)
- Material UI (MUI) v5 with Google color scheme (#4285F4, #EA4335, #FBBC05, #34A853)
- react-pdf for document viewing
- reactflow for ownership chain visualization

**Infrastructure:**
- Google Cloud Run for backend and frontend
- Cloud Storage for documents
- Firestore for data persistence

## 3. Architecture — Multi-Agent System
4 specialized agents orchestrated by a main agent:
1. **Document Parser Agent** — Gemini Vision to OCR/read land docs, extract: document type, party names, survey/plot numbers, area, dates, registration numbers, stamp duty, signatures, language
2. **Legal Rules Agent** — Indian land law compliance: Transfer of Property Act, Registration Act, state-specific rules, restricted land categories
3. **Fraud Detection Agent** — Name mismatches, broken ownership chains, missing signatures, Google Search grounding for real fraud cases
4. **Report Generator Agent** — Risk score (0-100), category breakdown, plain-language findings, verification checklist

## 4. Python Style
- PEP 8 styling
- Type hints on all functions
- Pydantic models for all data structures
- Async/await for all I/O
- Custom exception classes

## 5. REST API Design
- Versioned URLs: /api/v1/documents, /api/v1/analysis/{id}
- Correct HTTP methods and status codes
- Consistent JSON envelope: {status, data, errors}
- Streaming endpoints use SSE (text/event-stream)

## 6. Frontend Guidelines
- TypeScript strict mode
- MUI components only
- Mobile responsive
- Loading states and error boundaries

## 7. Testing
- pytest for Python
- Jest + React Testing Library for frontend
- Every endpoint must have unit tests