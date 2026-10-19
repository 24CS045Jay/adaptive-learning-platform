"""FastAPI service. Keeps the exact HTTP contract the Express backend already uses:
GET /health, POST /ingest, POST /query, POST /delete-document,
GET /documents/{id}/chunks, GET /documents/{id}/ingestion-status (+ /ingest-file for direct uploads).
"""
from __future__ import annotations

import hmac
import json
import logging
import re
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
    response_language: str = "en"
    learner_profile: Optional[Dict[str, Any]] = None
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
        out = ask(
            q,
            subject_codes=codes,
            subject_ids=sids,
            history=hist,
            learner_level=req.learner_level,
            response_language=req.response_language,
            mode=req.mode,
            learner_profile=req.learner_profile,
        )
    except LLMUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        log.exception("query failed")
        raise HTTPException(500, f"Query failed: {str(e)[:300]}")
    out.setdefault("follow_up", [])
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


class RollbackRequest(BaseModel):
    target_version_id: str


@app.get("/documents/{doc_id}/versions", dependencies=[Depends(auth)])
def doc_versions(doc_id: str) -> dict:
    from app.versioning import get_version_registry
    return get_version_registry().get_document_history(doc_id)


@app.post("/documents/{doc_id}/rollback", dependencies=[Depends(auth)])
def doc_rollback(doc_id: str, req: RollbackRequest) -> dict:
    from app.versioning import get_version_registry
    try:
        ver = get_version_registry().rollback(doc_id, req.target_version_id)
        get_store().set_active_version(doc_id, req.target_version_id)
        return {
            "document_id": doc_id,
            "active_version_id": ver.version_id,
            "version_number": ver.version_number,
            "status": ver.status,
            "message": f"Successfully rolled back to version {ver.version_number} ({ver.version_id})",
        }
    except Exception as e:
        raise HTTPException(400, f"Rollback failed: {str(e)}")


@app.get("/evaluate/benchmark", dependencies=[Depends(auth)])
def eval_benchmark(k: int = 5, samples: int = 15) -> dict:
    from app.evaluation.evaluator import RAGEvaluator
    evaluator = RAGEvaluator()
    return evaluator.evaluate_retrieval(k=k, max_samples=samples)


# ------------------------------------------------------------------ Feature I: Adaptive Learning Endpoints
class UpdateMasteryRequest(BaseModel):
    student_id: str
    topic: str
    evidence_type: str = "quiz"
    score: float
    detail: str = ""
    current_profile: Optional[Dict[str, Any]] = None


@app.post("/adaptive/update-mastery", dependencies=[Depends(auth)])
def update_mastery(req: UpdateMasteryRequest) -> dict:
    from app.learner_adaptive import LearnerKnowledgeProfile, update_learner_profile_mastery
    prof = LearnerKnowledgeProfile.from_dict(req.current_profile, student_id=req.student_id)
    updated = update_learner_profile_mastery(
        prof,
        topic=req.topic,
        evidence_type=req.evidence_type,
        score=req.score,
        detail=req.detail,
    )
    return {
        "student_id": req.student_id,
        "updated_profile": updated.to_dict(),
    }


class EvaluateCheckRequest(BaseModel):
    student_id: str
    question: str
    student_answer: str
    concept: str = ""
    current_profile: Optional[Dict[str, Any]] = None


@app.post("/adaptive/evaluate-check", dependencies=[Depends(auth)])
def evaluate_check(req: EvaluateCheckRequest) -> dict:
    from app.learner_adaptive import LearnerKnowledgeProfile, update_learner_profile_mastery
    from app.providers import get_llm, llm_text

    eval_prompt = (
        "TASK:EVALUATE_CONCEPT_CHECK\n"
        "Evaluate the student's answer to the formative concept check question.\n"
        f"QUESTION: {req.question}\n"
        f"STUDENT ANSWER: {req.student_answer}\n"
        f"CONCEPT: {req.concept or 'Course Concept'}\n\n"
        "Score the answer from 0 to 100 based on conceptual correctness and understanding.\n"
        "Provide constructive pedagogical feedback in 2-3 sentences.\n"
        'Reply ONLY JSON: {"score": 85, "correct": true, "feedback": "..."}'
    )
    score = 75.0
    correct = True
    feedback = "Good effort on explaining this concept!"
    try:
        raw = llm_text(get_llm("light").invoke(eval_prompt))
        text = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.M).strip()
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            data = json.loads(m.group(0))
            score = float(data.get("score", 75.0))
            correct = bool(data.get("correct", score >= 70.0))
            feedback = data.get("feedback", feedback)
    except Exception as e:
        log.warning("Evaluate check LLM error: %s", e)

    prof = LearnerKnowledgeProfile.from_dict(req.current_profile, student_id=req.student_id)
    updated = update_learner_profile_mastery(
        prof,
        topic=req.concept or "Understanding Check",
        evidence_type="understanding_check",
        score=score,
        detail=f"Check: {req.question[:60]} -> {'Correct' if correct else 'Review needed'}",
    )

    return {
        "student_id": req.student_id,
        "score": score,
        "correct": correct,
        "feedback": feedback,
        "updated_profile": updated.to_dict(),
    }



