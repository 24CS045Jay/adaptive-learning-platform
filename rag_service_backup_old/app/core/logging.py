"""
Structured logging for the RAG service.
"""

from __future__ import annotations

import logging
import sys
import time
from typing import Any

from app.core.config import get_settings


def setup_logging() -> logging.Logger:
    """Configure and return the root RAG service logger."""
    settings = get_settings()
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger("rag_service")
    logger.setLevel(level)
    # Avoid duplicate handlers on reload
    if not logger.handlers:
        logger.addHandler(handler)

    # Suppress noisy third-party loggers
    for noisy in ("httpx", "httpcore", "chromadb", "urllib3", "sentence_transformers"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return logger


def get_logger(name: str = "rag_service") -> logging.Logger:
    """Get a child logger."""
    return logging.getLogger(name)


class RAGInteractionTracer:
    """
    Lightweight tracer that collects timing & event data for a single
    RAG interaction.  Produces the agent_trace list and latency metrics
    required by the response contract.
    """

    def __init__(self, request_id: str):
        self.request_id = request_id
        self.events: list[dict[str, Any]] = []
        self._start = time.perf_counter()
        self._step_start: float | None = None
        self.logger = get_logger("rag_service.tracer")

    def start_step(self, step_name: str) -> None:
        self._step_start = time.perf_counter()
        self.logger.debug("[%s] ▶ %s", self.request_id[:8], step_name)

    def end_step(self, step_name: str, metadata: dict | None = None) -> None:
        elapsed = (time.perf_counter() - (self._step_start or self._start)) * 1000
        event = {"step": step_name, "duration_ms": round(elapsed, 1)}
        if metadata:
            event["metadata"] = metadata
        self.events.append(event)
        self.logger.debug(
            "[%s] ✓ %s (%.1f ms)", self.request_id[:8], step_name, elapsed
        )

    @property
    def total_ms(self) -> float:
        return round((time.perf_counter() - self._start) * 1000, 1)

    @property
    def trace(self) -> list[str]:
        return [e["step"] for e in self.events]
