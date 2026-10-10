"""
Circuit Breaker implementation for LLM API keys and providers.
Prevents cascading failures and enforces cooldowns when APIs return 429 or 503.
"""

from __future__ import annotations

import enum
import time
import logging
from typing import Optional

logger = logging.getLogger("rag_service.providers.circuit_breaker")


class CircuitState(str, enum.Enum):
    CLOSED = "CLOSED"        # Normal operation
    OPEN = "OPEN"            # Tripped, rejecting calls, cooling down
    HALF_OPEN = "HALF_OPEN"  # Testing a single request to verify recovery


class CircuitBreaker:
    """
    Tracks failure rates and manages cooldowns for an individual API key.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        cooldown_seconds: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: float = 0.0
        self.last_success_time: float = 0.0
        self.last_error: Optional[str] = None

    def can_execute(self) -> bool:
        """Checks if a request is permitted under circuit breaker rules."""
        now = time.time()
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            if now - self.last_failure_time >= self.cooldown_seconds:
                logger.info(f"Circuit breaker {self.name}: Cooldown elapsed, transitioning to HALF_OPEN")
                self.state = CircuitState.HALF_OPEN
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            return True

        return False

    def record_success(self) -> None:
        """Records a successful API call, resetting failure counts."""
        self.failure_count = 0
        self.last_success_time = time.time()
        if self.state != CircuitState.CLOSED:
            logger.info(f"Circuit breaker {self.name}: Call succeeded, resetting state to CLOSED")
            self.state = CircuitState.CLOSED

    def record_failure(self, error: Exception, is_rate_limit: bool = False) -> None:
        """Records a failed API call, tripping the circuit if threshold exceeded."""
        self.last_failure_time = time.time()
        self.last_error = str(error)
        self.failure_count += 1

        # Rate limits (429) or repeated failures trip circuit immediately
        if is_rate_limit or self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            cooldown = self.cooldown_seconds * 1.5 if is_rate_limit else self.cooldown_seconds
            logger.warning(
                f"Circuit breaker {self.name} TRIPPED to OPEN! Failures: {self.failure_count}, "
                f"RateLimit: {is_rate_limit}. Cooling down for {cooldown:.1f}s. Error: {str(error)[:120]}"
            )
