# EduSense AI — Windows & PowerShell Setup Guide (`SETUP_GUIDE_WINDOWS.md`)

This guide provides the complete setup, verification, and execution workflow for the EduSense AI Agentic RAG Platform on **Windows 10/11 using PowerShell**.

---

## 1. Prerequisites

Ensure you have the following installed on your Windows machine:
1. **Node.js**: v18.0.0 or higher (`node -v`)
2. **Python**: 3.10 or 3.11 with pip (`python --version`)
3. **PowerShell**: PowerShell 5.1 or PowerShell 7+

---

## 2. Environment Configuration

From the project root directory (`D:\sem_5\project-1\v1`):

```powershell
# Copy the sanitized template to .env
Copy-Item .env.example .env
Copy-Item .env.example rag_service\.env
```

Open `.env` (and `rag_service\.env`) in VS Code or your editor and ensure your API keys are configured:
```env
# Required for LLM & Grounded Answers
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Required for Vector Database (Chroma Cloud)
CHROMA_API_KEY=your_chroma_api_key
CHROMA_TENANT=your_chroma_tenant_id
CHROMA_DATABASE=edusense-ai-rag

# Embedding Model
EMBEDDING_PROVIDER=gemini
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIM=768
```

---

## 3. Dependency Installation

### Step 3.1: Install Node.js Dependencies (Root)
```powershell
cd D:\sem_5\project-1\v1
npm install
```

### Step 3.2: Install Python RAG Microservice Dependencies
```powershell
cd D:\sem_5\project-1\v1\rag_service
pip install -r requirements.txt
```

---

## 4. Run Automated Health Checks and Tests

### Step 4.1: Verify External Providers & Chroma Cloud Connectivity
```powershell
cd D:\sem_5\project-1\v1\rag_service
python scripts/check_providers.py
```
*Expected Output: `ALL GOOD - you can start the service`*

### Step 4.2: Run the Automated Pytest Suite
```powershell
cd D:\sem_5\project-1\v1\rag_service
pytest -v
```
*Expected Output: `54 passed in ~25s (100% PASS)`*

---

## 5. Starting All Services

To run all 3 platform services together (Python RAG, Express Backend, Vite Web Portal):

```powershell
cd D:\sem_5\project-1\v1
npm run dev
```

This launches:
| Service | URL | Role |
| :--- | :--- | :--- |
| **Python Agentic RAG Service** | `http://localhost:8001` | LangGraph agent, chunking, retrieval, embeddings |
| **Express Backend API** | `http://localhost:5000` | Node.js API gateway, authentication, Supabase |
| **Vite React Web Portal** | `http://localhost:8080` | Faculty & Student interactive web UI |

---

## 6. Accessing the Web Portal

Open your web browser and navigate to:
- **Web Portal Home**: [http://localhost:8080](http://localhost:8080)
- **Student Ask Tutor**: [http://localhost:8080/student/ask](http://localhost:8080/student/ask)
- **Faculty Documents**: [http://localhost:8080/faculty/documents](http://localhost:8080/faculty/documents)
- **RAG Microservice Health**: [http://localhost:8001/health](http://localhost:8001/health)

---

## 7. Running the Ordered Jupyter Notebook Suite

The 7 ordered notebooks are located in `rag_service/notebooks/`.

To launch Jupyter Lab or Notebook:
```powershell
cd D:\sem_5\project-1\v1\rag_service
jupyter lab
```

Execute the notebooks in numerical sequence:
1. `00_setup_and_provider_check.ipynb` — Verifies keys, models, and probe records.
2. `01_document_parsing_and_chunking.ipynb` — Demonstrates structure-aware parsing across 9 formats.
3. `02_embedding_and_chroma_indexing.ipynb` — Ingests course documents and validates vector counts.
4. `03_retrieval_pipeline.ipynb` — Hybrid dense + BM25 retrieval with authorization scoping.
5. `04_augmentation_and_generation.ipynb` — Prompt assembly, generation, and citation grounding.
6. `05_agentic_rag_langgraph.ipynb` — Full multi-turn LangGraph agent with execution trace.
7. `06_evaluation_and_regression_tests.ipynb` — Benchmark evaluation and regression test suite.

---

## 8. Troubleshooting Common Windows Issues

### Issue: Port 5000 or 8001 is already in use
Run the following PowerShell commands to find and kill the blocking process:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 8001).OwningProcess | Stop-Process -Force
```

### Issue: `execution of scripts is disabled on this system` (PowerShell ExecutionPolicy)
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
