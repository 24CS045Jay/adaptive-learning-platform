"""Ingestion pipeline: parse -> chunk -> embed -> store, with per-document status tracking."""
from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
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
    # 1. Direct local disk read optimization: bypass HTTP for local uploads
    if "/uploads/documents/" in url:
        try:
            fname = url.split("/uploads/documents/")[-1].split("?")[0]
            candidate = Path(__file__).resolve().parent.parent.parent / "public" / "uploads" / "documents" / fname
            if candidate.is_file():
                log.info("Directly loaded local upload from disk: %s", candidate)
                content = candidate.read_bytes()
                if len(content) > max_mb * 1024 * 1024:
                    raise ParseError(f"File larger than {max_mb} MB")
                return content
        except Exception as e:
            log.warning("Direct local disk read fallback to HTTP: %s", e)

    # 2. HTTP download with localhost / 127.0.0.1 resilience
    targets = [url]
    if "localhost:5000" in url:
        targets.append(url.replace("localhost:5000", "127.0.0.1:5000"))
    elif "127.0.0.1:5000" in url:
        targets.append(url.replace("127.0.0.1:5000", "localhost:5000"))

    last_err = None
    for target in targets:
        try:
            with httpx.Client(timeout=60, follow_redirects=True) as c:
                r = c.get(target)
                r.raise_for_status()
                if len(r.content) > max_mb * 1024 * 1024:
                    raise ParseError(f"File larger than {max_mb} MB")
                return r.content
        except Exception as e:
            last_err = e

    if last_err:
        raise last_err
    raise ParseError(f"Failed to download file from url: {url}")


from app.versioning import get_version_registry


def ingest_document(
    doc_id: str,
    metadata: Dict[str, Any],
    *,
    data: Optional[bytes] = None,
    file_name: str = "",
    text: Optional[str] = None,
    file_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Full pipeline: duplicate check -> version -> parse -> chunk -> embed -> verify -> atomic activate."""
    t0 = time.time()
    store = get_store()
    reg = get_version_registry()
    _set(doc_id, status="processing", step="parsing", error=None, metrics={})

    try:
        if data is None and file_url:
            _set(doc_id, step="downloading")
            data = download(file_url)

        # 1. Content hashing & duplicate check
        raw_bytes = data if data is not None else (text.encode("utf-8") if text else b"")
        content_hash = reg.compute_hash(raw_bytes) if raw_bytes else ""

        identical = reg.find_identical(doc_id, content_hash) if content_hash else None
        if identical and not metadata.get("force_reingest"):
            log.info("Document %s already indexed with hash %s (v%s). Skipping duplicate.", doc_id, content_hash, identical.version_number)
            _set(doc_id, status="completed", step="done", metrics={"duplicate_skipped": True, "chunks_created": identical.chunk_count})
            return {
                "documentId": doc_id,
                "versionId": identical.version_id,
                "versionNumber": identical.version_number,
                "chunkCount": identical.chunk_count,
                "status": "duplicate_skipped",
                "contentHash": content_hash,
                "collection": store.collection_name,
            }

        # 2. Register new version in processing state
        clean_fname = file_name or str(metadata.get("fileName") or metadata.get("file_name") or "document")
        subject_id = str(metadata.get("subjectId") or metadata.get("subject_id") or "")
        course_id = str(metadata.get("courseId") or metadata.get("course_id") or "")
        faculty_id = str(metadata.get("facultyId") or metadata.get("faculty_id") or "")

        version = reg.prepare_version(
            doc_id=doc_id,
            filename=clean_fname,
            content_hash=content_hash,
            subject_id=subject_id,
            course_id=course_id,
            faculty_id=faculty_id,
            embedding_model=embedding_id(),
        )

        # 3. Parse content
        if data is not None:
            sections = parse_bytes(data, clean_fname)
        elif text is not None:
            sections = parse_text(text)
        else:
            raise ParseError("Provide a file, file_url, or text")
        chars = sum(len(s.text) for s in sections)

        # 4. Chunk sections with complete version metadata
        _set(doc_id, step="chunking", metrics={"characters_extracted": chars, "sections_found": len(sections)})
        meta = {
            "document_id": doc_id,
            "version_id": version.version_id,
            "version_number": version.version_number,
            "content_hash": content_hash,
            "subject_code": str(metadata.get("subject") or metadata.get("subject_code") or "GENERAL"),
            "subject_id": subject_id,
            "department_id": str(metadata.get("departmentId") or metadata.get("department_id") or ""),
            "semester": metadata.get("semester") if isinstance(metadata.get("semester"), (int, float)) else 0,
            "file_name": clean_fname,
            "uploaded_at": str(metadata.get("uploadedAt") or metadata.get("uploaded_at") or version.uploaded_at),
            "is_active": False,  # Start False until verified and atomically published
        }
        docs = chunk_sections(sections, doc_id, meta)
        if not docs:
            raise ParseError("Document produced no usable chunks (too little text)")
        for d in docs:
            d.metadata["char_count"] = len(d.page_content)
            d.metadata["token_count"] = max(1, len(d.page_content) // 4)
            d.metadata["version_id"] = version.version_id
            d.metadata["version_number"] = version.version_number
            d.metadata["content_hash"] = content_hash

        # 5. Embed & Upsert
        _set(doc_id, step="embedding", metrics={"chunks_created": len(docs)})
        # Delete any stale chunks for this specific version if retrying
        store.delete_version(doc_id, version.version_id)
        n = store.upsert(docs)

        # 6. Verification & Atomic publication
        should_activate = bool(metadata.get("is_active", True))
        if should_activate:
            store.set_active_version(doc_id, version.version_id)
            published_ver = reg.publish_version(doc_id, version.version_id, n)
            active_version_id = published_ver.version_id
        else:
            active_version_id = (reg.get_active_version(doc_id).version_id if reg.get_active_version(doc_id) else None)

        ms = int((time.time() - t0) * 1000)
        _set(
            doc_id,
            status="completed",
            step="done",
            metrics={
                "version_id": version.version_id,
                "version_number": version.version_number,
                "active_version_id": active_version_id,
                "embeddings_created": n,
                "vectors_indexed": n,
                "embedding_model": embedding_id(),
                "duration_ms": ms,
                "collection": store.collection_name,
            },
        )
        log.info("ingested %s (v%s): %s chunks in %sms (active=%s)", doc_id, version.version_number, n, ms, should_activate)
        return {
            "documentId": doc_id,
            "versionId": version.version_id,
            "versionNumber": version.version_number,
            "activeVersionId": active_version_id,
            "chunkCount": n,
            "contentHash": content_hash,
            "collection": store.collection_name,
            "durationMs": ms,
        }
    except Exception as e:
        if 'version' in locals() and version:
            reg.mark_failed(doc_id, version.version_id, str(e))
        _set(doc_id, status="failed", step="error", error=str(e)[:500])
        raise

