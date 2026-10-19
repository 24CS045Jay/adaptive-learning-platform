"""Information Retrieval and RAG Generation Evaluation Metrics for EduSense AI.

Calculates:
- Recall@k, Precision@k
- Mean Reciprocal Rank (MRR)
- Normalized Discounted Cumulative Gain (nDCG@k)
- Answer Faithfulness / Groundedness
- Citation Correctness
- Active-Version Accuracy
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence


def precision_at_k(retrieved_docs: Sequence[Dict[str, Any]], expected_docs: Sequence[str], k: int = 5) -> float:
    """Proportion of retrieved docs in top-k that are relevant."""
    if not retrieved_docs or not expected_docs:
        return 0.0
    top_k = retrieved_docs[:k]
    hits = 0
    for doc in top_k:
        fn = doc.get("file_name") or doc.get("metadata", {}).get("file_name", "")
        if any(exp.lower() in fn.lower() for exp in expected_docs):
            hits += 1
    return hits / min(k, len(top_k))


def recall_at_k(retrieved_docs: Sequence[Dict[str, Any]], expected_docs: Sequence[str], k: int = 5) -> float:
    """Proportion of all expected relevant docs that appear in top-k."""
    if not expected_docs:
        return 1.0
    if not retrieved_docs:
        return 0.0
    top_k = retrieved_docs[:k]
    found = set()
    for doc in top_k:
        fn = doc.get("file_name") or doc.get("metadata", {}).get("file_name", "")
        for exp in expected_docs:
            if exp.lower() in fn.lower():
                found.add(exp.lower())
    return len(found) / len(expected_docs)


def reciprocal_rank(retrieved_docs: Sequence[Dict[str, Any]], expected_docs: Sequence[str]) -> float:
    """Reciprocal rank of first relevant retrieved document (1/rank)."""
    for rank, doc in enumerate(retrieved_docs, start=1):
        fn = doc.get("file_name") or doc.get("metadata", {}).get("file_name", "")
        if any(exp.lower() in fn.lower() for exp in expected_docs):
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved_docs: Sequence[Dict[str, Any]], expected_docs: Sequence[str], k: int = 5) -> float:
    """Normalized Discounted Cumulative Gain at rank k."""
    if not expected_docs or not retrieved_docs:
        return 0.0

    dcg = 0.0
    top_k = retrieved_docs[:k]
    for i, doc in enumerate(top_k):
        fn = doc.get("file_name") or doc.get("metadata", {}).get("file_name", "")
        rel = 1.0 if any(exp.lower() in fn.lower() for exp in expected_docs) else 0.0
        dcg += rel / math.log2(i + 2)

    # Ideal DCG: all expected docs ranked at the top
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(k, len(expected_docs))))
    if idcg == 0.0:
        return 0.0
    return dcg / idcg


def evaluate_active_version_retrieval(retrieved_docs: Sequence[Dict[str, Any]]) -> float:
    """Checks whether 100% of retrieved chunks belong to currently active versions."""
    if not retrieved_docs:
        return 1.0
    active_count = sum(1 for d in retrieved_docs if d.get("metadata", {}).get("is_active", True))
    return active_count / len(retrieved_docs)


def evaluate_citation_correctness(citations: Sequence[Dict[str, Any]], retrieved_docs: Sequence[Dict[str, Any]]) -> float:
    """Ensures that cited documents actually exist among retrieved evidence."""
    if not citations:
        return 1.0
    retrieved_cids = {
        d.get("chunk_id") or d.get("metadata", {}).get("chunk_id")
        for d in retrieved_docs
    }
    retrieved_fnames = {
        (d.get("file_name") or d.get("metadata", {}).get("file_name", "")).lower()
        for d in retrieved_docs
    }
    valid = 0
    for cite in citations:
        fn = (cite.get("file_name") or "").lower()
        cid = cite.get("document_id") or cite.get("chunk_id")
        if (fn and fn in retrieved_fnames) or (cid and cid in retrieved_cids):
            valid += 1
    return valid / len(citations)
