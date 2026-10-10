"""
Chroma vector store manager — supports Chroma Cloud and local PersistentClient fallback.
Handles collection management, upsert, query with metadata filtering.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import get_settings
from app.core.security import chroma_where_from_filters

logger = logging.getLogger("rag_service.vectorstore")

_client: chromadb.ClientAPI | None = None
_is_cloud = False


def init_chroma() -> chromadb.ClientAPI:
    """Initialize the Chroma client (cloud or local)."""
    global _client, _is_cloud
    settings = get_settings()

    is_cloud_requested = (
        settings.CHROMA_MODE.lower() == "cloud" or
        settings.is_chroma_cloud or
        bool(settings.CHROMA_API_KEY and settings.CHROMA_TENANT)
    )

    # 1. Try Chroma Cloud if requested or keys provided
    if is_cloud_requested and settings.CHROMA_API_KEY and settings.CHROMA_TENANT and settings.CHROMA_DATABASE:
        try:
            logger.info(
                "Connecting to Chroma Cloud (tenant=%s, db=%s)",
                settings.CHROMA_TENANT,
                settings.CHROMA_DATABASE,
            )
            _client = chromadb.HttpClient(
                host="api.trychroma.com",
                port=443,
                ssl=True,
                headers={"Authorization": f"Bearer {settings.CHROMA_API_KEY}"},
                tenant=settings.CHROMA_TENANT,
                database=settings.CHROMA_DATABASE,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            _client.heartbeat()
            _is_cloud = True
            logger.info("✅ Connected to Chroma Cloud")
            return _client
        except Exception as e:
            if settings.RAG_ENV.lower() == "production" and not settings.ALLOW_LOCAL_VECTOR_FALLBACK:
                logger.error("Chroma Cloud failure in production: %s", e)
                raise RuntimeError(
                    f"Chroma Cloud connection failed and local vector fallback is forbidden in production: {e}"
                )
            logger.warning("Chroma Cloud connection failed: %s — falling back to local development store", e)

    # 2. Chroma self-hosted server
    if settings.CHROMA_HOST:
        try:
            logger.info(
                "Connecting to Chroma server at %s:%d",
                settings.CHROMA_HOST, settings.CHROMA_PORT,
            )
            _client = chromadb.HttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            _client.heartbeat()
            _is_cloud = False
            logger.info("✅ Connected to Chroma server")
            return _client
        except Exception as e:
            logger.warning("Chroma server connection failed: %s — falling back to local development store", e)

    # 3. Local PersistentClient
    if settings.RAG_ENV.lower() == "production" and not settings.ALLOW_LOCAL_VECTOR_FALLBACK:
        raise RuntimeError("Local Chroma storage is prohibited in production when ALLOW_LOCAL_VECTOR_FALLBACK is False.")

    persist_dir = settings.CHROMA_LOCAL_PERSIST_DIR
    os.makedirs(persist_dir, exist_ok=True)
    logger.info("Using local Chroma storage at: %s", persist_dir)
    _client = chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    _is_cloud = False
    logger.info("[OK] Local Chroma initialized")
    return _client


def get_client() -> chromadb.ClientAPI:
    """Get the initialized Chroma client."""
    if _client is None:
        return init_chroma()
    return _client


def _safe_collection_name(name: str) -> str:
    """Sanitize a string to be a valid Chroma collection name."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_")
    if not safe:
        safe = "default"
    if len(safe) < 3:
        safe = safe + "_col"
    return safe[:63]


def get_canonical_collection() -> chromadb.Collection:
    """
    Get the single canonical collection (rag_unified_v1) used across all RAG operations.
    Security and course partitioning are enforced through metadata filtering.
    """
    settings = get_settings()
    col_name = _safe_collection_name(settings.CANONICAL_COLLECTION)
    client = get_client()
    try:
        collection = client.get_or_create_collection(
            name=col_name,
            metadata={"hnsw:space": "cosine"},
        )
        return collection
    except Exception as e:
        logger.error("Failed to get/create canonical collection %s: %s", col_name, e)
        raise


def get_collection(
    subject_id: str | None = None,
    prefix: str | None = None,
) -> chromadb.Collection:
    """
    Returns the canonical unified collection by default to avoid collection mismatch.
    Subject-level partitioning is done via metadata filtering.
    """
    # Always route to canonical collection unless a specific custom non-default name is explicitly passed
    if not subject_id or subject_id in ("default", "unified", "rag_unified", "rag_unified_v1"):
        return get_canonical_collection()

    settings = get_settings()
    pfx = prefix or settings.CHROMA_COLLECTION_PREFIX
    col_name = _safe_collection_name(f"{pfx}_{subject_id}")
    client = get_client()
    try:
        return client.get_or_create_collection(
            name=col_name,
            metadata={"hnsw:space": "cosine"},
        )
    except Exception as e:
        logger.error("Failed to get/create collection %s: %s", col_name, e)
        raise


def get_unified_collection() -> chromadb.Collection:
    """Alias for get_canonical_collection()."""
    return get_canonical_collection()


def upsert_chunks(
    collection: chromadb.Collection,
    ids: list[str],
    documents: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict[str, Any]],
    batch_size: int = 100,
) -> int:
    """
    Upsert document chunks into a Chroma collection in batches.
    Returns the total number of chunks upserted.
    """
    # Ensure all metadata values are strings (Chroma requirement)
    clean_metas = []
    for meta in metadatas:
        clean = {}
        for k, v in meta.items():
            if v is None:
                clean[k] = ""
            elif isinstance(v, (list, dict)):
                import json
                clean[k] = json.dumps(v)
            else:
                clean[k] = str(v)
        clean_metas.append(clean)

    total = len(ids)
    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        collection.upsert(
            ids=ids[start:end],
            documents=documents[start:end],
            embeddings=embeddings[start:end],
            metadatas=clean_metas[start:end],
        )

    logger.info("Upserted %d chunks into collection %s", total, collection.name)
    return total


def delete_document_chunks(
    collection: chromadb.Collection,
    document_id: str,
) -> int:
    """Remove all chunks for a given document ID. Returns count deleted."""
    try:
        existing = collection.get(where={"document_id": document_id})
        ids = existing["ids"]
        if ids:
            collection.delete(ids=ids)
            logger.info("Deleted %d chunks for document %s", len(ids), document_id)
            return len(ids)
        return 0
    except Exception as e:
        logger.warning("Failed to delete chunks for %s: %s", document_id, e)
        return 0


def query_collection(
    collection: chromadb.Collection,
    query_embedding: list[float],
    top_k: int = 20,
    where_filters: dict | None = None,
) -> dict:
    """
    Query a collection with optional metadata filtering.
    Returns raw Chroma query result.
    """
    kwargs: dict[str, Any] = {
        "query_embeddings": [query_embedding],
        "n_results": min(top_k, 100),
        "include": ["documents", "metadatas", "distances"],
    }

    if where_filters:
        chroma_where = chroma_where_from_filters(where_filters)
        if chroma_where:
            kwargs["where"] = chroma_where

    try:
        result = collection.query(**kwargs)
        return result
    except Exception as e:
        logger.error("Query failed on collection %s: %s", collection.name, e)
        return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}


def get_chroma_info() -> dict[str, Any]:
    """Return info about the Chroma connection for health checks."""
    settings = get_settings()
    try:
        client = get_client()
        heartbeat = client.heartbeat()
        collections = client.list_collections()
        return {
            "status": "connected",
            "mode": "cloud" if _is_cloud else "local",
            "is_cloud": _is_cloud,
            "canonical_collection": settings.CANONICAL_COLLECTION,
            "heartbeat": heartbeat,
            "collection_count": len(collections),
        }
    except Exception as e:
        return {
            "status": "error",
            "mode": "cloud" if _is_cloud else "local",
            "is_cloud": _is_cloud,
            "canonical_collection": settings.CANONICAL_COLLECTION,
            "error": str(e),
        }


class ChromaStore:
    """Wrapper class providing object-oriented interface for Chroma."""

    def __init__(self):
        self.client = get_client()

    def get_or_create_collection(self, name: str | None = None):
        return get_collection(subject_id=name)

    def query(
        self,
        query_embeddings: list[list[float]],
        n_results: int = 20,
        where: Optional[dict] = None,
        collection_name: Optional[str] = None,
    ) -> dict:
        col = get_collection(subject_id=collection_name)
        return query_collection(
            collection=col,
            query_embedding=query_embeddings[0],
            top_k=n_results,
            where_filters=where,
        )

    def delete_document(self, document_id: str, collection_name: Optional[str] = None) -> int:
        col = get_collection(subject_id=collection_name)
        return delete_document_chunks(collection=col, document_id=document_id)

    def get_document_chunks(self, document_id: str, collection_name: Optional[str] = None) -> list[dict]:
        col = get_collection(subject_id=collection_name)
        try:
            res = col.get(where={"document_id": document_id})
            chunks = []
            if res and res.get("ids"):
                for i, cid in enumerate(res["ids"]):
                    chunks.append({
                        "id": cid,
                        "text": res["documents"][i] if res.get("documents") else "",
                        "metadata": res["metadatas"][i] if res.get("metadatas") else {},
                    })
            return chunks
        except Exception as e:
            logger.warning(f"Error fetching chunks for {document_id}: {e}")
            return []

    def get_all_chunks(self, collection_name: Optional[str] = None) -> list[dict]:
        col = get_collection(subject_id=collection_name)
        try:
            res = col.get()
            chunks = []
            if res and res.get("ids"):
                for i, cid in enumerate(res["ids"]):
                    chunks.append({
                        "id": cid,
                        "text": res["documents"][i] if res.get("documents") else "",
                        "metadata": res["metadatas"][i] if res.get("metadatas") else {},
                    })
            return chunks
        except Exception as e:
            logger.warning(f"Error fetching all chunks: {e}")
            return []

    def count(self, collection_name: Optional[str] = None) -> int:
        col = get_collection(subject_id=collection_name)
        try:
            return col.count()
        except Exception:
            return 0

    def upsert(
        self,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict],
        embeddings: list[list[float]],
        collection_name: Optional[str] = None,
    ) -> int:
        col = get_collection(subject_id=collection_name)
        return upsert_chunks(
            collection=col,
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )


_global_chroma_store: Optional[ChromaStore] = None


def get_chroma_store() -> ChromaStore:
    global _global_chroma_store
    if _global_chroma_store is None:
        _global_chroma_store = ChromaStore()
    return _global_chroma_store

