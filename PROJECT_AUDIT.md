# Educational Intelligent RAG — System Audit Report (`PROJECT_AUDIT.md`)

## 1. Current Architecture
The platform is an intelligent educational learning portal designed for university students and faculty:
- **Frontend**: React + TanStack Router + Vite (`http://localhost:8080` / `8081`).
- **Express Backend**: Node.js Express server (`http://localhost:5000`) managing authentication, RBAC, courses, users, and audit logging.
- **Python RAG Microservice**: FastAPI server (`http://localhost:8001`) managing document parsing, structural chunking, embedding generation, Chroma vector storage, BM25 sparse index, hybrid RRF retrieval, CrossEncoder reranking, and LangGraph educational agent execution.

```text
Student / Faculty UI
      ↓
Express Backend API (port 5000)
      ↓ (Internal Token: X-Internal-Token)
FastAPI Python Microservice (port 8001)
      ↓
LangGraph Agent Engine (Scope Gate -> Security Filter -> Query Rewrite)
      ↓
Hybrid Retrieval (Chroma Dense + BM25 Sparse -> RRF -> CrossEncoder Reranker)
      ↓
Evidence Evaluation (Threshold >= 0.4) -> Grounded LLM Generation -> Grounding Verification
      ↓
Express DB Persist -> UI Response
```

## 2. Existing Modules
- `rag_service/app/main.py`: FastAPI entrypoint, lifespan startup/shutdown, dependency pre-warming.
- `rag_service/app/api/routes.py`: REST routes (`/health`, `/ready`, `/query`, `/ingest/file`, `/documents/{id}/chunks`, `/documents/{id}/ingestion-status`, etc.).
- `rag_service/app/agents/graph.py`: LangGraph StateGraph connecting 13 lifecycle nodes.
- `rag_service/app/agents/nodes.py`: Execution nodes for query analysis, scope gating, access validation, retrieval, evidence check, generation, grounding.
- `rag_service/app/scope/router.py`: Deterministic classifier for `GREETING`, `SMALL_TALK`, `OFF_TOPIC`, `UNCLEAR`, `ACADEMIC`.
- `rag_service/app/scope/policies.py`: Standard policy responses for scope refusals and greetings.
- `rag_service/app/vectorstore/chroma.py`: Chroma client wrapper (Cloud HttpClient and local PersistentClient fallback).
- `rag_service/app/embeddings/manager.py`: BGE-M3 (1024-d) and MiniLM (384-d) embedding manager.
- `rag_service/app/retrieval/bm25.py`: BM25Okapi sparse lexical retriever with Chroma sync.
- `rag_service/app/retrieval/dense.py`: Semantic vector search query handler.
- `rag_service/app/retrieval/hybrid.py`: Hybrid retriever combining Dense + BM25 with Reciprocal Rank Fusion.
- `rag_service/app/retrieval/reranker.py`: CrossEncoder reranker with heuristic fallback.
- `rag_service/app/providers/pool.py`: Multi-key LLM pool with failover and concurrency limits.
- `rag_service/app/providers/circuit_breaker.py`: Circuit breaker tracking key health and rate-limit cooldowns.
- `rag_service/app/providers/health.py`: Masked key telemetry monitor.
- `rag_service/app/ingestion/pipeline.py`: Canonical ingestion pipeline.
- `rag_service/app/ingestion/parsers.py`: Format parsers for PDF, DOCX, PPTX, XLSX, TXT, CSV.
- `rag_service/app/ingestion/chunker.py`: Structural and recursive text chunker.

## 3. Working Modules
- Deterministic Scope Router (`scope/router.py`): Correctly intercepts greetings and off-topic questions in $<1$ ms without invoking vector search.
- LangGraph Workflow (`agents/graph.py`): Compiles StateGraph and executes fallback sequentially if graph runtime encounters an error.
- Express API Authentication & RBAC: Token verification, conversation ownership check, role authorization.
- BM25 Rebuild Lifecycle: Rebuilds index from Chroma chunks on startup and dynamic addition during ingestion.
- Multi-signal Confidence Metric: Integrates evidence coverage, retrieval score, grounding score, and tool verification.

## 4. Broken Modules / Confirmed Defects
- **Issue A (Chroma Collection Mismatch)**: `get_unified_collection()` in `chroma.py` creates `rag_unified`, but `ChromaStore.query()` and `get_document_chunks()` defaulted to `rag_default`. This creates a split-brain condition where ingested vectors are stored in one collection and queried from another.
- **Issue B (Dense Score Bug)**: `dense.py` converts distance using `1 - (dist / 2.0)` instead of `cosine_similarity = 1 - dist` for normalized vectors.
- **Issue C (Reranker Score Normalization Bug)**: `CrossEncoderReranker` sets `rerank_score = float(score)` using raw unnormalized logits, causing downstream confidence calculations to be distorted. Also lacks observable telemetry when falling back to heuristic mode.
- **Issue D (LLM Key Fair-Sharing Problem)**: `select_best_key()` sorts by `(concurrency, latency)`. When all keys are idle, Key 0 is always chosen, causing key imbalance and rate limit bottlenecks on Key 0.
- **Issue E (Bypass via `lib/llm.js`)**: Express backend contained `lib/llm.js` using hardcoded deprecated Gemini 2.0 and Groq llama-3.1 endpoints instead of routing all generation through the Python RAG microservice.
- **Issue F (Missing OCR Fallback)**: PDF parser did not implement fallback OCR when textual extraction produced empty content.
- **Issue G (Missing Content Hash & Verification)**: `pipeline.py` did not calculate SHA-256 content hashes to prevent redundant re-indexing and did not verify chunk counts against vector counts post-indexing.

## 5. Missing Modules
- `GET /ready` endpoint: A separate readiness probe that validates Chroma connection, collection availability, embedding model, and LLM provider health.
- `GET /providers/status` endpoint: Masked provider and key status reporting for admin debugging.
- Comprehensive 8 Jupyter notebooks in `rag_service/notebooks/` matching Section 35 specification.
- Dedicated `verify_document_index(document_id)` index health verification routine.

## 6. Duplicate Modules
- `lib/llm.js` in Node vs Python `app/llm/router.py`: Dual LLM routing must be unified into the Python microservice.
- Multiple collection references (`rag_unified`, `rag_default`, `pfx_subject_id`): Must be unified into a single canonical collection: `rag_unified_v1`.

## 7. Legacy Modules
- Local `rag_service/chroma_data/chroma.sqlite3` containing vectors from older experiments: Must be version-isolated into `rag_unified_v1`.
- Deprecated LLM model names (`gemini-2.0-flash`, `llama-3.1-8b-instant`): Upgraded to active endpoints `gemini-3.8-flash` and `qwen/qwen3.8-27b`.

## 8. Pipeline Status
- Parsing: Implemented; needs OCR fallback for scanned PDFs.
- Cleaning: Implemented.
- Chunking: Implemented; needs metadata contract fields (`content_hash`, `document_version`, `is_active`).
- Embedding: Operational with MiniLM fallback; needs consistent collection dimension isolation.
- Indexing: Requires unification under `rag_unified_v1`.
- Retrieval: Dense + BM25 + RRF functional; dense score formula needs correction.
- Reranking: Functional; score normalization (sigmoid) and fallback telemetry needed.
- Generation: Routed through LangGraph; fails closed on missing evidence.

## 9. Dependency & Environment Problems
- Need `pip install -r requirements.txt` alignment with explicit versions for `langchain_core`, `langchain_google_genai`, `langchain_groq`, `chromadb`, `sentence_transformers`.
- Need clear environment contract: `CHROMA_MODE=cloud|local`, `RAG_ENV=production|development`.

## 10. Recommended Execution Order
Follow the exact 28-step master execution sequence outlined in Section 70 of `RAG_COMPLETE_REPAIR_MASTER_TASK.md`.
