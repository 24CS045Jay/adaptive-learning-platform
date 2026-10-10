# Agentic RAG — what YOU need to do (in order)

## 0. Rotate your secrets first (5 min)
The zip you shared contained a real `.env` (and `.git`). Treat those keys as exposed: after setup, regenerate
the Gemini, Groq, OpenAI and Chroma keys and the `INTERNAL_SERVICE_TOKEN`, then update `.env`.

## 1. Accounts and keys
| What | Where | You need |
|---|---|---|
| Gemini (LLM + embeddings) | https://aistudio.google.com/apikey | `GEMINI_API_KEY` |
| Groq (fast fallback LLM) | https://console.groq.com/keys | `GROQ_API_KEY` |
| OpenAI (optional 3rd fallback) | https://platform.openai.com/api-keys | `OPENAI_API_KEY` |
| Chroma Cloud (vector DB) | https://www.trychroma.com → create a **database** | `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` |

Minimum to work: **one** LLM key + (Gemini key *or* OpenAI key for embeddings) + the 3 Chroma values.

## 2. Edit the repo-root `.env` (the one Express already uses; Python reads it too)
```
INTERNAL_SERVICE_TOKEN=<long random string>        # SAME value for Express and Python (one file = automatic)
RAG_SERVICE_URL=http://localhost:8001
GEMINI_API_KEY=...        GROQ_API_KEY=...        OPENAI_API_KEY=            # blank is fine
CHROMA_API_KEY=...        CHROMA_TENANT=...       CHROMA_DATABASE=...
EMBEDDING_PROVIDER=gemini                          # gemini | openai | local
LLM_PROVIDER_ORDER=gemini,groq,openai
```
All other options and defaults are in `rag_service/.env.example`. **Choose the embedding provider before the
first upload.** Each embedding model gets its own Chroma collection (`edu_chunks__gemini768`, ...), so switching
later is safe but documents must be re-ingested (admin "Re-index" button).

## 3. Install and verify (on your machine, with real keys)
```bash
cd rag_service
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # tested versions: requirements.lock.txt
python scripts/check_providers.py      # every key/model/Chroma call, with a clear [OK]/[FAIL] per line
python scripts/live_smoke.py      # real ingest + 10 questions + refusal + leakage; cleans up after itself
pytest -q                              # 54 offline tests (never touch your cloud DB)
```
If `check_providers.py` says a model name is invalid, change `GEMINI_*_MODEL` / `GROQ_*_MODEL` in `.env`
(model names change often; I could not verify them from my sandbox). The old code's defaults
`gemini-3.8-flash` / `qwen/qwen3.8-27b` are my prime suspects for the failures you saw.

## 4. Notebooks (learn / debug each stage)
```bash
cd rag_service/notebooks
NB_OFFLINE=0 jupyter lab        # 0 = real providers, 1 (default) = offline mock
```
Run `00 → 05` in order. They share one store, so 01 (ingest) feeds 02–05.

## 5. Run the whole app
```bash
npm run dev:full                # or: cd rag_service && python -m uvicorn app.main:app --port 8001
```
Faculty uploads a file → Express stores it and calls `POST /ingest` with the file URL → Python parses, chunks,
embeds, writes to Chroma → student asks a question → Express calls `POST /query` → LangGraph agent answers
with citations. Upload types now accepted: PDF, PPTX, DOCX, XLSX, CSV, TXT, MD, HTML.

**Render deploy:** `render.yaml` already points at `rag_service`; add the same env vars in the Render dashboard
(including `INTERNAL_SERVICE_TOKEN`) for both services. Use `pip install -r requirements.txt` as build command.

## 6. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Upload shows `failed`, 0 chunks | Open `/documents/<id>/ingestion-status` – `error` says why (scanned PDF without text, wrong embedding key, Chroma auth). |
| Every answer = "couldn't find this in the course material" | Wrong `subjectCode` between upload and question, doc not `approved/active`, or nothing ingested. Check `/health` → `chunk_count`. |
| HTTP 401 from RAG service | `INTERNAL_SERVICE_TOKEN` differs between Express and Python processes. |
| HTTP 503 on /query | All LLM providers failed (bad key/quota/model name). Run `check_providers.py`. |
| Dimension / collection errors | Don't reuse a collection across embedding models; this is prevented automatically. |
| Scanned (image) PDFs | No text layer → rejected with a clear message. OCR them first. |
