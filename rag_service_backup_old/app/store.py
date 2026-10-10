"""Chroma vector store (Chroma Cloud or local) with LangChain embeddings.

The collection name embeds the embedding-model id (e.g. edu_chunks__gemini768) so switching
embedding provider/dimension creates a NEW collection instead of crashing with a dimension
mismatch. Re-ingest documents after changing provider.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from langchain_core.documents import Document

from app.config import get_settings
from app.providers import embedding_id, get_embeddings

log = logging.getLogger("rag.store")

_UPSERT_BATCH = 64
_EMBED_BATCH = 32


def _clean_meta(m: Dict[str, Any]) -> Dict[str, Any]:
    """Chroma only accepts str/int/float/bool metadata values."""
    out = {}
    for k, v in m.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            out[k] = v
        else:
            out[k] = str(v)
    return out


def _retry(fn, tries: int = 4, base: float = 1.5):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # rate limit / transient network
            last = e
            wait = base ** (i + 1)
            log.warning("retry %s/%s after error: %s (sleep %.1fs)", i + 1, tries, str(e)[:160], wait)
            time.sleep(wait)
    raise last  # type: ignore[misc]


class ChromaStore:
    def __init__(self) -> None:
        s = get_settings()
        self.mode = "chroma_cloud" if s.use_chroma_cloud else "chroma_local"
        if s.use_chroma_cloud:
            self.client = chromadb.CloudClient(
                tenant=s.chroma_tenant, database=s.chroma_database, api_key=s.chroma_api_key
            )
        else:
            self.client = chromadb.PersistentClient(path=s.chroma_local_dir)
        self.collection_name = f"edu_chunks__{embedding_id()}"
        self._lock = threading.Lock()
        self.version = 0  # bumped on every write; used to invalidate BM25 cache
        self.collection = self._get_collection()

    def _get_collection(self):
        try:
            return self.client.get_or_create_collection(
                name=self.collection_name, configuration={"hnsw": {"space": "cosine"}}
            )
        except Exception:
            return self.client.get_or_create_collection(
                name=self.collection_name, metadata={"hnsw:space": "cosine"}
            )

    # ---- write ----
    def upsert(self, docs: List[Document]) -> int:
        if not docs:
            return 0
        emb = get_embeddings()
        texts = [d.page_content for d in docs]
        vectors: List[List[float]] = []
        for i in range(0, len(texts), _EMBED_BATCH):
            batch = texts[i : i + _EMBED_BATCH]
            vectors.extend(_retry(lambda b=batch: emb.embed_documents(b)))
        if len(vectors) != len(docs):
            raise RuntimeError(f"Embedding count mismatch: {len(vectors)} vs {len(docs)}")
        with self._lock:
            for i in range(0, len(docs), _UPSERT_BATCH):
                sl = slice(i, i + _UPSERT_BATCH)
                _retry(
                    lambda sl=sl: self.collection.upsert(
                        ids=[d.metadata["chunk_id"] for d in docs[sl]],
                        documents=texts[sl],
                        embeddings=vectors[sl],
                        metadatas=[_clean_meta(d.metadata) for d in docs[sl]],
                    )
                )
            self.version += 1
        return len(docs)

    def delete_document(self, doc_id: str) -> int:
        with self._lock:
            got = self.collection.get(where={"document_id": doc_id}, include=[])
            ids = got.get("ids", [])
            if ids:
                for i in range(0, len(ids), 200):
                    self.collection.delete(ids=ids[i : i + 200])
            self.version += 1
        return len(ids)

    def set_active(self, doc_id: str, active: bool) -> int:
        got = self.collection.get(where={"document_id": doc_id}, include=["metadatas"])
        ids, metas = got.get("ids", []), got.get("metadatas", [])
        if ids:
            for i in range(0, len(ids), 100):
                self.collection.update(
                    ids=ids[i : i + 100],
                    metadatas=[{**m, "is_active": active} for m in metas[i : i + 100]],
                )
        self.version += 1
        return len(ids)

    # ---- read ----
    def dense_search(self, query: str, k: int, where: Optional[dict]) -> List[Tuple[Document, float]]:
        n = self.collection.count()
        if n == 0:
            return []
        qv = _retry(lambda: get_embeddings().embed_query(query))
        res = self.collection.query(
            query_embeddings=[qv],
            n_results=min(k, n),
            where=where or None,
            include=["documents", "metadatas", "distances"],
        )
        out = []
        for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
            out.append((Document(page_content=doc, metadata=meta), max(0.0, 1.0 - float(dist))))
        return out

    def fetch(self, where: Optional[dict], limit: int = 5000) -> List[Document]:
        """Fetch all chunks matching a filter (used to build the BM25 corpus)."""
        docs: List[Document] = []
        offset = 0
        while True:
            got = self.collection.get(
                where=where or None, include=["documents", "metadatas"], limit=300, offset=offset
            )
            ids = got.get("ids", [])
            if not ids:
                break
            for t, m in zip(got["documents"], got["metadatas"]):
                docs.append(Document(page_content=t, metadata=m))
            offset += len(ids)
            if len(ids) < 300 or offset >= limit:
                break
        return docs

    def chunks_of(self, doc_id: str) -> List[Document]:
        docs = self.fetch({"document_id": doc_id})
        return sorted(docs, key=lambda d: d.metadata.get("chunk_index", 0))

    def count(self) -> int:
        return self.collection.count()

    def heartbeat(self) -> bool:
        try:
            self.client.heartbeat()
            return True
        except Exception:
            return False


_store: Optional[ChromaStore] = None


def get_store(force_new: bool = False) -> ChromaStore:
    global _store
    if _store is None or force_new:
        _store = ChromaStore()
    return _store
