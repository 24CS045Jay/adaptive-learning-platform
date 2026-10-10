"""
Multi-Key LLM Provider Pool with Load Balancing, Key Rotation, and Fail-Closed Guardrails.
Rotates keys across Gemini, Groq, and OpenAI pools, respecting concurrency limits and circuit breakers.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.providers.health import ProviderKeyHealth

logger = logging.getLogger("rag_service.providers.pool")


class GenerationUnavailableError(RuntimeError):
    """Raised when all available LLM providers have failed or are cooling down."""
    pass


class KeyEntry:
    def __init__(self, provider: str, index: int, raw_key: str, model_factory):
        masked = f"...{raw_key[-4:]}" if len(raw_key) > 6 else "...***"
        self.provider = provider
        self.index = index
        self.raw_key = raw_key
        self.health = ProviderKeyHealth(provider=provider, key_index=index, key_snippet=masked)
        self.model_instance: Optional[BaseChatModel] = None
        self._factory = model_factory

    def get_model(self) -> BaseChatModel:
        if self.model_instance is None:
            self.model_instance = self._factory(self.raw_key)
        return self.model_instance


class ProviderPool:
    """
    Manages pools of API keys for each provider.
    """

    def __init__(self):
        self.gemini_keys: List[KeyEntry] = []
        self.groq_keys: List[KeyEntry] = []
        self.openai_keys: List[KeyEntry] = []
        self._load_keys()

    def _load_keys(self) -> None:
        settings = get_settings()

        # 1. Gemini Keys
        gemini_raw_keys = []
        multi_gemini = os.getenv("GEMINI_API_KEYS", "")
        if multi_gemini:
            gemini_raw_keys.extend([k.strip() for k in multi_gemini.split(",") if k.strip()])
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY not in gemini_raw_keys:
            gemini_raw_keys.append(settings.GEMINI_API_KEY)
        for i in range(1, 5):
            k = os.getenv(f"GEMINI_API_KEY_{i}")
            if k and k not in gemini_raw_keys:
                gemini_raw_keys.append(k.strip())

        for idx, key in enumerate(gemini_raw_keys):
            def make_gemini(k):
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=settings.GEMINI_MODEL,
                    google_api_key=k,
                    temperature=settings.GEMINI_TEMPERATURE,
                    max_output_tokens=settings.GEMINI_MAX_TOKENS,
                    timeout=settings.GEMINI_TIMEOUT,
                    max_retries=1,
                )
            self.gemini_keys.append(KeyEntry("gemini", idx, key, make_gemini))

        # 2. Groq Keys
        groq_raw_keys = []
        multi_groq = os.getenv("GROQ_API_KEYS", "")
        if multi_groq:
            groq_raw_keys.extend([k.strip() for k in multi_groq.split(",") if k.strip()])
        if settings.GROQ_API_KEY and settings.GROQ_API_KEY not in groq_raw_keys:
            groq_raw_keys.append(settings.GROQ_API_KEY)
        for i in range(1, 5):
            k = os.getenv(f"GROQ_API_KEY_{i}")
            if k and k not in groq_raw_keys:
                groq_raw_keys.append(k.strip())

        for idx, key in enumerate(groq_raw_keys):
            def make_groq(k):
                from langchain_groq import ChatGroq
                return ChatGroq(
                    model=settings.GROQ_MODEL,
                    api_key=k,
                    temperature=settings.GROQ_TEMPERATURE,
                    max_tokens=settings.GROQ_MAX_TOKENS,
                    timeout=settings.GROQ_TIMEOUT,
                )
            self.groq_keys.append(KeyEntry("groq", idx, key, make_groq))

        # 3. OpenAI Keys
        openai_raw_keys = []
        if settings.OPENAI_API_KEY:
            openai_raw_keys.append(settings.OPENAI_API_KEY)
        for idx, key in enumerate(openai_raw_keys):
            def make_openai(k):
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    model=settings.OPENAI_MODEL,
                    api_key=k,
                    temperature=settings.OPENAI_TEMPERATURE,
                    max_tokens=settings.OPENAI_MAX_TOKENS,
                    timeout=settings.OPENAI_TIMEOUT,
                )
            self.openai_keys.append(KeyEntry("openai", idx, key, make_openai))

        self._rr_cursors: Dict[str, int] = {"gemini": 0, "groq": 0, "openai": 0}
        logger.info(
            f"Provider Pool initialized: Gemini={len(self.gemini_keys)} keys, "
            f"Groq={len(self.groq_keys)} keys, OpenAI={len(self.openai_keys)} keys"
        )

    def select_best_key(self, provider_priority: List[str]) -> Optional[KeyEntry]:
        """
        Selects the best key following Section 12 rules:
        1. Filter to available keys (not cooling down, circuit closed, below concurrency limit)
        2. Prefer lowest concurrency load
        3. Prefer least-used key (total_calls)
        4. Break ties with round-robin cursor
        """
        for prov in provider_priority:
            pool = []
            if prov == "gemini":
                pool = self.gemini_keys
            elif prov == "groq":
                pool = self.groq_keys
            elif prov == "openai":
                pool = self.openai_keys

            available = [entry for entry in pool if entry.health.is_available()]
            if available:
                cursor = self._rr_cursors.get(prov, 0)
                # Sort criteria: (concurrency, total_calls, round_robin_offset, latency_ema)
                available.sort(
                    key=lambda e: (
                        e.health.current_concurrency,
                        e.health.total_calls,
                        (e.index - cursor) % max(1, len(pool)),
                        e.health.latency_ema,
                    )
                )
                selected = available[0]
                self._rr_cursors[prov] = (selected.index + 1) % max(1, len(pool))
                return selected

        return None

    def execute_with_failover(
        self,
        messages: List[Any],
        provider_order: Optional[List[str]] = None,
        max_attempts: int = 3,
    ) -> Tuple[str, str]:
        """
        Executes chat model request with key rotation and multi-provider failover.
        Fails closed: raises GenerationUnavailableError if no healthy key succeeded.
        """
        order = provider_order or ["gemini", "groq", "openai"]
        attempts = 0
        last_error = None

        while attempts < max_attempts:
            entry = self.select_best_key(order)
            if not entry:
                logger.error("No available LLM keys in pool (all cooling down or exceeded concurrency)")
                break

            if not entry.health.acquire():
                attempts += 1
                continue

            start_t = time.time()
            try:
                model = entry.get_model()
                response = model.invoke(messages)
                content = response.content if hasattr(response, "content") else str(response)
                if isinstance(content, list):
                    content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
                latency_ms = (time.time() - start_t) * 1000
                entry.health.release(latency_ms=latency_ms, success=True)
                return str(content).strip(), entry.provider
            except Exception as e:
                latency_ms = (time.time() - start_t) * 1000
                entry.health.release(latency_ms=latency_ms, success=False, error=e)
                last_error = e
                logger.warning(
                    f"LLM call failed on {entry.provider} key #{entry.index}: {e}. Failing over to next key..."
                )
                attempts += 1
                time.sleep(0.5)

        raise GenerationUnavailableError(f"All LLM keys failed or cooling down. Last error: {last_error}")

    async def aexecute_with_failover(
        self,
        messages: List[Any],
        provider_order: Optional[List[str]] = None,
        max_attempts: int = 3,
    ) -> Tuple[str, str]:
        """Async variant of execute_with_failover using ainvoke or controlled thread execution."""
        import asyncio
        order = provider_order or ["gemini", "groq", "openai"]
        attempts = 0
        last_error = None

        while attempts < max_attempts:
            entry = self.select_best_key(order)
            if not entry:
                logger.error("No available LLM keys in pool (all cooling down or exceeded concurrency)")
                break

            if not entry.health.acquire():
                attempts += 1
                continue

            start_t = time.time()
            try:
                model = entry.get_model()
                if hasattr(model, "ainvoke"):
                    response = await model.ainvoke(messages)
                else:
                    response = await asyncio.to_thread(model.invoke, messages)

                content = response.content if hasattr(response, "content") else str(response)
                if isinstance(content, list):
                    content = " ".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
                latency_ms = (time.time() - start_t) * 1000
                entry.health.release(latency_ms=latency_ms, success=True)
                return str(content).strip(), entry.provider
            except Exception as e:
                latency_ms = (time.time() - start_t) * 1000
                entry.health.release(latency_ms=latency_ms, success=False, error=e)
                last_error = e
                logger.warning(
                    f"Async LLM call failed on {entry.provider} key #{entry.index}: {e}. Failing over..."
                )
                attempts += 1
                await asyncio.sleep(0.5)

        raise GenerationUnavailableError(f"All LLM keys failed or cooling down. Last error: {last_error}")

    def get_status(self) -> Dict[str, Any]:
        """Returns health telemetry for all keys in the pool without exposing keys."""
        return {
            "gemini": [k.health.to_dict() for k in self.gemini_keys],
            "groq": [k.health.to_dict() for k in self.groq_keys],
            "openai": [k.health.to_dict() for k in self.openai_keys],
            "total_keys": len(self.gemini_keys) + len(self.groq_keys) + len(self.openai_keys),
        }


_global_pool: Optional[ProviderPool] = None


def get_provider_pool() -> ProviderPool:
    global _global_pool
    if _global_pool is None:
        _global_pool = ProviderPool()
    return _global_pool
