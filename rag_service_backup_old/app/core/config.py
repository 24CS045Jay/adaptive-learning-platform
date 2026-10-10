"""
Core configuration for the RAG service.
All settings are loaded from environment variables with sensible defaults.
"""

from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional

try:
    from dotenv import load_dotenv
    # Load root .env (parent) and local .env (if present)
    root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
    local_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if root_env.exists():
        load_dotenv(root_env, override=False)
    if local_env.exists():
        load_dotenv(local_env, override=True)
    load_dotenv(override=False)
except ImportError:
    pass


@dataclass(frozen=True)
class Settings:
    """Immutable application settings — loaded once at startup."""

    # ── Service ───────────────────────────────────────────────────────────
    SERVICE_NAME: str = "adaptive-rag-service"
    SERVICE_PORT: int = 8001
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ── Internal service auth ─────────────────────────────────────────────
    INTERNAL_SERVICE_TOKEN: str = ""  # shared secret with Express backend

    # ── Environment & Mode ────────────────────────────────────────────────
    RAG_ENV: str = "development"  # "production" | "development"
    ALLOW_LOCAL_VECTOR_FALLBACK: bool = True  # strictly False in production

    # ── Chroma Vector Store ───────────────────────────────────────────────
    CHROMA_MODE: str = "local"  # "cloud" | "local"
    CANONICAL_COLLECTION: str = "rag_unified_v1"
    CHROMA_API_KEY: str = ""
    CHROMA_TENANT: str = ""
    CHROMA_DATABASE: str = ""
    CHROMA_HOST: str = ""  # Optional: for self-hosted Chroma server
    CHROMA_PORT: int = 8000
    CHROMA_COLLECTION_PREFIX: str = "rag"
    CHROMA_LOCAL_PERSIST_DIR: str = "./chroma_data"
    CHROMA_USE_LOCAL: bool = True

    # ── Embedding ─────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_DIMENSION: int = 1024  # BGE-M3 dense dimension
    # Lightweight fallback for dev machines without enough RAM
    EMBEDDING_FALLBACK_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_FALLBACK_DIMENSION: int = 384

    # ── LLM — Gemini (primary) ────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_TEMPERATURE: float = 0.2
    GEMINI_MAX_TOKENS: int = 2048
    GEMINI_TIMEOUT: int = 15

    # ── LLM — Groq (fallback) ────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    GROQ_TEMPERATURE: float = 0.2
    GROQ_MAX_TOKENS: int = 2048
    GROQ_TIMEOUT: int = 15

    # ── LLM — OpenAI (optional) ──────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TEMPERATURE: float = 0.2
    OPENAI_MAX_TOKENS: int = 2048
    OPENAI_TIMEOUT: int = 15

    # ── Retrieval ─────────────────────────────────────────────────────────
    DENSE_TOP_K: int = 20
    SPARSE_TOP_K: int = 20
    RERANK_TOP_K: int = 7
    FINAL_TOP_K: int = 5
    RRF_K: int = 60  # RRF constant

    # ── Agent limits ──────────────────────────────────────────────────────
    MAX_RETRIEVAL_RETRIES: int = 2
    MAX_GENERATION_RETRIES: int = 1
    EVIDENCE_THRESHOLD: float = 0.4
    CONFIDENCE_THRESHOLD: float = 0.35
    GROUNDING_THRESHOLD: float = 0.5

    # ── Chunking ──────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    MAX_CHUNK_SIZE: int = 1024
    MIN_CHUNK_SIZE: int = 50

    # ── Rate limiting ─────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 20

    # ── Redis ─────────────────────────────────────────────────────────────
    REDIS_URL: str = ""

    # ── Reranker ──────────────────────────────────────────────────────────
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    COHERE_API_KEY: str = ""  # Optional commercial reranker

    @property
    def environment(self) -> str:
        return "development" if self.DEBUG else "production"

    @property
    def primary_llm_provider(self) -> str:
        return "gemini"

    @property
    def service_host(self) -> str:
        return "0.0.0.0"

    @property
    def service_port(self) -> int:
        return self.SERVICE_PORT

    @property
    def is_chroma_cloud(self) -> bool:
        return bool(self.CHROMA_API_KEY and self.CHROMA_TENANT and not self.CHROMA_USE_LOCAL)

    @property
    def reranker_model(self) -> str:
        return self.RERANKER_MODEL

    @property
    def redis_url(self) -> str:
        return self.REDIS_URL or "redis://localhost:6379/0"


def _env(key: str, default):
    """Read an env var, casting to the type of *default*."""
    raw = os.getenv(key)
    if raw is None:
        return default
    if isinstance(default, bool):
        return raw.lower() in ("1", "true", "yes")
    if isinstance(default, int):
        try:
            return int(raw)
        except ValueError:
            return default
    if isinstance(default, float):
        try:
            return float(raw)
        except ValueError:
            return default
    return raw


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (cached)."""
    kwargs = {}
    for fld_name, fld_obj in Settings.__dataclass_fields__.items():
        kwargs[fld_name] = _env(fld_name, fld_obj.default)
    return Settings(**kwargs)
