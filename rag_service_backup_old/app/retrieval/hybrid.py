"""
Hybrid Retriever with Reciprocal Rank Fusion (RRF) and Reranking.
Combines semantic dense search (Chroma + BGE-M3) with lexical sparse search (BM25).
Enforces security authorization filters at every stage.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.retrieval.bm25 import BM25Retriever, get_bm25_retriever
from app.retrieval.dense import DenseRetriever, get_dense_retriever
from app.retrieval.reranker import BaseReranker, get_reranker

logger = logging.getLogger("rag_service.retrieval.hybrid")


def reciprocal_rank_fusion(
    ranked_lists: List[List[Dict[str, Any]]],
    k: int = 60,
    top_candidates: int = 30,
) -> List[Dict[str, Any]]:
    """
    Combines multiple ranked lists using Reciprocal Rank Fusion (RRF).
    Formula: RRF_score(d) = sum_{list L} (1 / (k + rank_L(d)))
    """
    scores: Dict[str, float] = {}
    doc_store: Dict[str, Dict[str, Any]] = {}

    for doc_list in ranked_lists:
        for rank, doc in enumerate(doc_list):
            doc_id = doc["id"]
            if doc_id not in doc_store:
                doc_store[doc_id] = doc

            contribution = 1.0 / (k + (rank + 1))
            scores[doc_id] = scores.get(doc_id, 0.0) + contribution

    # Sort documents by accumulated RRF score
    sorted_doc_ids = sorted(scores.keys(), key=lambda did: scores[did], reverse=True)

    fused_results = []
    for did in sorted_doc_ids[:top_candidates]:
        doc = dict(doc_store[did])
        doc["rrf_score"] = round(scores[did], 6)
        doc["score"] = doc["rrf_score"]
        fused_results.append(doc)

    return fused_results


class HybridRetriever:
    """
    Hybrid Retriever orchestrating Dense + BM25 retrieval, RRF fusion, and Reranking.
    """

    def __init__(
        self,
        dense_retriever: Optional[DenseRetriever] = None,
        sparse_retriever: Optional[BM25Retriever] = None,
        reranker: Optional[BaseReranker] = None,
    ):
        self.settings = get_settings()
        self.dense_retriever = dense_retriever or get_dense_retriever()
        self.sparse_retriever = sparse_retriever or get_bm25_retriever()
        self.reranker = reranker or get_reranker()

    def retrieve(
        self,
        query: str,
        where_filter: Optional[Dict[str, Any]] = None,
        top_k: int = 5,
        dense_top_k: int = 20,
        sparse_top_k: int = 20,
        collection_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes hybrid retrieval:
        1. Dense retrieval (Chroma + BGE-M3) with security filter
        2. Sparse retrieval (BM25) with security filter
        3. Reciprocal Rank Fusion
        4. Reranking candidates
        Returns dict containing results and retrieval telemetry.
        """
        logger.info(f"Hybrid retrieval initiated for query: '{query[:60]}...' with security filter: {where_filter}")

        # 1. Dense retrieval
        dense_results = self.dense_retriever.query(
            query_text=query,
            top_k=dense_top_k,
            where_filter=where_filter,
            collection_name=collection_name,
        )

        # 2. Sparse retrieval
        sparse_results = self.sparse_retriever.query(
            query_text=query,
            top_k=sparse_top_k,
            where_filter=where_filter,
        )

        logger.debug(f"Retrieved {len(dense_results)} dense candidates and {len(sparse_results)} sparse candidates")

        # 3. Reciprocal Rank Fusion
        candidate_pool = reciprocal_rank_fusion(
            ranked_lists=[dense_results, sparse_results],
            k=60,
            top_candidates=max(30, top_k * 4),
        )

        # 4. Rerank candidate pool
        if candidate_pool:
            reranked_results = self.reranker.rerank(
                query=query,
                documents=candidate_pool,
                top_n=top_k,
            )
        else:
            reranked_results = []

        return {
            "documents": reranked_results,
            "telemetry": {
                "strategy": "hybrid",
                "dense_candidates": len(dense_results),
                "sparse_candidates": len(sparse_results),
                "fused_candidates": len(candidate_pool),
                "reranked": len(reranked_results),
            },
        }


# Global singleton
_global_hybrid_retriever: Optional[HybridRetriever] = None


def get_hybrid_retriever() -> HybridRetriever:
    global _global_hybrid_retriever
    if _global_hybrid_retriever is None:
        _global_hybrid_retriever = HybridRetriever()
    return _global_hybrid_retriever
