"""
BM25 Sparse Retriever.
Provides lexical retrieval for exact technical terms, formulas, course codes, and symbols.
Maintains in-memory or persisted BM25 index per subject/collection with metadata awareness.
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("rag_service.retrieval.bm25")


def tokenize(text: str) -> List[str]:
    """Simple alphanumeric tokenization with lowercasing."""
    if not text:
        return []
    # Match words, numbers, and technical identifiers like CamelCase, snake_case
    tokens = re.findall(r"\b[a-zA-Z0-9_\-\.]+\b", text.lower())
    return [t for t in tokens if len(t) > 1]


@dataclass
class IndexedDocument:
    id: str
    text: str
    metadata: Dict[str, Any]
    tokens: List[str] = field(default_factory=list)
    doc_len: int = 0


class BM25Retriever:
    """
    BM25 Okapi retriever supporting security-aware metadata filtering
    and automatic synchronization/rebuilding from canonical chunk store.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.documents: Dict[str, IndexedDocument] = {}
        self.doc_freqs: Dict[str, int] = {}
        self.avg_doc_len: float = 0.0
        self.total_doc_len: int = 0
        self.is_ready: bool = True
        self.last_rebuild: Optional[str] = None

    @property
    def document_count(self) -> int:
        return len(self.documents)

    def rebuild_from_chroma(self, chroma_store: Any = None) -> int:
        """Fetch all active chunks from Chroma and rebuild BM25 index."""
        import datetime
        try:
            from app.vectorstore.chroma import get_chroma_store
            store = chroma_store or get_chroma_store()
            chunks = store.get_all_chunks()
            self.clear()
            if chunks:
                docs = [{"id": c["id"], "text": c["text"], "metadata": c["metadata"]} for c in chunks]
                self.add_documents(docs)
            self.last_rebuild = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.is_ready = True
            logger.info("BM25 index successfully rebuilt from Chroma (%d chunks)", len(self.documents))
            return len(self.documents)
        except Exception as e:
            logger.warning("BM25 rebuild from Chroma failed: %s", e)
            self.is_ready = len(self.documents) > 0
            return len(self.documents)

    def add_documents(self, docs: List[Dict[str, Any]]) -> None:
        """
        Add documents to the BM25 index.
        Each doc has: {"id": str, "text": str, "metadata": dict}
        """
        for doc in docs:
            doc_id = doc["id"]
            text = doc.get("text", "")
            metadata = doc.get("metadata", {})
            tokens = tokenize(text)
            doc_len = len(tokens)

            # If existing doc, remove old doc freqs first
            if doc_id in self.documents:
                self.remove_document(doc_id)

            self.documents[doc_id] = IndexedDocument(
                id=doc_id,
                text=text,
                metadata=metadata,
                tokens=tokens,
                doc_len=doc_len,
            )

            # Update document frequencies
            unique_tokens = set(tokens)
            for token in unique_tokens:
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

            self.total_doc_len += doc_len

        num_docs = len(self.documents)
        self.avg_doc_len = (self.total_doc_len / num_docs) if num_docs > 0 else 0.0
        logger.debug(f"BM25 index updated: {num_docs} documents, avg_len={self.avg_doc_len:.1f}")

    def remove_document(self, doc_id: str) -> None:
        """Remove a document from index."""
        if doc_id not in self.documents:
            return
        doc = self.documents.pop(doc_id)
        for token in set(doc.tokens):
            if token in self.doc_freqs:
                self.doc_freqs[token] -= 1
                if self.doc_freqs[token] <= 0:
                    del self.doc_freqs[token]
        self.total_doc_len -= doc.doc_len
        num_docs = len(self.documents)
        self.avg_doc_len = (self.total_doc_len / num_docs) if num_docs > 0 else 0.0

    def clear(self) -> None:
        """Clear the entire index."""
        self.documents.clear()
        self.doc_freqs.clear()
        self.avg_doc_len = 0.0
        self.total_doc_len = 0

    def _matches_filter(self, metadata: Dict[str, Any], filter_dict: Optional[Dict[str, Any]]) -> bool:
        """Check if doc metadata satisfies security/where filter."""
        if not filter_dict:
            return True

        for key, val in filter_dict.items():
            if key == "$and":
                if not all(self._matches_filter(metadata, sub) for sub in val):
                    return False
            elif key == "$or":
                if not any(self._matches_filter(metadata, sub) for sub in val):
                    return False
            elif isinstance(val, dict):
                doc_val = metadata.get(key)
                if "$in" in val:
                    if doc_val not in val["$in"]:
                        return False
                elif "$eq" in val:
                    if doc_val != val["$eq"]:
                        return False
                elif "$ne" in val:
                    if doc_val == val["$ne"]:
                        return False
            else:
                if metadata.get(key) != val:
                    return False

        return True

    def query(
        self,
        query_text: str,
        top_k: int = 20,
        where_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lexical BM25 search with metadata/security filtering.
        Returns list of {"id", "text", "metadata", "score"}.
        """
        query_tokens = tokenize(query_text)
        if not query_tokens or not self.documents:
            return []

        num_docs = len(self.documents)
        scores: List[Tuple[float, IndexedDocument]] = []

        for doc in self.documents.values():
            if not self._matches_filter(doc.metadata, where_filter):
                continue

            score = 0.0
            doc_len = doc.doc_len

            # Count term frequencies in this doc
            doc_token_counts: Dict[str, int] = {}
            for t in doc.tokens:
                doc_token_counts[t] = doc_token_counts.get(t, 0) + 1

            for token in query_tokens:
                if token not in doc_token_counts:
                    continue
                tf = doc_token_counts[token]
                df = self.doc_freqs.get(token, 0)
                # BM25 IDF with smoothing
                idf = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)
                # BM25 TF weight
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / (self.avg_doc_len or 1.0)))
                score += idf * (numerator / denominator)

            if score > 0:
                scores.append((score, doc))

        # Sort descending by score
        scores.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scores[:top_k]:
            results.append({
                "id": doc.id,
                "text": doc.text,
                "metadata": doc.metadata,
                "score": score,
                "retrieval_type": "sparse",
            })

        return results


# Global singleton instance for the service
_global_bm25_retriever: Optional[BM25Retriever] = None


def get_bm25_retriever() -> BM25Retriever:
    global _global_bm25_retriever
    if _global_bm25_retriever is None:
        _global_bm25_retriever = BM25Retriever()
    return _global_bm25_retriever
