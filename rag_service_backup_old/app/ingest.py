"""Ingestion pipeline: parse -> chunk -> embed -> store, with per-document status tracking."""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, Optional

import httpx

from app.chunker import chunk_sections
from app.config import get_settings
from app.parsers import ParseError, parse_bytes, parse_text
from app.providers import embedding_id
from app.store import get_store

log = logging.getLogger("rag.ingest")

_status: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def _set(doc_id: str, **kw: Any) -> None:
    with _lock:
        cur = _status.setdefault(doc_id, {"document_id": doc_id, "metrics": {}})
        m = kw.pop("metrics", None)
        cur.update(kw)
        if m:
            cur["metrics"].update(m)


def get_status(doc_id: str) -> Dict[str, Any]:
    with _lock:
        if doc_id in _status:
            return dict(_status[doc_id])
    # Service restarted: derive from what is actually in the vector DB
    try:
        n = len(get_store().chunks_of(doc_id))
    except Exception:
        n = 0
    if n:
        return {
            "document_id": doc_id,
            "status": "completed",
            "step": "done",
            "metrics": {"chunks_created": n, "vectors_indexed": n},
        }
    return {"document_id": doc_id, "status": "not_found", "step": "none", "metrics": {}}


def download(url: str, max_mb: int = 60) -> bytes:
    with httpx.Client(timeout=60, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        if len(r.content) > max_mb * 1024 * 1024:
            raise ParseError(f"File larger than {max_mb} MB")
        return r.content


def ingest_document(
    doc_id: str,
    metadata: Dict[str, Any],
    *,
    data: Optional[bytes] = None,
    file_name: str = "",
    text: Optional[str] = None,
    file_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Full pipeline. Raises ParseError for unreadable files; other errors propagate."""
    t0 = time.time()
    store = get_store()
    _set(doc_id, status="processing", step="parsing", error=None, metrics={})
    try:
        if data is None and file_url:
            _set(doc_id, step="downloading")
            data = download(file_url)
        if data is not None:
            sections = parse_bytes(data, file_name or metadata.get("file_name", ""))
        elif text is not None:
            sections = parse_text(text)
        else:
            raise ParseError("Provide a file, file_url, or text")
        chars = sum(len(s.text) for s in sections)

        _set(doc_id, step="chunking", metrics={"characters_extracted": chars, "sections_found": len(sections)})
        meta = {
            "subject_code": str(metadata.get("subject") or metadata.get("subject_code") or "GENERAL"),
            "subject_id": str(metadata.get("subjectId") or metadata.get("subject_id") or ""),
            "department_id": str(metadata.get("departmentId") or metadata.get("department_id") or ""),
            "semester": metadata.get("semester") if isinstance(metadata.get("semester"), (int, float)) else 0,
            "file_name": file_name or str(metadata.get("fileName") or metadata.get("file_name") or ""),
            "uploaded_at": str(metadata.get("uploadedAt") or metadata.get("uploaded_at") or ""),
            "is_active": bool(metadata.get("is_active", True)),
        }
        docs = chunk_sections(sections, doc_id, meta)
        if not docs:
            raise ParseError("Document produced no usable chunks (too little text)")
        for d in docs:
            d.metadata["char_count"] = len(d.page_content)
            d.metadata["token_count"] = max(1, len(d.page_content) // 4)

        _set(doc_id, step="embedding", metrics={"chunks_created": len(docs)})
        store.delete_document(doc_id)  # idempotent re-ingestion: remove stale chunks first
        n = store.upsert(docs)  # embeds + writes to Chroma

        ms = int((time.time() - t0) * 1000)
        _set(
            doc_id,
            status="completed",
            step="done",
            metrics={
                "embeddings_created": n,
                "vectors_indexed": n,
                "embedding_model": embedding_id(),
                "duration_ms": ms,
                "collection": store.collection_name,
            },
        )
        log.info("ingested %s: %s chunks in %sms", doc_id, n, ms)
        return {"documentId": doc_id, "chunkCount": n, "collection": store.collection_name, "durationMs": ms}
    except Exception as e:
        _set(doc_id, status="failed", step="error", error=str(e)[:500])
        raise
