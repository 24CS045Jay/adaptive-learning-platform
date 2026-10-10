"""
LLM Provider Router — routes requests to the best available LLM.

Priority: Gemini → Groq → OpenAI
Includes timeout, retry with exponential backoff, and provider fallback.
Uses LangChain's LLM/ChatModel interfaces.
"""

from __future__ import annotations

import logging
import time
from enum import Enum
from typing import Any, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings

logger = logging.getLogger("rag_service.llm")


class LLMProvider(str, Enum):
    GEMINI = "gemini"
    GROQ = "groq"
    OPENAI = "openai"


class LLMTaskType(str, Enum):
    """Task types affect provider selection."""
    SIMPLE = "simple"           # Fast, cheap (Gemini Flash / Groq)
    COMPLEX = "complex"         # High-quality reasoning
    CLASSIFICATION = "classify" # Intent/query classification
    REWRITE = "rewrite"         # Query rewriting
    GENERATION = "generation"   # Answer generation
    VERIFICATION = "verify"     # Grounding verification
    FAST = "simple"
    SYNTHESIS = "generation"


TaskType = LLMTaskType


class LLMResponse:
    def __init__(self, content: str, provider: str = "gemini"):
        self.content = content
        self.provider = provider


def _create_gemini() -> Optional[BaseChatModel]:
    """Create a Gemini chat model via LangChain."""
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=settings.GEMINI_TEMPERATURE,
            max_output_tokens=settings.GEMINI_MAX_TOKENS,
            timeout=settings.GEMINI_TIMEOUT,
            max_retries=1,
        )
    except ImportError:
        logger.warning("langchain-google-genai not installed")
        return None
    except Exception as e:
        logger.warning("Failed to create Gemini model: %s", e)
        return None


def _create_groq() -> Optional[BaseChatModel]:
    """Create a Groq chat model via LangChain."""
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        return None
    try:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=settings.GROQ_TEMPERATURE,
            max_tokens=settings.GROQ_MAX_TOKENS,
            timeout=settings.GROQ_TIMEOUT,
        )
    except ImportError:
        logger.warning("langchain-groq not installed")
        return None
    except Exception as e:
        logger.warning("Failed to create Groq model: %s", e)
        return None


def _create_openai() -> Optional[BaseChatModel]:
    """Create an OpenAI chat model via LangChain."""
    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=settings.OPENAI_TEMPERATURE,
            max_tokens=settings.OPENAI_MAX_TOKENS,
            timeout=settings.OPENAI_TIMEOUT,
        )
    except ImportError:
        logger.warning("langchain-openai not installed")
        return None
    except Exception as e:
        logger.warning("Failed to create OpenAI model: %s", e)
        return None


# ── Provider cache ────────────────────────────────────────────────────────────
_providers: dict[LLMProvider, BaseChatModel | None] = {}
_initialized = False


def _init_providers() -> None:
    global _providers, _initialized
    if _initialized:
        return
    _providers = {
        LLMProvider.GEMINI: _create_gemini(),
        LLMProvider.GROQ: _create_groq(),
        LLMProvider.OPENAI: _create_openai(),
    }
    available = [p.value for p, m in _providers.items() if m is not None]
    logger.info("LLM providers available: %s", available or ["NONE"])
    _initialized = True


def _get_provider_order(task: LLMTaskType = LLMTaskType.SIMPLE) -> list[LLMProvider]:
    """
    Return provider priority order based on task type.
    Gemini is primary for all tasks; Groq is fast fallback.
    """
    if task in (LLMTaskType.COMPLEX, LLMTaskType.GENERATION, LLMTaskType.VERIFICATION):
        return [LLMProvider.GEMINI, LLMProvider.OPENAI, LLMProvider.GROQ]
    # Simple, classification, rewrite — prefer speed
    return [LLMProvider.GEMINI, LLMProvider.GROQ, LLMProvider.OPENAI]


def get_llm(
    task: LLMTaskType = LLMTaskType.SIMPLE,
    preferred_provider: Optional[LLMProvider] = None,
) -> BaseChatModel:
    """
    Return the best available LLM for the given task type.
    Raises RuntimeError if no provider is available.
    """
    _init_providers()

    order = _get_provider_order(task)
    if preferred_provider:
        order = [preferred_provider] + [p for p in order if p != preferred_provider]

    for provider in order:
        model = _providers.get(provider)
        if model is not None:
            return model

    raise RuntimeError(
        "No LLM provider is configured. Set at least GEMINI_API_KEY or GROQ_API_KEY."
    )


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    task: LLMTaskType = LLMTaskType.SIMPLE,
    max_retries: int = 2,
) -> dict[str, Any]:
    """
    Call the best available LLM with fallback and retry.
    Returns {"text": str, "provider": str}.
    """
    _init_providers()

    order = _get_provider_order(task)
    last_error = None

    for provider in order:
        model = _providers.get(provider)
        if model is None:
            continue

        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
                response = await model.ainvoke(messages)
                text = response.content.strip() if response.content else ""
                if text:
                    return {"text": text, "provider": provider.value}
                logger.warning(
                    "Empty response from %s (attempt %d)", provider.value, attempt + 1
                )
            except Exception as e:
                last_error = e
                wait = min(2 ** attempt, 4)
                logger.warning(
                    "%s attempt %d failed: %s — retrying in %ds",
                    provider.value, attempt + 1, str(e)[:200], wait,
                )
                if attempt < max_retries - 1:
                    time.sleep(wait)

        logger.warning("All retries exhausted for %s, trying next provider", provider.value)

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")


def init_llm_providers() -> None:
    """Explicitly initialize providers at startup."""
    _init_providers()


class LLMRouter:
    """Synchronous and task-routed LLM interface for LangGraph nodes."""

    def __init__(self):
        _init_providers()

    def generate(
        self,
        prompt: str,
        system_prompt: str = "You are a university academic tutor. Respond accurately and clearly.",
        task_type: LLMTaskType = LLMTaskType.SIMPLE,
        temperature: float = 0.2,
        max_tokens: int = 1500,
        max_retries: int = 2,
    ) -> LLMResponse:
        order = [p.value for p in _get_provider_order(task_type)]
        from app.providers.pool import get_provider_pool
        pool = get_provider_pool()
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt),
            ]
            content, provider = pool.execute_with_failover(
                messages=messages,
                provider_order=order,
                max_attempts=max(3, max_retries * 2),
            )
            return LLMResponse(content=content, provider=provider)
        except Exception as pool_err:
            logger.warning(f"Provider pool failover error: {pool_err}. Falling back to default provider list.")
            last_error = pool_err
            for provider_enum in _get_provider_order(task_type):
                model = _providers.get(provider_enum)
                if model is None:
                    continue
                try:
                    messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=prompt),
                    ]
                    response = model.invoke(messages)
                    content = response.content if hasattr(response, "content") else str(response)
                    return LLMResponse(content=str(content).strip(), provider=provider_enum.value)
                except Exception as invoke_err:
                    last_error = invoke_err
            raise RuntimeError(f"All LLM providers and keys failed: {last_error}")


_global_llm_router: Optional[LLMRouter] = None


def get_llm_router() -> LLMRouter:
    global _global_llm_router
    if _global_llm_router is None:
        _global_llm_router = LLMRouter()
    return _global_llm_router
