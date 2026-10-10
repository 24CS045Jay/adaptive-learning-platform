"""
Provider and API Key Health & Telemetry.
Tracks per-key concurrency, latency, error count, and status without exposing raw keys.
"""

from __future__ import annotations

import time
from typing import Dict, Any, Optional
from app.providers.circuit_breaker import CircuitBreaker, CircuitState


class ProviderKeyHealth:
    """
    Monitors health, concurrency, and performance for a single API key.
    """

    def __init__(
        self,
        provider: str,
        key_index: int,
        key_snippet: str,
        max_concurrency: int = 4,
    ):
        self.provider = provider
        self.key_index = key_index
        self.key_snippet = key_snippet  # e.g. "...AIza"
        self.max_concurrency = max_concurrency
        self.current_concurrency = 0
        self.total_calls = 0
        self.total_errors = 0
        self.latency_ema = 0.0  # exponential moving average in ms
        self.circuit_breaker = CircuitBreaker(
            name=f"{provider}-key-{key_index}",
            failure_threshold=3,
            cooldown_seconds=60.0,
        )

    def is_available(self) -> bool:
        """Key is available if circuit allows execution and under concurrency limit."""
        if not self.circuit_breaker.can_execute():
            return False
        if self.current_concurrency >= self.max_concurrency:
            return False
        return True

    def acquire(self) -> bool:
        """Acquires a concurrency slot."""
        if not self.is_available():
            return False
        self.current_concurrency += 1
        self.total_calls += 1
        return True

    def release(self, latency_ms: float, success: bool, error: Optional[Exception] = None) -> None:
        """Releases the concurrency slot and updates telemetry."""
        self.current_concurrency = max(0, self.current_concurrency - 1)
        if success:
            self.circuit_breaker.record_success()
            if self.latency_ema == 0.0:
                self.latency_ema = latency_ms
            else:
                self.latency_ema = 0.8 * self.latency_ema + 0.2 * latency_ms
        else:
            self.total_errors += 1
            is_429 = False
            if error:
                err_str = str(error).lower()
                is_429 = "429" in err_str or "quota" in err_str or "rate limit" in err_str
            self.circuit_breaker.record_failure(error or Exception("Unknown error"), is_rate_limit=is_429)

    def to_dict(self) -> Dict[str, Any]:
        """Telemetry representation without exposing secret keys."""
        return {
            "provider": self.provider,
            "key_index": self.key_index,
            "key_masked": self.key_snippet,
            "circuit_state": self.circuit_breaker.state.value,
            "concurrency_current": self.current_concurrency,
            "concurrency_max": self.max_concurrency,
            "total_calls": self.total_calls,
            "total_errors": self.total_errors,
            "latency_ema_ms": round(self.latency_ema, 2),
            "healthy": self.circuit_breaker.state == CircuitState.CLOSED,
        }
