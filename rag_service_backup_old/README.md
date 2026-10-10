# University Agentic RAG Platform

Production-quality Agentic Retrieval-Augmented Generation service built for the university learning portal. Powered by **LangChain**, **LangGraph**, **Chroma Cloud**, **BGE-M3**, **Hybrid Retrieval (Dense + BM25 + RRF + Reranker)**, **Provider-Routed LLMs**, and **Grounding Verification**.

---

## 🌟 Key Architecture & Capabilities

1. **Strict Access Authorization Before Retrieval (Rule 4 & 5)**:
   - Evaluates university, department, semester, and course/subject permissions *before* retrieval.
   - Prevents cross-course information leakage and blocks student access to faculty-only drafts.
2. **Hybrid Retrieval with Reciprocal Rank Fusion (RRF)**:
   - **Dense vector search**: Semantic matching using BGE-M3 embeddings loaded in Chroma Cloud (with local fallback).
   - **Sparse lexical search**: BM25 Okapi retriever for exact technical terms, course codes, and formulas.
   - **RRF Fusion**: Reciprocal Rank Fusion combining dense & sparse rankings.
   - **Reranker**: Cross-Encoder candidate refinement (top 5-10 from candidate pool of 30-50).
3. **LangGraph StateGraph Agent**:
   - Manages state progression: `load_context` → `query_analysis` → `access_validation` → `plan_retrieval` → `rewrite_or_decompose` → `hybrid_retrieve` → `evidence_check` (with retry loop) → `tool_execution` → `generation` → `grounding_check` → `final_response`.
   - Bounded retrieval retries (max 2) prevent infinite loops.
4. **Sandboxed Educational Tools**:
   - **Calculator**: AST-based formula evaluator without unsafe eval.
   - **Python Executor**: Subprocess sandbox with strict AST validation against forbidden modules (`os`, `sys`, `subprocess`, `socket`, etc.) and execution timeouts.
5. **Multi-Signal Confidence Scoring (Rule 10)**:
   - Does NOT rely solely on vector distance.
   - Combines Grounding Score (0.35), Evidence Sufficiency (0.25), Reranker Quality (0.25), and Source Diversity (0.15).
6. **Educational Modes**:
   - Ask Tutor (`ask_tutor`)
   - Explain (`explain`)
   - Summarize (`summarize`)
   - Exam Prep (`exam_prep`)
   - Quiz Me (`quiz_me`)
   - Compare (`compare`)
   - Solve (`solve`)
   - Code Help (`code_help`)
   - Study Plan (`study_plan`)
7. **Production API Contract (Section 32)**:
   - Returns citations with document name, page, section, and relevance score.
   - Returns operational `agent_trace` tags.
   - Returns follow-up prompts and grounding confirmation.

---

## 🚀 Running the Service

### 1. Install Dependencies
```bash
cd rag_service
pip install -r requirements.txt
```

### 2. Environment Configuration (.env)
```env
# Primary LLM
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash

# Fallback LLM
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant

# Vector Storage
CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
CHROMA_USE_LOCAL=true
CHROMA_LOCAL_PERSIST_DIR=./chroma_data

# Internal Auth
INTERNAL_SERVICE_TOKEN=univ-rag-internal-dev-token

# Port
SERVICE_PORT=8001
```

### 3. Start the FastAPI Service
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Run Automated Test Suite
```bash
python -m unittest rag_service/tests/test_rag_pipeline.py
```
