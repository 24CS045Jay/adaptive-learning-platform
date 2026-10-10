"""
Reranker abstraction and implementations.
Reranks hybrid candidate chunks to produce the top K most relevant contexts.
Supports Cross-Encoder model and fallback scoring router.
"""

from __future__ import annotations

import logging
import math
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger("rag_service.retrieval.reranker")


def _sigmoid(x: float) -> float:
    """Calibrate unbounded cross-encoder logits into [0, 1] probability range."""
    try:
        return 1.0 / (1.0 + math.exp(-float(x)))
    except OverflowError:
        return 0.0 if x < 0 else 1.0


class BaseReranker(ABC):
    """Abstract reranker interface."""

    @abstractmethod
    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        """Rerank candidates and return the top_n items."""
        pass

    @abstractmethod
    def get_telemetry(self) -> Dict[str, Any]:
        """Return reranker status and fallback telemetry."""
        pass


class CrossEncoderReranker(BaseReranker):
    """
    Reranker using cross-encoder architecture (e.g., BAAI/bge-reranker-base or ms-marco-MiniLM).
    Applies calibrated sigmoid normalization to map raw logits into [0, 1].
    """

    def __init__(self, model_name: Optional[str] = None):
        settings = get_settings()
        self.model_name = model_name or settings.reranker_model
        self.model = None
        self.fallback_used = False
        self._load_model()

    def _load_model(self):
        try:
            from sentence_transformers import CrossEncoder
            logger.info(f"Loading CrossEncoder model: {self.model_name}")
            self.model = CrossEncoder(self.model_name)
            self.fallback_used = False
            logger.info("CrossEncoder model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load CrossEncoder ({e}). Falling back to HeuristicReranker.")
            self.model = None
            self.fallback_used = True

    def get_telemetry(self) -> Dict[str, Any]:
        return {
            "requested": self.model_name,
            "active": "cross_encoder" if (self.model is not None and not self.fallback_used) else "heuristic",
            "fallback_used": self.fallback_used or (self.model is None),
        }

    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        if not documents:
            return []

        if self.model is None:
            self.fallback_used = True
            fallback = HeuristicReranker()
            return fallback.rerank(query, documents, top_n)

        try:
            pairs = [[query, doc.get("text", "")] for doc in documents]
            scores = self.model.predict(pairs)

            ranked = []
            for doc, raw_score in zip(documents, scores):
                doc_copy = dict(doc)
                normalized_score = round(_sigmoid(float(raw_score)), 4)
                doc_copy["raw_rerank_score"] = float(raw_score)
                doc_copy["rerank_score"] = normalized_score
                doc_copy["rerank_telemetry"] = {
                    "requested": self.model_name,
                    "active": "cross_encoder",
                    "fallback_used": False,
                }
                ranked.append(doc_copy)

            ranked.sort(key=lambda x: x["rerank_score"], reverse=True)
            return ranked[:top_n]
        except Exception as e:
            logger.error(f"CrossEncoder prediction failed: {e}. Falling back to heuristic reranker.")
            self.fallback_used = True
            fallback = HeuristicReranker()
            return fallback.rerank(query, documents, top_n)


class HeuristicReranker(BaseReranker):
    """
    Lightweight heuristic reranker based on lexical term matching, heading relevance,
    and original hybrid score. Fast and requires zero additional neural network memory.
    """

    def get_telemetry(self) -> Dict[str, Any]:
        return {
            "requested": "heuristic",
            "active": "heuristic",
            "fallback_used": True,
        }

    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        if not documents:
            return []

        query_terms = set(query.lower().split())

        ranked = []
        for doc in documents:
            doc_copy = dict(doc)
            text = doc_copy.get("text", "").lower()
            metadata = doc_copy.get("metadata", {})
            section = str(metadata.get("section", "")).lower()

            # Base score from hybrid retrieval / RRF
            base_score = doc_copy.get("score", 0.0)

            # Term overlap score
            matched_terms = sum(1 for term in query_terms if term in text)
            overlap_ratio = matched_terms / max(1, len(query_terms))

            # Heading/section bonus
            section_bonus = 0.15 if any(term in section for term in query_terms) else 0.0

            # Title bonus
            title = str(metadata.get("title", "")).lower()
            title_bonus = 0.1 if any(term in title for term in query_terms) else 0.0

            final_score = (base_score * 0.5) + (overlap_ratio * 0.35) + section_bonus + title_bonus
            # Clamp between 0.0 and 1.0
            clamped_score = max(0.0, min(1.0, float(final_score)))
            doc_copy["rerank_score"] = round(clamped_score, 4)
            doc_copy["rerank_telemetry"] = {
                "requested": "cross_encoder",
                "active": "heuristic",
                "fallback_used": True,
            }
            ranked.append(doc_copy)

        ranked.sort(key=lambda x: x["rerank_score"], reverse=True)
        return ranked[:top_n]


_global_reranker: Optional[BaseReranker] = None


def get_reranker() -> BaseReranker:
    global _global_reranker
    if _global_reranker is None:
        _global_reranker = CrossEncoderReranker()
    return _global_reranker
