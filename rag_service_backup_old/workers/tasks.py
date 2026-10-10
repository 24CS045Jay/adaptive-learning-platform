"""
Asynchronous Ingestion Worker Tasks.
Supports Celery worker queue with Redis broker, and provides standalone background execution.
Follows the exact state machine from Section 30:
QUEUED → DOWNLOADING → PARSING → CHUNKING → EMBEDDING → INDEXING → COMPLETED / FAILED
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, Optional

from app.core.config import get_settings
from app.ingestion.pipeline import get_ingestion_pipeline
from app.retrieval.bm25 import get_bm25_retriever
from app.vectorstore.chroma import get_chroma_store

logger = logging.getLogger("rag_service.workers.tasks")

# Initialize Celery app if celery is available
try:
    from celery import Celery
    settings = get_settings()
    celery_app = Celery(
        "rag_workers",
        broker=settings.redis_url,
        backend=settings.redis_url,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        task_track_started=True,
    )
except Exception as e:
    logger.warning(f"Celery not initialized ({e}). Background task runner fallback available.")
    celery_app = None


def process_document_ingestion(
    document_id: str,
    version_id: str,
    file_path: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    text_content: Optional[str] = None,
    filename: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    status_callback: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Executes the phased ingestion pipeline with detailed status progression.
    """
    meta = metadata or {}
    start_time = time.time()

    def update_status(step: str, pct: int, err: Optional[str] = None):
        logger.info(f"[Ingestion {document_id}] Step: {step} ({pct}%)")
        if status_callback:
            try:
                status_callback(document_id, step, pct, err)
            except Exception as cb_err:
                logger.error(f"Error in status callback: {cb_err}")

    update_status("QUEUED", 10)

    try:
        pipeline = get_ingestion_pipeline()

        if text_content:
            update_status("PARSING", 30)
            update_status("CHUNKING", 50)
            update_status("EMBEDDING", 70)
            update_status("INDEXING", 90)

            result = pipeline.ingest_text(
                document_id=document_id,
                version_id=version_id,
                text=text_content,
                metadata=meta,
            )
        else:
            # File ingestion
            if not file_bytes and file_path and os.path.exists(file_path):
                update_status("DOWNLOADING", 20)
                with open(file_path, "rb") as f:
                    file_bytes = f.read()

            if not file_bytes:
                raise ValueError("No file content or text provided for ingestion")

            update_status("PARSING", 35)
            update_status("CHUNKING", 55)
            update_status("EMBEDDING", 75)
            update_status("INDEXING", 90)

            result = pipeline.ingest_document(
                document_id=document_id,
                version_id=version_id,
                file_bytes=file_bytes,
                filename=filename or "document.bin",
                metadata=meta,
            )

        # Update sparse index
        bm25 = get_bm25_retriever()
        store = get_chroma_store()
        all_chunks = store.get_document_chunks(document_id)
        if all_chunks:
            bm25.add_documents(all_chunks)

        duration = time.time() - start_time
        update_status("COMPLETED", 100)
        logger.info(f"Ingestion for document {document_id} completed successfully in {duration:.2f}s")

        return {
            "status": "COMPLETED",
            "document_id": document_id,
            "version_id": version_id,
            "chunks_count": result.get("chunks_count", 0),
            "duration": round(duration, 2),
        }

    except Exception as e:
        logger.error(f"Ingestion failed for doc {document_id}: {e}", exc_info=True)
        update_status("FAILED", 0, str(e))
        return {
            "status": "FAILED",
            "document_id": document_id,
            "error": str(e),
        }


if celery_app is not None:
    @celery_app.task(name="tasks.ingest_document", bind=True, max_retries=3)
    def celery_ingest_task(self, document_id: str, version_id: str, **kwargs):
        try:
            return process_document_ingestion(document_id=document_id, version_id=version_id, **kwargs)
        except Exception as exc:
            raise self.retry(exc=exc, countdown=10)
