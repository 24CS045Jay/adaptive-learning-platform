"""
Dense Retriever.
Performs semantic vector search using BGE-M3 (or fallback) embeddings and Chroma.
Enforces security metadata filters prior to retrieval.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.embeddings.manager import get_embedding_manager
from app.vectorstore.chroma import get_chroma_store

logger = logging.getLogger("rag_service.retrieval.dense")


class DenseRetriever:
    """
    Semantic dense retriever querying Chroma vector store with BGE-M3 embeddings.
    """

    def __init__(self):
        self.settings = get_settings()
        self.chroma_store = get_chroma_store()
        self.embedding_manager = get_embedding_manager()

    def query(
        self,
        query_text: str,
        top_k: int = 20,
        where_filter: Optional[Dict[str, Any]] = None,
        collection_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Embeds the query text and retrieves top_k semantically nearest chunks.
        where_filter ensures only authorized documents/chunks are returned.
        """
        if not query_text.strip():
            return []

        try:
            # Generate query embedding
            query_embedding = self.embedding_manager.embed_query(query_text)

            # Query Chroma vector store
            raw_results = self.chroma_store.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                collection_name=collection_name,
            )

            # Format results into standardized dict list
            results: List[Dict[str, Any]] = []
            if not raw_results or not raw_results.get("ids"):
                return []

            ids = raw_results["ids"][0]
            documents = raw_results["documents"][0] if "documents" in raw_results else []
            metadatas = raw_results["metadatas"][0] if "metadatas" in raw_results else []
            distances = raw_results.get("distances", [[]])[0]

            for i, doc_id in enumerate(ids):
                text = documents[i] if i < len(documents) else ""
                metadata = metadatas[i] if i < len(metadatas) else {}
                dist = distances[i] if i < len(distances) else 1.0

                # Convert distance (cosine distance) to similarity score between 0 and 1
                # Chroma default cosine distance is in [0, 2], where 0 is identical.
                # For unit vectors, cosine similarity = 1 - cosine_distance
                score = max(0.0, min(1.0, 1.0 - dist))

                results.append({
                    "id": doc_id,
                    "text": text,
                    "metadata": metadata,
                    "score": score,
                    "raw_distance": dist,
                    "retrieval_type": "dense",
                })

            return results
        except Exception as e:
            logger.error(f"Error in dense retrieval: {e}", exc_info=True)
            return []


# Global singleton
_global_dense_retriever: Optional[DenseRetriever] = None


def get_dense_retriever() -> DenseRetriever:
    global _global_dense_retriever
    if _global_dense_retriever is None:
        _global_dense_retriever = DenseRetriever()
    return _global_dense_retriever
