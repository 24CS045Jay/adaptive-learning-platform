"""
Multi-signal confidence calculation and evaluation metrics for University Agentic RAG.
Enforces Rule 10: Confidence is NEVER based purely on vector distance.
Combines retrieval density, rerank scores, evidence coverage, and answer grounding.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger("rag_service.evaluation.metrics")


def calculate_multi_signal_confidence(
    retrieved_docs: List[Dict[str, Any]],
    evidence_score: float,
    grounding_score: float,
    has_tool_result: bool = False,
) -> float:
    """
    Computes a grounded multi-signal confidence score between 0.0 and 1.0.

    Weights:
    - 0.35 Grounding score (answer claims supported by retrieved sources)
    - 0.25 Evidence coverage (evidence validation score)
    - 0.25 Reranker quality (average of top reranked chunks)
    - 0.15 Retrieval diversity & source strength
    """
    if not retrieved_docs and not has_tool_result:
        return 0.1

    # 1. Reranker / Retrieval Score
    rerank_scores = []
    for d in retrieved_docs[:5]:
        s = d.get("rerank_score", d.get("score", 0.5))
        rerank_scores.append(max(0.0, min(1.0, float(s))))

    avg_rerank = (sum(rerank_scores) / len(rerank_scores)) if rerank_scores else 0.5

    # 2. Source quantity / diversity score
    num_sources = len(set(d.get("metadata", {}).get("document_id") for d in retrieved_docs if d.get("metadata")))
    source_diversity = min(1.0, num_sources / 2.0)

    # 3. If tools provided direct numerical computation
    tool_bonus = 0.1 if has_tool_result else 0.0

    # 4. Multi-signal formula
    confidence = (
        (0.35 * max(0.0, min(1.0, grounding_score)))
        + (0.25 * max(0.0, min(1.0, evidence_score)))
        + (0.25 * avg_rerank)
        + (0.15 * source_diversity)
        + tool_bonus
    )

    final_confidence = round(max(0.05, min(0.99, confidence)), 2)
    logger.debug(
        f"Calculated confidence={final_confidence} (grounding={grounding_score:.2f}, "
        f"evidence={evidence_score:.2f}, rerank={avg_rerank:.2f}, sources={num_sources})"
    )
    return final_confidence


def extract_citations_from_docs(retrieved_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Converts retrieved documents into standardized citation structures per Section 32 & 33.
    """
    citations = []
    seen = set()

    for doc in retrieved_docs:
        meta = doc.get("metadata", {})
        doc_id = meta.get("document_id") or doc.get("id", "unknown")
        page = meta.get("page")
        section = meta.get("section") or meta.get("heading") or "General"
        file_name = meta.get("file_name") or meta.get("title") or "Course Material"

        key = f"{doc_id}_{page}_{section}"
        if key in seen:
            continue
        seen.add(key)

        citations.append({
            "document_id": str(doc_id),
            "file_name": str(file_name),
            "page": int(page) if page is not None and str(page).isdigit() else None,
            "section": str(section),
            "score": round(float(doc.get("rerank_score", doc.get("score", 0.0))), 3),
        })

    return citations
