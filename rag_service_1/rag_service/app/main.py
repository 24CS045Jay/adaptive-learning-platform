"""FastAPI service. Keeps the exact HTTP contract the Express backend already uses:
GET /health, POST /ingest, POST /query, POST /delete-document,
GET /documents/{id}/chunks, GET /documents/{id}/ingestion-status (+ /ingest-file for direct uploads).
"""
from __future__ import annotations

import hmac
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent import LLMUnavailable, ask
from app.config import get_settings
from app.ingest import get_status, ingest_document
from app.parsers import ParseError
from app.providers import embedding_id
from app.store import get_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rag.api")

app = FastAPI(title="Course RAG Service", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=[], allow_methods=["*"], allow_headers=["*"])


def auth(x_internal_token: str = Header(default="")) -> None:
    expected = get_settings().internal_token
    if not expected:
        raise HTTPException(503, "INTERNAL_SERVICE_TOKEN is not configured on the RAG service")
    if not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(401, "Invalid internal token")


# ------------------------------------------------------------------ schemas
class IngestRequest(BaseModel):
    documentId: str
    subjectCode: str = "GENERAL"
    text: Optional[str] = None
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatMsg(BaseModel):
    role: str
    content: str = ""


class SecurityContext(BaseModel):
    user_id: str = "anonymous"
    role: str = "student"
    department_id: Optional[str] = None
    subject_ids: List[str] = Field(default_factory=list)
    model_config = {"extra": "allow"}


class QueryRequest(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None  # legacy field
    subjectCode: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    conversation_id: Optional[str] = None
    mode: str = "ask_tutor"
    learner_level: str = "intermediate"
    chat_history: List[ChatMsg] = Field(default_factory=list)
    security_context: SecurityContext = Field(default_factory=SecurityContext)
    model_config = {"extra": "allow"}


class DeleteRequest(BaseModel):
    documentId: str
    subjectCode: Optional[str] = None


# ------------------------------------------------------------------ routes
@app.get("/health")
def health() -> dict:
    s = get_settings()
    info: Dict[str, Any] = {
        "service": "course-rag",
        "version": "2.0",
        "offline_mode": s.offline,
        "embedding_provider": "hash(offline)" if s.offline else s.embedding_provider,
        "embedding_model": embedding_id(),
        "llm_providers_configured": [
            p for p, k in (("gemini", s.gemini_key), ("groq", s.groq_key), ("openai", s.openai_key)) if k
        ],
        "token_configured": bool(s.internal_token),
    }
    try:
        st = get_store()
        info.update(
            chroma_connected=st.heartbeat(),
            vector_store_mode=st.mode,
            collection=st.collection_name,
            chunk_count=st.count(),
        )
        info["status"] = "healthy" if info["chroma_connected"] and info["llm_providers_configured"] or s.offline else "degraded"
    except Exception as e:
        info.update(chroma_connected=False, status="degraded", error=str(e)[:200])
    return info


@app.post("/ingest", dependencies=[Depends(auth)])
def ingest(req: IngestRequest) -> dict:
    meta = dict(req.metadata)
    meta.setdefault("subject", req.subjectCode)
    try:
        out = ingest_document(
            req.documentId, meta, text=req.text if not req.fileUrl else None,
            file_url=req.fileUrl, file_name=req.fileName or str(meta.get("fileName", "")),
        )
    except ParseError as e:
        raise HTTPException(422, f"Cannot parse document: {e}")
    except Exception as e:
        log.exception("ingest failed")
        raise HTTPException(502, f"Ingestion failed: {str(e)[:300]}")
    return out


@app.post("/ingest-file", dependencies=[Depends(auth)])
async def ingest_file(
    file: UploadFile = File(...),
    documentId: str = Form(...),
    subjectCode: str = Form("GENERAL"),
    metadata: str = Form("{}"),
) -> dict:
    data = await file.read()
    try:
        meta = json.loads(metadata or "{}")
    except Exception:
        raise HTTPException(400, "metadata must be a JSON string")
    meta.setdefault("subject", subjectCode)
    try:
        return ingest_document(documentId, meta, data=data, file_name=file.filename or "")
    except ParseError as e:
        raise HTTPException(422, f"Cannot parse document: {e}")
    except Exception as e:
        log.exception("ingest-file failed")
        raise HTTPException(502, f"Ingestion failed: {str(e)[:300]}")


@app.post("/query", dependencies=[Depends(auth)])
def query(req: QueryRequest) -> dict:
    q = (req.query or req.question or "").strip()
    if not q:
        raise HTTPException(400, "query is required")
    sc = req.security_context
    codes = [req.subjectCode] if req.subjectCode else []
    sids = [] if codes else (sc.subject_ids or ([req.subject_id] if req.subject_id else []))
    if sc.role == "student" and not codes and not sids:
        raise HTTPException(400, "A subject is required for student queries")  # fail closed
    hist = [{"role": m.role, "content": m.content} for m in req.chat_history if m.content]
    try:
        out = ask(q, subject_codes=codes, subject_ids=sids, history=hist, learner_level=req.learner_level)
    except LLMUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        log.exception("query failed")
        raise HTTPException(500, f"Query failed: {str(e)[:300]}")
    out.update(mode=req.mode, tool_used=None, follow_up=[])
    return out


@app.post("/delete-document", dependencies=[Depends(auth)])
def delete_document(req: DeleteRequest) -> dict:
    n = get_store().delete_document(req.documentId)
    return {"documentId": req.documentId, "deletedChunks": n}


@app.get("/documents/{doc_id}/chunks", dependencies=[Depends(auth)])
def doc_chunks(doc_id: str) -> dict:
    docs = get_store().chunks_of(doc_id)
    return {
        "document_id": doc_id,
        "count": len(docs),
        "embedding_model": embedding_id(),
        "chunks": [
            {
                "id": d.metadata.get("chunk_id"),
                "index": d.metadata.get("chunk_index", i),
                "text": d.page_content,
                "metadata": {**d.metadata, "section": d.metadata.get("heading", "")},
            }
            for i, d in enumerate(docs)
        ],
    }


@app.get("/documents/{doc_id}/ingestion-status", dependencies=[Depends(auth)])
def doc_status(doc_id: str) -> dict:
    return get_status(doc_id)


@app.post("/documents/{doc_id}/active", dependencies=[Depends(auth)])
def set_active(doc_id: str, body: Dict[str, bool]) -> dict:
    n = get_store().set_active(doc_id, bool(body.get("is_active", True)))
    return {"document_id": doc_id, "updated_chunks": n}
