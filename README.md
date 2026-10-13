# AI Tutor (EduSense AI) — CSPIT CSE Adaptive Learning & Agentic RAG Platform

> **An AI-powered adaptive learning and syllabus-grounded tutoring platform for CSPIT Computer Science & Engineering (CHARUSAT), featuring role-based dashboards (Student, Faculty, Admin), fail-closed Agentic RAG, multi-format document indexing, and 1-on-1 office hours booking.**

---

## 🌟 Executive Overview

**EduSense AI (AI Tutor)** connects university students with verified, faculty-approved course materials. Unlike generic chatbots, the platform strictly enforces **fail-closed academic integrity**:

1. **Syllabus-Grounded Answers**: Responses are generated strictly from verified course materials (PDF, DOCX, PPTX, XLSX, CSV, MD, HTML) with verifiable chunk citations (`[1]`, `[2]`).
2. **Zero Hallucination Policy**: If course evidence is absent or insufficient, the system explicitly abstains rather than inventing academic facts.
3. **Multi-Role Portals**: Tailored workflows for **Students** (AI tutoring, adaptive quizzes, office hours booking), **Faculty** (curriculum uploads, quiz management, mastery analytics), and **Administrators** (user batch onboarding via Excel, document approvals, audit logs).

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        EduSense AI Architecture                        │
└────────────────────────────────────────────────────────────────────────┘
 [Student / Faculty / Admin Web Portal] (React 18, Vite, TanStack Router :8080 / :5173)
                     │
                     ▼
 [Express Gateway & API] (Node.js ES Modules :5000, Supabase / MongoDB Atlas, JWT Auth)
                     │
                     │  HTTP POST (Header: X-Internal-Token)
                     ▼
 [Python Agentic RAG Microservice] (FastAPI, Uvicorn :8001)
   ├── Input Guardrails & Intent Routing (Academic / Smalltalk / Offtopic)
   ├── Context-Aware Query Rewriting (Conversation History Resolution)
   ├── Authorization Scope & Subject Filtering (Chroma where: {subject_code, is_active})
   ├── Hybrid Retrieval (Dense Chroma Cosine + BM25Okapi Lexical)
   ├── Reciprocal Rank Fusion (RRF k=60) & Passage Scoring
   ├── Evidence Relevance Grading (LLM Light Tier + Fallback Threshold)
   ├── Bounded Retrieval Refinement Loop (max 2 rounds)
   ├── Evidence-Grounded Generation (Strict Context Injection & [1] Citations)
   ├── Grounding & Citation Verifier (Supported Ratio Check)
   └── Final Answer Delivery or Fail-Closed Abstention
                     │
                     ▼
 [Chroma Cloud Vector Database] (Collection: edu_chunks__gemini768 / persistent vector index)
```

---

## ⚡ Key Platform Capabilities

### 🎓 1. Student Portal
- **Syllabus-Grounded Tutor**: Multi-turn chat with source document badges, page/slide citations, and collapsible passage workbench.
- **Adaptive Topic Mastery**: Real-time mastery categorization (`weak`, `average`, `strong`) across course concepts.
- **Adaptive Quizzes & Self-Assessment**: Dynamic question generation tailored to topic weak spots.
- **Study Planner & Concept Map**: Visual concept dependencies and milestone tracking.
- **Office Hours & Meeting Booking**: Direct booking of 1-on-1 faculty assistance sessions with Microsoft Teams integration.

### 👨‍🏫 2. Faculty Portal
- **Multi-Format Document Upload**: Ingest and index PDFs, Word documents (`.docx`), PowerPoint slides (`.pptx`), spreadsheets (`.xlsx`), CSVs, and Markdown files with Cloudinary cloud storage.
- **Automated Ingestion Pipeline**: Ingestion status monitoring, structure-preserving chunking, and vector indexing.
- **Quiz Management**: Create custom quizzes or AI-generate questions grounded in uploaded lecture notes.
- **Student Analytics & Escalations**: Track course-level student mastery, view student confusion escalations, and schedule meeting availability.

### 🛡️ 3. Admin Portal
- **User Batch Management**: Register individual accounts or batch-import students via Excel (`.xlsx`) spreadsheets with auto-generated credentials and email dispatch.
- **Course & Subject Assignment**: Map courses (`CSE501` - `CSE506`) to authorized faculty members.
- **Document Approval Workflow**: Review, approve, or reject uploaded course materials before they enter the vector knowledge base.
- **Full Audit Trail**: Immutable logging of uploads, approvals, logins, and system configurations.

---

## 🔑 Demo Login Credentials

The local seed script initializes default accounts across all three roles:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@charusat.edu.in` | `password123` | Full administrative control, approvals, batch onboarding |
| **Faculty** | `faculty@charusat.edu.in` | `password123` | Course uploads, quiz creation, office hours slots |
| **Student** | `student@charusat.edu.in` | `password123` | AI Tutor chat, adaptive quizzes, meeting bookings |

*(Note: In the login portal, select the corresponding role tab before entering credentials.)*

---

## 💻 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, TanStack Router / TanStack Start, Tailwind CSS, Radix UI Primitives, Lucide Icons, KaTeX, Mermaid.js |
| **API Gateway / Backend** | Node.js (ES Modules), Express.js, Supabase / MongoDB Atlas (Mongoose ODM), JWT Auth, Cloudinary SDK |
| **Agentic RAG Service** | Python 3.10+, FastAPI, Uvicorn, LangGraph, LangChain, Pydantic |
| **Vector Store & Retrieval** | Chroma Cloud / ChromaDB, BM25Okapi, Reciprocal Rank Fusion (RRF), SHA-256 Content Deduplication |
| **LLMs & Embeddings** | Google Gemini (`gemini-2.5-flash`, `gemini-embedding-001`), Groq (`llama-3.3-70b-versatile`), OpenAI fallback |

---

## 📂 Repository Structure

```text
├── models/                     # Mongoose database models (User, Subject, Document, Quiz, Meeting)
├── routes/                     # Express API endpoint controllers (auth, tutor, documents, meetings)
├── scripts/                    # Automation utilities (dev-full.js, seed.js, sync-complete-database.js)
├── server.express.js           # Core Express backend server entrypoint (Port 5000)
├── src/                        # React web portal frontend application
│   ├── components/             # Reusable UI components (app shell, brand, passage workbench, dialogs)
│   ├── lib/                    # API clients, auth context, app data providers
│   └── routes/                 # TanStack file-based route tree (student, faculty, admin dashboards)
├── rag_service/                # Python Agentic RAG microservice (Port 8001)
│   ├── app/                    # FastAPI microservice application
│   │   ├── agent.py            # LangGraph multi-stage RAG state graph
│   │   ├── chunker.py          # Structure-aware document chunking
│   │   ├── config.py           # Pydantic environment configuration
│   │   ├── ingest.py           # Ingestion pipeline & status management
│   │   ├── main.py             # FastAPI REST endpoints (/query, /ingest, /health)
│   │   ├── parsers.py          # Multi-format extractors (PDF, PPTX, DOCX, XLSX, CSV, MD)
│   │   ├── providers.py        # Gemini, Groq, and OpenAI LLM & Embedding adapters
│   │   ├── retriever.py        # Dense + BM25Okapi Hybrid RRF retriever
│   │   └── store.py            # Chroma Cloud client wrapper
│   ├── notebooks/              # 7 ordered Jupyter notebooks (00 to 06) for testing & demonstration
│   ├── scripts/                # Verification utilities (check_providers.py, live_smoke.py)
│   ├── tests/                  # Pytest automated test suite (54 unit & integration tests)
│   └── requirements.txt        # Python dependency manifest
├── DEPLOYMENT.md               # Production deployment guide (Vercel + Render)
├── SETUP_GUIDE.md              # Cross-platform environment configuration guide
└── SETUP_GUIDE_WINDOWS.md      # Windows & PowerShell step-by-step setup guide
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **Python**: 3.10 or 3.11 with `pip` (`python --version`)
- **Database**: Supabase credentials or MongoDB Atlas connection string
- **API Keys**: Google Gemini API key, Groq API key, Chroma Cloud credentials

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```

Ensure the key variables are configured in `.env`:
```env
# Server & Security
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
INTERNAL_SERVICE_TOKEN=your_secure_internal_token

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/edusense?retryWrites=true&w=majority

# Cloudinary (Raw file storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

# AI Models & Vector Database
RAG_SERVICE_URL=http://localhost:8001
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
CHROMA_API_KEY=your_chroma_api_key
CHROMA_TENANT=your_chroma_tenant
CHROMA_DATABASE=your_chroma_database
EMBEDDING_PROVIDER=gemini
```

### 3. Install Dependencies

#### Node.js Dependencies:
```bash
npm install
```

#### Python RAG Service Dependencies:
```bash
cd rag_service
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Seed the Database
Populate initial department data, academic subjects, and default role accounts:
```bash
node scripts/seed.js
```

### 5. Launch All Services Concurrently
Start the Python Agentic RAG microservice, Express API gateway, and Vite frontend together in one command:
```bash
npm run dev
```

| Service | Port / URL | Description |
| :--- | :--- | :--- |
| **Vite Web Portal** | `http://localhost:8080` (or `5173`) | Interactive React user portal |
| **Express API Gateway** | `http://localhost:5000` | Authentication, RBAC, documents, meetings |
| **Python RAG Service** | `http://localhost:8001` | LangGraph agent, embeddings, Chroma retrieval |

---

## 🧪 Testing & Verification

### 1. Provider & Connectivity Smoke Test
Verify that your API keys, Chroma collection, and LLMs are online:
```bash
cd rag_service
python scripts/check_providers.py
```

### 2. Run Automated Pytest Suite
Execute 54 comprehensive unit and offline mock tests:
```bash
cd rag_service
pytest -q
```

### 3. Interactive Jupyter Demonstration Suite
Explore the end-to-end RAG stages in order from `rag_service/notebooks/`:
1. `00_setup_and_provider_check.ipynb` — Provider connectivity and vector dimension check
2. `01_document_parsing_and_chunking.ipynb` — Document parser evaluation across 9 formats
3. `02_embedding_and_chroma_indexing.ipynb` — Ingestion and vector storage
4. `03_retrieval_pipeline.ipynb` — Hybrid dense + BM25 RRF retrieval
5. `04_augmentation_and_generation.ipynb` — Context-injected generation and citation validation
6. `05_agentic_rag_langgraph.ipynb` — Multi-turn LangGraph agent with tool execution
7. `06_evaluation_and_regression_tests.ipynb` — Grounding evaluation metrics

---

## 🚢 Production Deployment

The platform is configured for a split deployment:
- **Frontend**: Hosted on [Vercel](https://vercel.com) using static Vite build (`npm run build`).
- **Backend & RAG Services**: Hosted on [Render](https://render.com) using the included [`render.yaml`](render.yaml) blueprint.

Refer to [`DEPLOYMENT.md`](DEPLOYMENT.md) for step-by-step production setup and environment mapping.

---

## 📄 License & Academic Attribution

Developed for **CSPIT Computer Science and Engineering Department**, Charotar University of Science and Technology (CHARUSAT).  
All rights reserved © 2026.
