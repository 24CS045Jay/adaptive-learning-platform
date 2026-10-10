"""
Embedding manager — loads BGE-M3 (or fallback) once at startup.
Provides both dense and sparse embedding capabilities for hybrid retrieval.
Uses LangChain's Embeddings interface for compatibility.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from langchain_core.embeddings import Embeddings

from app.core.config import get_settings

logger = logging.getLogger("rag_service.embeddings")

# ── Global singleton ──────────────────────────────────────────────────────────
_manager: "EmbeddingManager | None" = None


class EmbeddingManager(Embeddings):
    """
    Wraps sentence-transformers (or FlagEmbedding for BGE-M3) behind
    the LangChain Embeddings interface.

    Dense embeddings are used for semantic retrieval.
    Sparse token weights (when available) are used for lexical retrieval.
    """

    def __init__(self):
        settings = get_settings()
        self.model_name = settings.EMBEDDING_MODEL
        self.device = settings.EMBEDDING_DEVICE
        self.batch_size = settings.EMBEDDING_BATCH_SIZE
        self.dimension = settings.EMBEDDING_DIMENSION
        self._model = None
        self._is_bge_m3 = False
        self._is_fallback = False

    @property
    def model_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load the embedding model into memory (called once at startup)."""
        settings = get_settings()

        # Try BGE-M3 first if configured
        if "bge-m3" in self.model_name.lower():
            try:
                from FlagEmbedding import BGEM3FlagModel

                logger.info("Loading BGE-M3 model: %s on %s", self.model_name, self.device)
                self._model = BGEM3FlagModel(
                    self.model_name,
                    use_fp16=(self.device != "cpu"),
                )
                self._is_bge_m3 = True
                self.dimension = settings.EMBEDDING_DIMENSION
                logger.info("✅ BGE-M3 loaded successfully (dim=%d)", self.dimension)
                return
            except Exception as e:
                logger.warning("BGE-M3 unavailable (%s), trying fallback model...", e)

        # Fallback to sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer

            fallback = settings.EMBEDDING_FALLBACK_MODEL
            logger.info("Loading fallback model: %s", fallback)
            self._model = SentenceTransformer(fallback, device=self.device)
            self._is_fallback = True
            self.dimension = settings.EMBEDDING_FALLBACK_DIMENSION
            self.model_name = fallback
            logger.info("[OK] Fallback model loaded (dim=%d)", self.dimension)
        except Exception as e:
            logger.error("CRITICAL: No embedding model could be loaded: %s", e)
            raise RuntimeError(f"No embedding model available: {e}") from e

    def validate_vector(self, vector: list[float]) -> bool:
        """Assert that vector length strictly matches expected dimension (Section 8)."""
        if len(vector) != self.dimension:
            raise ValueError(
                f"Embedding dimension mismatch: expected {self.dimension}, got {len(vector)} "
                f"for model {self.model_name}"
            )
        return True

    # ── LangChain Embeddings interface ────────────────────────────────────

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of document texts (dense vectors) with dimension validation."""
        vectors = self._encode_dense(texts)
        if vectors:
            self.validate_vector(vectors[0])
        return vectors

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string (dense vector) with dimension validation."""
        vector = self._encode_dense([text])[0]
        self.validate_vector(vector)
        return vector

    # ── Dense encoding ────────────────────────────────────────────────────

    def _encode_dense(self, texts: list[str]) -> list[list[float]]:
        if not self._model:
            raise RuntimeError("Embedding model not loaded. Call load() first.")

        if self._is_bge_m3:
            output = self._model.encode(
                texts,
                batch_size=self.batch_size,
                max_length=512,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            # BGE-M3 returns dict with 'dense_vecs'
            vecs = output["dense_vecs"]
            if isinstance(vecs, np.ndarray):
                return vecs.tolist()
            return [v.tolist() if hasattr(v, "tolist") else list(v) for v in vecs]
        else:
            # sentence-transformers
            embeddings = self._model.encode(
                texts,
                batch_size=self.batch_size,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            return embeddings.tolist()

    # ── Sparse encoding (BGE-M3 only) ────────────────────────────────────

    def encode_sparse(self, texts: list[str]) -> list[dict[str, float]]:
        """
        Return sparse token weight dicts for BM25-style retrieval.
        Only available with BGE-M3; returns empty dicts otherwise.
        """
        if not self._is_bge_m3 or not self._model:
            return [{} for _ in texts]

        output = self._model.encode(
            texts,
            batch_size=self.batch_size,
            max_length=512,
            return_dense=False,
            return_sparse=True,
            return_colbert_vecs=False,
        )
        # Returns dict with 'lexical_weights' — list of dicts {token_id: weight}
        return output.get("lexical_weights", [{} for _ in texts])

    @property
    def has_sparse(self) -> bool:
        return self._is_bge_m3

    @property
    def info(self) -> dict[str, Any]:
        return {
            "model": self.model_name,
            "dimension": self.dimension,
            "device": self.device,
            "is_bge_m3": self._is_bge_m3,
            "is_fallback": self._is_fallback,
            "has_sparse": self.has_sparse,
        }


def get_embedding_manager() -> EmbeddingManager:
    """Get or create the singleton EmbeddingManager."""
    global _manager
    if _manager is None:
        _manager = EmbeddingManager()
        _manager.load()
    return _manager


def init_embedding_manager() -> EmbeddingManager:
    """Explicitly initialize the embedding manager at startup."""
    global _manager
    _manager = EmbeddingManager()
    _manager.load()
    return _manager
