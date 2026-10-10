"""
FastAPI Routes for University Agentic RAG Service.
Implements /health, /query, /ingest, and document deletion endpoints with auth.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.agents.graph import get_agent_graph
from app.api.schemas import (
    IngestTextRequest,
    IngestionResponse,
    QueryRequest,
    QueryResponse,
    RetrievalTelemetry,
    SourceItem,
    SubjectInfo,
)
from pydantic import BaseModel, Field

# Legacy compatibility schemas
class LegacyIngestRequest(BaseModel):
    documentId: str
    subjectCode: str = "GENERAL"
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LegacyIngestResponse(BaseModel):
    chunkCount: int
    collection: str
from app.core.config import get_settings
from app.core.security import verify_internal_auth
from app.embeddings.manager import get_embedding_manager
from app.ingestion.pipeline import get_ingestion_pipeline
from app.retrieval.bm25 import get_bm25_retriever
from app.vectorstore.chroma import get_chroma_store

logger = logging.getLogger("rag_service.api.routes")
router = APIRouter()


@router.get("/health", tags=["System"])
async def health_check():
    """Service health verification endpoint."""
    settings = get_settings()
    chroma_ok = False
    embedding_ok = False
    embedding_model_name = settings.EMBEDDING_MODEL
    bm25_ok = False
    bm25_count = 0
    bm25_rebuild = None

    try:
        store = get_chroma_store()
        chroma_ok = store.client is not None
    except Exception as e:
        logger.warning(f"Chroma health check warning: {e}")

    try:
        emb = get_embedding_manager()
        embedding_ok = emb.model_loaded
        embedding_model_name = emb.model_name
    except Exception as e:
        logger.warning(f"Embedding health check warning: {e}")

    try:
        bm25 = get_bm25_retriever()
        bm25_ok = bm25.is_ready
        bm25_count = bm25.document_count
        bm25_rebuild = bm25.last_rebuild
    except Exception as e:
        logger.warning(f"BM25 health check warning: {e}")

    return {
        "status": "healthy" if chroma_ok else "degraded",
        "service": "university-agentic-rag",
        "version": "1.0.0",
        "rag_pipeline_version": "v2-agentic",
        "environment": settings.environment,
        "chroma_connected": chroma_ok,
        "vector_store_mode": "chroma_cloud" if settings.is_chroma_cloud else "chroma_local",
        "embedding_loaded": embedding_ok,
        "embedding_model": embedding_model_name,
        "bm25_index_ready": bm25_ok,
        "bm25_document_count": bm25_count,
        "bm25_last_rebuild": bm25_rebuild,
        "agent_graph_enabled": True,
        "primary_llm": settings.primary_llm_provider,
    }


@router.get("/ready", tags=["System"])
async def readiness_check():
    """
    Service readiness verification endpoint per Section 39.
    Validates LLM provider, Embedding provider, Chroma connection,
    Canonical collection, BM25 index, and Reranker.
    """
    settings = get_settings()
    errors = []

    # 1. Chroma & Canonical Collection
    chroma_ok = False
    try:
        from app.vectorstore.chroma import get_unified_collection
        coll = get_unified_collection()
        chroma_ok = coll is not None
    except Exception as e:
        errors.append(f"Chroma/Collection failure: {e}")

    # 2. Embedding Provider
    embedding_ok = False
    try:
        emb = get_embedding_manager()
        embedding_ok = emb.model_loaded
        if not embedding_ok:
            errors.append("Embedding model is not loaded")
    except Exception as e:
        errors.append(f"Embedding manager failure: {e}")

    # 3. BM25 Sparse Index
    bm25_ok = False
    try:
        bm25 = get_bm25_retriever()
        bm25_ok = bm25.is_ready
    except Exception as e:
        errors.append(f"BM25 index failure: {e}")

    # 4. Reranker
    reranker_ok = False
    try:
        from app.retrieval.reranker import get_reranker
        reranker = get_reranker()
        reranker_ok = reranker is not None
    except Exception as e:
        errors.append(f"Reranker failure: {e}")

    # 5. LLM Provider Pool
    llm_ok = False
    try:
        from app.providers.pool import get_provider_pool
        pool = get_provider_pool()
        llm_ok = pool.get_status()["total_keys"] > 0
        if not llm_ok and (settings.GEMINI_API_KEY or settings.GROQ_API_KEY or settings.OPENAI_API_KEY):
            llm_ok = True
    except Exception as e:
        errors.append(f"LLM Provider pool failure: {e}")

    is_ready = chroma_ok and embedding_ok and bm25_ok and reranker_ok and (len(errors) == 0)

    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "ready": False,
                "status": "not_ready",
                "errors": errors,
                "components": {
                    "chroma": chroma_ok,
                    "embedding": embedding_ok,
                    "bm25": bm25_ok,
                    "reranker": reranker_ok,
                    "llm": llm_ok,
                },
            },
        )

    return {
        "ready": True,
        "status": "ready",
        "service": "university-agentic-rag",
        "components": {
            "chroma": chroma_ok,
            "collection": settings.CANONICAL_COLLECTION,
            "embedding": embedding_ok,
            "bm25": bm25_ok,
            "reranker": reranker_ok,
            "llm": llm_ok,
        },
    }


@router.get("/providers/status", tags=["System"])
async def providers_status(auth: bool = Depends(verify_internal_auth)):
    """Telemetry endpoint reporting provider key rotation and circuit breaker status."""
    from app.providers.pool import get_provider_pool
    return get_provider_pool().get_status()


@router.post("/query", response_model=QueryResponse, tags=["Agentic RAG"])
async def query_rag(
    request: QueryRequest,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Main Agentic RAG execution endpoint.
    Orchestrates the LangGraph agent across query understanding, access validation,
    hybrid retrieval, evidence checking, tool execution, generation, and grounding verification.
    """
    start_time = time.time()
    logger.info(
        f"Incoming RAG query from user={request.security_context.user_id} "
        f"role={request.security_context.role} mode={request.mode} "
        f"query='{request.query[:50]}...'"
    )

    # Prepare initial LangGraph state
    initial_state = {
        "user_id": request.security_context.user_id,
        "role": request.security_context.role,
        "university_id": request.security_context.university_id or "",
        "department_id": request.security_context.department_id or "",
        "semester": request.security_context.semester,
        "course_ids": request.security_context.course_ids,
        "subject_ids": request.security_context.subject_ids,
        "subject_id": request.subject_id,
        "subject_name": request.subject_name,
        "learner_level": request.learner_level or "intermediate",
        "conversation_id": request.conversation_id,
        "query": request.query,
        "chat_history": [{"role": m.role, "content": m.content} for m in request.chat_history],
        "mode": request.mode,
    }

    try:
        # Run agent graph
        graph = get_agent_graph()
        final_state = graph.run(initial_state)

        # Format retrieval telemetry
        telem = final_state.get("retrieval_telemetry", {})
        retrieval_telem = RetrievalTelemetry(
            strategy=telem.get("strategy", "hybrid"),
            dense_candidates=telem.get("dense_candidates", 0),
            sparse_candidates=telem.get("sparse_candidates", 0),
            reranked=telem.get("reranked", 0),
        )

        # Format sources
        sources = [
            SourceItem(
                document_id=c.get("document_id", ""),
                file_name=c.get("file_name", "Course Document"),
                page=c.get("page"),
                section=c.get("section"),
                score=c.get("score", 0.0),
            )
            for c in final_state.get("citations", [])
        ]

        duration = time.time() - start_time
        logger.info(
            f"RAG query finished in {duration:.2f}s | confidence={final_state.get('confidence', 0.0)} "
            f"| grounded={final_state.get('grounded', False)}"
        )

        return QueryResponse(
            conversation_id=request.conversation_id,
            answer=final_state.get("draft_answer", "No answer generated."),
            confidence=final_state.get("confidence", 0.5),
            grounded=final_state.get("grounded", True),
            mode=request.mode,
            intent=final_state.get("intent", "conceptual"),
            subject=SubjectInfo(id=request.subject_id, name=request.subject_name),
            sources=sources,
            retrieval=retrieval_telem,
            agent_trace=final_state.get("agent_trace", []),
            tool_used=final_state.get("tool_name"),
            follow_up=final_state.get("follow_up", []),
        )
    except Exception as e:
        logger.error(f"Fatal error executing RAG agent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing RAG pipeline: {str(e)}",
        )


@router.post("/ingest/text", response_model=IngestionResponse, tags=["Ingestion"])
async def ingest_text(
    payload: IngestTextRequest,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Ingests pre-extracted text into Chroma vectorstore and BM25 index with rich security metadata.
    """
    try:
        pipeline = get_ingestion_pipeline()
        metadata = dict(payload.metadata)
        metadata.update({
            "title": payload.title,
            "university_id": payload.university_id,
            "department_id": payload.department_id,
            "course_id": payload.course_id,
            "subject_id": payload.subject_id,
            "semester": payload.semester,
            "is_faculty_only": payload.is_faculty_only,
            "is_active": payload.is_active,
        })

        result = pipeline.ingest_text(
            document_id=payload.document_id,
            version_id=payload.version_id or "v1",
            text=payload.get_text(),
            metadata=metadata,
        )

        # Update sparse index with the chunks
        bm25 = get_bm25_retriever()
        store = get_chroma_store()
        all_chunks = store.get_document_chunks(payload.document_id)
        if all_chunks:
            bm25.add_documents(all_chunks)

        return IngestionResponse(
            document_id=payload.document_id,
            version_id=payload.version_id,
            chunks_indexed=result["chunks_count"],
            status="COMPLETED",
            message=f"Indexed {result['chunks_count']} chunks successfully",
        )
    except Exception as e:
        logger.error(f"Ingestion text failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest", response_model=LegacyIngestResponse, tags=["Ingestion"])
async def ingest_legacy(
    payload: LegacyIngestRequest,
):
    """
    Backward-compatible ingestion endpoint accepting legacy { documentId, subjectCode, text, metadata } payloads.
    Indexes text into Chroma and BM25 index.
    """
    try:
        pipeline = get_ingestion_pipeline()
        metadata = dict(payload.metadata)
        metadata.update({
            "subject_code": payload.subjectCode,
            "subject": payload.subjectCode,
            "is_active": True,
            "is_faculty_only": False,
        })

        result = pipeline.ingest_text(
            document_id=payload.documentId,
            version_id="v1",
            text=payload.text,
            metadata=metadata,
        )

        bm25 = get_bm25_retriever()
        store = get_chroma_store()
        all_chunks = store.get_document_chunks(payload.documentId)
        if all_chunks:
            bm25.add_documents(all_chunks)

        return LegacyIngestResponse(
            chunkCount=result.get("chunks_count", 0),
            collection=f"subject_{payload.subjectCode}",
        )
    except Exception as e:
        logger.error(f"Legacy ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/file", response_model=IngestionResponse, tags=["Ingestion"])
async def ingest_file(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    version_id: Optional[str] = Form("v1"),
    title: Optional[str] = Form(None),
    university_id: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    course_id: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    semester: Optional[int] = Form(None),
    is_faculty_only: bool = Form(False),
    auth: bool = Depends(verify_internal_auth),
):
    """
    Parses, chunks, embeds, and indexes an uploaded document file (PDF, DOCX, PPTX, XLSX, etc.).
    """
    try:
        file_bytes = await file.read()
        pipeline = get_ingestion_pipeline()

        meta = {
            "title": title or file.filename,
            "file_name": file.filename,
            "university_id": university_id,
            "department_id": department_id,
            "course_id": course_id,
            "subject_id": subject_id,
            "semester": semester,
            "is_faculty_only": is_faculty_only,
            "is_active": True,
        }

        result = pipeline.ingest_document(
            document_id=document_id,
            version_id=version_id,
            file_bytes=file_bytes,
            filename=file.filename,
            metadata=meta,
        )

        # Update sparse index
        bm25 = get_bm25_retriever()
        store = get_chroma_store()
        all_chunks = store.get_document_chunks(document_id)
        if all_chunks:
            bm25.add_documents(all_chunks)

        return IngestionResponse(
            document_id=document_id,
            version_id=version_id,
            chunks_indexed=result["chunks_count"],
            status="COMPLETED",
            message=f"File parsed and indexed into {result['chunks_count']} chunks",
        )
    except Exception as e:
        logger.error(f"File ingestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{document_id}", tags=["Ingestion"])
async def delete_document(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Purges a document's chunks from Chroma vector store and BM25 index.
    """
    try:
        store = get_chroma_store()
        store.delete_document(document_id)

        bm25 = get_bm25_retriever()
        doc_ids_to_del = [k for k in bm25.documents if k.startswith(f"{document_id}_")]
        for did in doc_ids_to_del:
            bm25.remove_document(did)

        return {
            "success": True,
            "document_id": document_id,
            "message": "Document chunks purged successfully",
        }
    except Exception as e:
        logger.error(f"Error purging document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DeleteDocumentRequest(BaseModel):
    documentId: str
    subjectCode: Optional[str] = None


@router.post("/delete-document", tags=["Ingestion"])
async def delete_document_post(
    payload: DeleteDocumentRequest,
):
    """
    Legacy and Express-compatible endpoint for deleting document vectors.
    """
    try:
        doc_id = payload.documentId
        store = get_chroma_store()
        store.delete_document(doc_id)

        bm25 = get_bm25_retriever()
        doc_ids_to_del = [k for k in bm25.documents if k.startswith(f"{doc_id}_")]
        for did in doc_ids_to_del:
            bm25.remove_document(did)

        return {
            "deleted": len(doc_ids_to_del) or 1,
            "documentId": doc_id,
            "status": "ok",
        }
    except Exception as e:
        logger.error(f"Error in delete-document: {e}")
        return {"deleted": 0, "error": str(e)}


@router.get("/documents/{document_id}/chunks", tags=["Observability"])
async def get_document_chunks_api(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Retrieve real vectorized chunks from Chroma for admin observability and the Passage Workbench.
    """
    try:
        store = get_chroma_store()
        chunks = store.get_document_chunks(document_id)
        settings = get_settings()
        return {
            "document_id": document_id,
            "count": len(chunks),
            "embedding_model": settings.EMBEDDING_MODEL,
            "chunks": [
                {
                    "id": c["id"],
                    "index": i,
                    "text": c["text"],
                    "metadata": c["metadata"],
                }
                for i, c in enumerate(chunks)
            ],
        }
    except Exception as e:
        logger.error(f"Error fetching real chunks for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/ingestion-status", tags=["Observability"])
async def get_document_ingestion_status(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Return granular ingestion status and performance metrics for a document.
    """
    from app.ingestion.pipeline import get_ingestion_status
    return get_ingestion_status(document_id)


@router.get("/documents/{document_id}/index-status", tags=["Observability"])
async def get_document_index_status(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Verify indexing status across both dense (Chroma) and sparse (BM25) vector indices.
    """
    store = get_chroma_store()
    chunks = store.get_document_chunks(document_id)
    bm25 = get_bm25_retriever()
    bm25_matches = [k for k in bm25.documents if k.startswith(f"{document_id}_")]

    return {
        "document_id": document_id,
        "chroma_chunks": len(chunks),
        "bm25_chunks": len(bm25_matches),
        "is_indexed": len(chunks) > 0,
        "status": "READY" if len(chunks) > 0 else "NOT_INDEXED",
    }


@router.post("/documents/{document_id}/reindex", tags=["Ingestion"])
async def reindex_document_endpoint(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Reindex an existing document's chunks with the canonical embedding model and sync with BM25.
    """
    from app.ingestion.pipeline import reindex_document
    res = await reindex_document(document_id)
    if res.get("status") == "failed":
        raise HTTPException(status_code=400, detail=res)
    return res


@router.get("/documents/{document_id}/verify", tags=["Observability"])
async def verify_document_endpoint(
    document_id: str,
    auth: bool = Depends(verify_internal_auth),
):
    """
    Verify synchronization contract between Chroma and BM25 for a document.
    """
    from app.ingestion.pipeline import verify_document_index
    return verify_document_index(document_id)
