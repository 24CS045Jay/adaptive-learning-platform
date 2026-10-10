"""
Complete document ingestion pipeline.

File → Parse → Clean → Chunk → Embed → Index (Chroma)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.embeddings.manager import get_embedding_manager
from app.ingestion.chunker import DocumentChunk, chunk_document
from app.ingestion.parsers import ParsedDocument, parse_document
from app.vectorstore.chroma import (
    delete_document_chunks,
    get_unified_collection,
    upsert_chunks,
)

logger = logging.getLogger("rag_service.ingestion.pipeline")


@dataclass
class IngestionResult:
    """Result of a document ingestion operation."""
    document_id: str = ""
    file_name: str = ""
    status: str = "pending"  # pending | parsing | chunking | embedding | indexing | completed | failed
    chunk_count: int = 0
    collection: str = ""
    error: str | None = None
    duration_ms: float = 0
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

    def to_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "file_name": self.file_name,
            "status": self.status,
            "chunk_count": self.chunk_count,
            "collection": self.collection,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


def _clean_text(text: str) -> str:
    """Basic text cleaning and normalization."""
    import re
    # Normalize whitespace
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"\r", "\n", text)
    # Remove excessive blank lines
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    # Remove null bytes
    text = text.replace("\x00", "")
    # Normalize unicode spaces
    text = re.sub(r"[\u00a0\u2000-\u200b\u202f\u205f\u3000]", " ", text)
    return text.strip()


_ingestion_statuses: dict[str, dict] = {}


def get_ingestion_status(document_id: str) -> dict:
    """Return the current or most recent ingestion status and metrics for a document."""
    if document_id in _ingestion_statuses:
        return _ingestion_statuses[document_id]
    return {
        "document_id": document_id,
        "status": "not_found",
        "stage": "none",
        "message": "No ingestion record found for this document ID",
    }


def _update_status(document_id: str, stage: str, status: str = "in_progress", **kwargs) -> None:
    current = _ingestion_statuses.get(document_id, {"document_id": document_id})
    current.update({
        "status": status,
        "stage": stage,
        "updated_at": time.time(),
        **kwargs,
    })
    _ingestion_statuses[document_id] = current


async def ingest_document(
    file_bytes: bytes,
    file_name: str,
    document_id: str,
    subject_id: str = "",
    subject_code: str = "",
    university_id: str = "",
    department_id: str = "",
    semester: int | None = None,
    course_id: str = "",
    faculty_id: str = "",
    document_version: int = 1,
    extra_metadata: dict[str, Any] | None = None,
) -> IngestionResult:
    """
    Canonical full ingestion pipeline: parse → clean → chunk → embed → index in Chroma & BM25.
    Tracks granular status and metrics for observability.
    """
    start = time.perf_counter()
    result = IngestionResult(
        document_id=document_id,
        file_name=file_name,
    )

    _update_status(
        document_id,
        stage="uploaded",
        status="in_progress",
        file_name=file_name,
        file_size_bytes=len(file_bytes),
    )

    try:
        # ── Step 1: Parse ─────────────────────────────────────────────────
        result.status = "parsing"
        _update_status(document_id, stage="parsing", status="in_progress")
        logger.info("[Ingest] Parsing %s (doc=%s)", file_name, document_id)

        parsed = parse_document(file_bytes, file_name, document_id)
        if parsed.error:
            result.status = "failed"
            result.error = parsed.error
            _update_status(document_id, stage="parsing", status="failed", error=parsed.error)
            return result

        full_text = parsed.full_text
        if not full_text or not full_text.strip():
            result.status = "failed"
            result.error = "No text content extracted from document"
            _update_status(document_id, stage="parsing", status="failed", error=result.error)
            return result

        import hashlib
        content_hash = hashlib.sha256(file_bytes).hexdigest()

        # Check duplicate indexing by content hash
        collection = get_unified_collection()
        try:
            existing = collection.get(where={"document_id": document_id})
            if existing and existing.get("ids") and existing.get("metadatas"):
                for m in existing["metadatas"]:
                    if m.get("content_hash") == content_hash:
                        logger.info(
                            "[Ingest] Document %s already indexed with identical content_hash %s. Skipping duplicate.",
                            document_id, content_hash
                        )
                        result.status = "completed"
                        result.chunk_count = len(existing["ids"])
                        result.collection = collection.name
                        result.duration_ms = round((time.perf_counter() - start) * 1000, 1)
                        result.metadata = {"duplicate_skipped": True, "content_hash": content_hash}
                        _update_status(
                            document_id,
                            stage="completed",
                            status="completed",
                            duplicate_skipped=True,
                            vectors_indexed=result.chunk_count,
                            content_hash=content_hash,
                        )
                        return result
        except Exception as check_err:
            logger.debug("[Ingest] Existing document check failed/skipped: %s", check_err)

        # ── Step 2: Clean ─────────────────────────────────────────────────
        _update_status(
            document_id,
            stage="cleaned",
            status="in_progress",
            characters_extracted=len(full_text),
            sections_found=len(parsed.sections),
        )
        cleaned_text = _clean_text(full_text)
        for section in parsed.sections:
            section.content = _clean_text(section.content)

        # ── Step 3: Chunk ─────────────────────────────────────────────────
        result.status = "chunking"
        _update_status(document_id, stage="chunking", status="in_progress")
        logger.info("[Ingest] Chunking %s", file_name)

        security_meta = {
            "document_id": document_id,
            "document_version": str(document_version),
            "content_hash": content_hash,
            "file_name": file_name,
            "subject_id": subject_id,
            "subject_code": subject_code,
            "university_id": university_id,
            "department_id": department_id,
            "semester": str(semester) if semester is not None else "",
            "course_id": course_id,
            "faculty_id": faculty_id,
            "visibility": "enrolled_students",
            "is_active": "true",
        }
        if extra_metadata:
            security_meta.update({k: str(v) for k, v in extra_metadata.items()})

        chunks = chunk_document(parsed, document_id, extra_metadata=security_meta)

        if not chunks:
            result.status = "failed"
            result.error = "Document produced 0 chunks after processing"
            _update_status(document_id, stage="chunking", status="failed", error=result.error)
            return result

        _update_status(
            document_id,
            stage="chunked",
            status="in_progress",
            chunks_created=len(chunks),
        )

        # ── Step 4: Embed ─────────────────────────────────────────────────
        result.status = "embedding"
        _update_status(document_id, stage="embedding", status="in_progress")
        logger.info("[Ingest] Embedding %d chunks for %s", len(chunks), file_name)

        embed_mgr = get_embedding_manager()
        texts = [c.text for c in chunks]
        embeddings = embed_mgr.embed_documents(texts)

        _update_status(
            document_id,
            stage="embedded",
            status="in_progress",
            embeddings_created=len(embeddings),
            embedding_model=embed_mgr.model_name,
            embedding_dimension=embed_mgr.dimension,
        )

        # ── Step 5: Index in Chroma & BM25 with Strict Metadata Contract ──
        result.status = "indexing"
        _update_status(document_id, stage="indexing", status="in_progress")
        logger.info("[Ingest] Indexing %d chunks into Chroma and BM25", len(chunks))

        # Delete old chunks for this document before upserting (knowledge sync update)
        delete_document_chunks(collection, document_id)

        # Build conformant metadata contract per Section 21
        chunk_ids = [c.chunk_id for c in chunks]
        chunk_texts = [c.text for c in chunks]
        chunk_metas = []
        for idx, c in enumerate(chunks):
            raw_page = c.metadata.get("page", 1)
            try:
                page_val = int(raw_page) if str(raw_page).strip() else 1
            except (ValueError, TypeError):
                page_val = 1

            sec_val = c.metadata.get("section") or c.metadata.get("chapter") or "general"
            chunk_contract = {
                "document_id": document_id,
                "document_version": str(document_version),
                "content_hash": content_hash,
                "chunk_id": c.chunk_id,
                "chunk_index": idx,
                "file_name": file_name,
                "page": page_val,
                "section": sec_val,
                "subject_id": subject_id,
                "course_id": course_id,
                "department_id": department_id,
                "university_id": university_id,
                "semester": str(semester) if semester is not None else "",
                "visibility": str(security_meta.get("visibility", "enrolled_students")),
                "is_active": True,
                "is_faculty_only": False,
                "embedding_model": embed_mgr.model_name,
                "embedding_dimension": embed_mgr.dimension,
            }
            # Add any other extra metadata strings
            for mk, mv in c.metadata.items():
                if mk not in chunk_contract and isinstance(mv, (str, int, float, bool)):
                    chunk_contract[mk] = mv
            chunk_metas.append(chunk_contract)

        upsert_chunks(
            collection=collection,
            ids=chunk_ids,
            documents=chunk_texts,
            embeddings=embeddings,
            metadatas=chunk_metas,
        )

        # Update sparse BM25 index
        from app.retrieval.bm25 import get_bm25_retriever
        bm25 = get_bm25_retriever()
        doc_ids_to_del = [k for k in list(bm25.documents.keys()) if k.startswith(f"{document_id}_")]
        for did in doc_ids_to_del:
            bm25.remove_document(did)
        bm25_docs = [{"id": chunk_ids[i], "text": chunk_texts[i], "metadata": chunk_metas[i]} for i in range(len(chunk_ids))]
        bm25.add_documents(bm25_docs)

        # ── Step 6: Ingestion Verification (Assert chunks == vectors == BM25) ──
        if len(chunks) != len(embeddings):
            raise ValueError(f"Invariant violation: chunks ({len(chunks)}) != embeddings ({len(embeddings)})")

        verify_res = collection.get(where={"document_id": document_id})
        indexed_count = len(verify_res.get("ids", []))
        if indexed_count != len(chunks):
            raise ValueError(f"Ingestion verification mismatch: expected {len(chunks)} vectors, found {indexed_count} in Chroma")

        bm25_count = sum(1 for cid in bm25.documents if cid.startswith(f"{document_id}_"))
        if bm25_count != len(chunks):
            raise ValueError(f"Ingestion verification mismatch: expected {len(chunks)} in BM25, found {bm25_count}")

        # ── Done ──────────────────────────────────────────────────────────
        result.status = "completed"
        result.chunk_count = len(chunks)
        result.collection = collection.name
        elapsed = (time.perf_counter() - start) * 1000
        result.duration_ms = round(elapsed, 1)
        result.metadata = {
            "page_count": parsed.page_count,
            "section_count": len(parsed.sections),
            "table_count": len(parsed.tables),
            "embedding_model": embed_mgr.model_name,
            "embedding_dimension": embed_mgr.dimension,
            "content_hash": content_hash,
            "vectors_verified": indexed_count,
            "bm25_verified": bm25_count,
        }

        _update_status(
            document_id,
            stage="completed",
            status="completed",
            vectors_indexed=indexed_count,
            sparse_records=bm25_count,
            content_hash=content_hash,
            duration_ms=result.duration_ms,
        )

        logger.info(
            "[Ingest] ✅ Completed %s: %d chunks in %.1f ms (verified sync: Chroma=%d, BM25=%d)",
            file_name, len(chunks), elapsed, indexed_count, bm25_count,
        )

    except Exception as e:
        result.status = "failed"
        result.error = str(e)
        elapsed = (time.perf_counter() - start) * 1000
        result.duration_ms = round(elapsed, 1)
        _update_status(
            document_id,
            stage="failed",
            status="failed",
            error=str(e),
            duration_ms=result.duration_ms,
        )
        logger.error("[Ingest] ❌ Failed %s: %s", file_name, e, exc_info=True)

    return result


async def ingest_text(
    text: str,
    document_id: str,
    file_name: str = "text_input",
    subject_id: str = "",
    subject_code: str = "",
    university_id: str = "",
    department_id: str = "",
    semester: int | None = None,
    course_id: str = "",
    faculty_id: str = "",
    document_version: int = 1,
    extra_metadata: dict[str, Any] | None = None,
) -> IngestionResult:
    """
    Ingest pre-extracted text using canonical pipeline.
    """
    file_bytes = text.encode("utf-8")
    return await ingest_document(
        file_bytes=file_bytes,
        file_name=file_name if file_name.endswith(".txt") else f"{file_name}.txt",
        document_id=document_id,
        subject_id=subject_id,
        subject_code=subject_code,
        university_id=university_id,
        department_id=department_id,
        semester=semester,
        course_id=course_id,
        faculty_id=faculty_id,
        document_version=document_version,
        extra_metadata=extra_metadata,
    )


class IngestionPipeline:
    """Class wrapper providing unified synchronous and asynchronous ingestion operations."""

    def ingest_text(
        self,
        document_id: str,
        version_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        import asyncio
        meta = metadata or {}
        subject_id = str(meta.get("subject_id") or "")
        subject_code = str(meta.get("subject_code") or meta.get("subject") or "GENERAL")

        # Run canonical async ingestion
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        coro = ingest_text(
            text=text,
            document_id=document_id,
            file_name=f"{document_id}.txt",
            subject_id=subject_id,
            subject_code=subject_code,
            university_id=str(meta.get("university_id") or ""),
            department_id=str(meta.get("department_id") or ""),
            semester=meta.get("semester"),
            course_id=str(meta.get("course_id") or ""),
            document_version=int(version_id.replace("v", "")) if str(version_id).startswith("v") else 1,
            extra_metadata=meta,
        )

        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                res = pool.submit(asyncio.run, coro).result()
        else:
            res = loop.run_until_complete(coro)

        return {
            "document_id": document_id,
            "version_id": version_id,
            "chunks_count": res.chunk_count,
            "status": "COMPLETED" if res.status == "completed" else "FAILED",
            "error": res.error,
        }

    def ingest_document(
        self,
        document_id: str,
        version_id: str,
        file_bytes: bytes,
        filename: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        import asyncio
        meta = metadata or {}
        subject_id = str(meta.get("subject_id") or "")
        subject_code = str(meta.get("subject_code") or meta.get("subject") or "GENERAL")

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        coro = ingest_document(
            file_bytes=file_bytes,
            file_name=filename,
            document_id=document_id,
            subject_id=subject_id,
            subject_code=subject_code,
            university_id=str(meta.get("university_id") or ""),
            department_id=str(meta.get("department_id") or ""),
            semester=meta.get("semester"),
            course_id=str(meta.get("course_id") or ""),
            document_version=int(version_id.replace("v", "")) if str(version_id).startswith("v") else 1,
            extra_metadata=meta,
        )

        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                res = pool.submit(asyncio.run, coro).result()
        else:
            res = loop.run_until_complete(coro)

        return {
            "document_id": document_id,
            "version_id": version_id,
            "chunks_count": res.chunk_count,
            "status": "COMPLETED" if res.status == "completed" else "FAILED",
            "error": res.error,
        }


_global_pipeline: IngestionPipeline | None = None


def get_ingestion_pipeline() -> IngestionPipeline:
    global _global_pipeline
    if _global_pipeline is None:
        _global_pipeline = IngestionPipeline()
    return _global_pipeline


def verify_document_index(document_id: str) -> dict[str, Any]:
    """Verify that Chroma and BM25 have identical chunk counts and are fully synchronized."""
    collection = get_unified_collection()
    c_res = collection.get(where={"document_id": document_id})
    c_count = len(c_res.get("ids", []))

    from app.retrieval.bm25 import get_bm25_retriever
    bm25 = get_bm25_retriever()
    b_count = sum(1 for cid in bm25.documents if cid.startswith(f"{document_id}_"))

    is_synced = (c_count == b_count and c_count > 0)
    status = "VERIFIED" if is_synced else ("MISMATCH" if c_count != b_count else "NOT_FOUND")

    return {
        "document_id": document_id,
        "chroma_vectors": c_count,
        "bm25_records": b_count,
        "is_synced": is_synced,
        "status": status,
    }


async def reindex_document(document_id: str) -> dict[str, Any]:
    """Reindex an existing document's chunks with the canonical embedding model and sync with BM25."""
    start = time.perf_counter()
    collection = get_unified_collection()
    existing = collection.get(where={"document_id": document_id})
    ids = existing.get("ids", [])
    texts = existing.get("documents", [])
    metas = existing.get("metadatas", [])

    if not ids or not texts:
        return {
            "document_id": document_id,
            "status": "failed",
            "error": f"No existing chunks found for document_id {document_id}",
        }

    embed_mgr = get_embedding_manager()
    embeddings = embed_mgr.embed_documents(texts)

    for m in metas:
        m["embedding_model"] = embed_mgr.model_name
        m["embedding_dimension"] = embed_mgr.dimension
        m["is_active"] = True
        m["is_faculty_only"] = False

    # Re-upsert to Chroma
    upsert_chunks(
        collection=collection,
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metas,
    )

    # Rebuild in BM25
    from app.retrieval.bm25 import get_bm25_retriever
    bm25 = get_bm25_retriever()
    doc_ids_to_del = [k for k in list(bm25.documents.keys()) if k.startswith(f"{document_id}_")]
    for did in doc_ids_to_del:
        bm25.remove_document(did)
    bm25_docs = [{"id": ids[i], "text": texts[i], "metadata": metas[i]} for i in range(len(ids))]
    bm25.add_documents(bm25_docs)

    verification = verify_document_index(document_id)
    elapsed = (time.perf_counter() - start) * 1000

    return {
        "document_id": document_id,
        "status": "completed" if verification["is_synced"] else "failed",
        "chunks_reindexed": len(ids),
        "duration_ms": round(elapsed, 1),
        "verification": verification,
    }

