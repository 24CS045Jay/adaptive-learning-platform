"""Central configuration. Reads rag_service/.env first, then repo-root .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent.parent  # rag_service/
load_dotenv(_HERE / ".env", override=False)
load_dotenv(_HERE.parent / ".env", override=False)  # repo root .env (shared with Express)


def _b(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _i(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    port: int
    internal_token: str
    offline: bool
    # llm
    gemini_key: str
    groq_key: str
    openai_key: str
    provider_order: tuple[str, ...]
    gemini_heavy: str
    gemini_light: str
    groq_heavy: str
    groq_light: str
    openai_heavy: str
    openai_light: str
    # embeddings
    embedding_provider: str
    gemini_embedding_model: str
    gemini_embedding_dim: int
    openai_embedding_model: str
    local_embedding_model: str
    # chroma
    chroma_api_key: str
    chroma_tenant: str
    chroma_database: str
    chroma_local_dir: str
    # retrieval
    chunk_size: int
    chunk_overlap: int
    dense_k: int
    sparse_k: int
    final_k: int
    min_relevance: float
    max_rounds: int

    @property
    def use_chroma_cloud(self) -> bool:
        # Offline/test mode NEVER touches Chroma Cloud (protects production data from test writes)
        if self.offline:
            return False
        return bool(self.chroma_api_key and self.chroma_tenant and self.chroma_database)


@lru_cache
def get_settings() -> Settings:
    offline = _b("RAG_OFFLINE")
    return Settings(
        port=_i("SERVICE_PORT", 8001),
        internal_token=os.getenv("INTERNAL_SERVICE_TOKEN", "").strip(),
        offline=offline,
        gemini_key=os.getenv("GEMINI_API_KEY", "").strip(),
        groq_key=os.getenv("GROQ_API_KEY", "").strip(),
        openai_key=os.getenv("OPENAI_API_KEY", "").strip(),
        provider_order=tuple(
            p.strip().lower()
            for p in os.getenv("LLM_PROVIDER_ORDER", "gemini,groq,openai").split(",")
            if p.strip()
        ),
        gemini_heavy=os.getenv("GEMINI_HEAVY_MODEL", "gemini-2.5-flash"),
        gemini_light=os.getenv("GEMINI_LIGHT_MODEL", "gemini-2.5-flash-lite"),
        groq_heavy=os.getenv("GROQ_HEAVY_MODEL", "llama-3.3-70b-versatile"),
        groq_light=os.getenv("GROQ_LIGHT_MODEL", "llama-3.1-8b-instant"),
        openai_heavy=os.getenv("OPENAI_HEAVY_MODEL", "gpt-4o-mini"),
        openai_light=os.getenv("OPENAI_LIGHT_MODEL", "gpt-4o-mini"),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "gemini").strip().lower(),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        gemini_embedding_dim=_i("GEMINI_EMBEDDING_DIM", 768),
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        local_embedding_model=os.getenv(
            "LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        ),
        chroma_api_key=os.getenv("CHROMA_API_KEY", "").strip(),
        chroma_tenant=os.getenv("CHROMA_TENANT", "").strip(),
        chroma_database=os.getenv("CHROMA_DATABASE", "").strip(),
        chroma_local_dir=os.getenv("CHROMA_LOCAL_DIR", str(_HERE / "chroma_data")),
        chunk_size=_i("CHUNK_SIZE", 900),
        chunk_overlap=_i("CHUNK_OVERLAP", 150),
        dense_k=_i("DENSE_K", 12),
        sparse_k=_i("SPARSE_K", 12),
        final_k=_i("FINAL_K", 5),
        min_relevance=_f("MIN_RELEVANCE", 0.15),
        max_rounds=_i("MAX_RETRIEVAL_ROUNDS", 2),
    )


def reset_settings_cache() -> None:
    get_settings.cache_clear()
