"""Embedding + LLM providers.

* Embeddings: gemini | openai | local (sentence-transformers) | hash (offline tests)
* LLMs: two tiers. 'heavy' = answer generation + grounding verification,
  'light' = routing, query rewriting, relevance grading (cheap + fast).
  Providers are tried in LLM_PROVIDER_ORDER with automatic fallback on errors.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Any, List, Optional

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.config import get_settings

log = logging.getLogger("rag.providers")

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = set(
    "a an the of in on at to for and or is are was were be been being what which who whom how why when "
    "where does do did can could should would will this that these those it its as by with from about "
    "explain tell me please give define describe".split()
)


def _stem(t: str) -> str:
    """Very light suffix stripper so 'resolved/resolves/resolving' ~ 'resolv', 'deadlocks' ~ 'deadlock'."""
    if len(t) <= 3 or t.isdigit():
        return t
    for suf, rep in (("ies", "y"), ("sses", "ss"), ("ing", ""), ("ed", ""), ("es", ""), ("s", "")):
        if t.endswith(suf) and len(t) - len(suf) >= 3 and not (suf == "s" and t.endswith("ss")):
            t = t[: -len(suf)] + rep
            break
    if t.endswith("e") and len(t) > 4:
        t = t[:-1]
    return t


def tokenize(text: str) -> List[str]:
    return [_stem(t) for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 1]


# ----------------------------------------------------------------------------
# Embeddings
# ----------------------------------------------------------------------------
class HashEmbeddings(Embeddings):
    """Deterministic bag-of-words hashing embeddings (offline tests only).

    Not semantic, but similar vocabulary => high cosine similarity, which is
    enough to verify that the whole pipeline (chunk -> embed -> store -> retrieve)
    is wired correctly without network access.
    """

    def __init__(self, dim: int = 512):
        self.dim = dim

    def _vec(self, text: str) -> List[float]:
        v = [0.0] * self.dim
        toks = tokenize(text)
        feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
        for f in feats:
            h = int(hashlib.md5(f.encode()).hexdigest(), 16)
            v[h % self.dim] += 1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._vec(text)


def embedding_id() -> str:
    """Short id of the active embedding model. Used in the Chroma collection name so a
    provider/dimension change can NEVER mix incompatible vectors in one collection."""
    s = get_settings()
    if s.offline:
        return "hash512"
    if s.embedding_provider == "gemini":
        return f"gemini{s.gemini_embedding_dim}"
    if s.embedding_provider == "openai":
        return "oai-" + re.sub(r"[^a-z0-9]", "", s.openai_embedding_model.lower())[-14:]
    return "local-" + re.sub(r"[^a-z0-9]", "", s.local_embedding_model.lower())[-14:]


_emb_cache: Optional[Embeddings] = None


def get_embeddings(force_reload: bool = False) -> Embeddings:
    global _emb_cache
    if _emb_cache is not None and not force_reload:
        return _emb_cache
    s = get_settings()
    if s.offline:
        _emb_cache = HashEmbeddings(512)
        return _emb_cache
    p = s.embedding_provider
    if p == "gemini":
        if not s.gemini_key:
            raise RuntimeError("EMBEDDING_PROVIDER=gemini but GEMINI_API_KEY is empty")
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        _emb_cache = GoogleGenerativeAIEmbeddings(
            model=f"models/{s.gemini_embedding_model.replace('models/', '')}",
            google_api_key=s.gemini_key,
            output_dimensionality=s.gemini_embedding_dim,
        )
    elif p == "openai":
        if not s.openai_key:
            raise RuntimeError("EMBEDDING_PROVIDER=openai but OPENAI_API_KEY is empty")
        from langchain_openai import OpenAIEmbeddings

        _emb_cache = OpenAIEmbeddings(model=s.openai_embedding_model, api_key=s.openai_key)
    elif p == "local":
        from langchain_community.embeddings import HuggingFaceEmbeddings

        _emb_cache = HuggingFaceEmbeddings(
            model_name=s.local_embedding_model, encode_kwargs={"normalize_embeddings": True}
        )
    else:
        raise RuntimeError(f"Unknown EMBEDDING_PROVIDER '{p}' (use gemini | openai | local)")
    return _emb_cache


# ----------------------------------------------------------------------------
# LLMs
# ----------------------------------------------------------------------------
class MockChatModel(BaseChatModel):
    """Rule-based offline LLM. It reads the prompt and answers extractively, so tests can
    exercise routing, grading, generation, citation and verification code paths
    deterministically. NOT used when RAG_OFFLINE=0."""

    @property
    def _llm_type(self) -> str:
        return "mock-offline"

    def _generate(self, messages: List[BaseMessage], stop=None, run_manager=None, **kw: Any) -> ChatResult:
        text = "\n".join(str(m.content) for m in messages)
        out = _mock_reply(text)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=out))])


def _mock_reply(prompt: str) -> str:
    import json

    if "TASK:ROUTE" in prompt:
        q = prompt.split("QUESTION:", 1)[-1].strip().lower()
        if re.fullmatch(r"(hi|hello|hey|thanks|thank you|good (morning|evening|afternoon))[\s!.?]*", q):
            return json.dumps({"intent": "smalltalk"})
        if any(w in q for w in ["weather", "football score", "bitcoin price", "movie"]):
            return json.dumps({"intent": "offtopic"})
        return json.dumps({"intent": "academic"})
    if "TASK:REWRITE" in prompt:
        q = prompt.split("QUESTION:", 1)[-1].split("\n")[0].strip()
        return json.dumps({"standalone": q, "sub_queries": [q]})
    if "TASK:GRADE" in prompt:
        q = prompt.split("QUESTION:", 1)[-1].split("PASSAGES:")[0]
        qt = set(tokenize(q))
        grades = []
        for m in re.finditer(r"\[P(\d+)\](.*?)(?=\n\[P\d+\]|\Z)", prompt.split("PASSAGES:", 1)[-1], re.S):
            pt = set(tokenize(m.group(2)))
            ov = len(qt & pt) / (len(qt) or 1)
            grades.append({"id": int(m.group(1)), "relevant": ov >= 0.34})
        return json.dumps({"grades": grades})
    if "TASK:ANSWER" in prompt:
        q = prompt.split("QUESTION:", 1)[-1].split("\n")[0]
        qt = set(tokenize(q))
        ctx = prompt.split("CONTEXT:", 1)[-1].split("QUESTION:")[0]
        best, best_sc, best_id = "", 0.0, 1
        for m in re.finditer(r"\[(\d+)\](.*?)(?=\n\[\d+\]|\Z)", ctx, re.S):
            body = re.sub(r"^\s*\([^)\n]*\)\s*\n", "", m.group(2))  # drop "(file, p.N)" header line
            for sent in re.split(r"(?<=[.!?])\s+", body.strip()):
                st = set(tokenize(sent))
                sc = len(qt & st) / (len(qt) or 1)
                if sc > best_sc:
                    best, best_sc, best_id = sent.strip(), sc, int(m.group(1))
        if not best:
            return "INSUFFICIENT_CONTEXT"
        return f"{best} [{best_id}]"
    if "TASK:VERIFY" in prompt:
        ans = prompt.split("ANSWER:", 1)[-1].split("CONTEXT:")[0]
        ctx = prompt.split("CONTEXT:", 1)[-1].lower()
        at = set(tokenize(re.sub(r"\[\d+\]", "", ans)))
        ct = set(tokenize(ctx))
        sup = len(at & ct) / (len(at) or 1)
        return json.dumps({"supported_ratio": round(sup, 2), "verdict": "grounded" if sup >= 0.6 else "ungrounded"})
    return "OK"


def _build(provider: str, tier: str):
    s = get_settings()
    heavy = tier == "heavy"
    if provider == "gemini" and s.gemini_key:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=s.gemini_heavy if heavy else s.gemini_light,
            google_api_key=s.gemini_key,
            temperature=0.2 if heavy else 0.0,
            max_output_tokens=2048 if heavy else 512,
            timeout=40,
            max_retries=1,
        )
    if provider == "groq" and s.groq_key:
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=s.groq_heavy if heavy else s.groq_light,
            api_key=s.groq_key,
            temperature=0.2 if heavy else 0.0,
            max_tokens=2048 if heavy else 512,
            timeout=40,
            max_retries=1,
        )
    if provider == "openai" and s.openai_key:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=s.openai_heavy if heavy else s.openai_light,
            api_key=s.openai_key,
            temperature=0.2 if heavy else 0.0,
            max_tokens=2048 if heavy else 512,
            timeout=40,
            max_retries=1,
        )
    return None


_llm_cache: dict[str, Any] = {}


def get_llm(tier: str = "heavy", force_reload: bool = False):
    """Return a chat model with automatic provider fallback (LangChain `with_fallbacks`)."""
    if tier not in {"heavy", "light"}:
        raise ValueError("tier must be 'heavy' or 'light'")
    if tier in _llm_cache and not force_reload:
        return _llm_cache[tier]
    s = get_settings()
    if s.offline:
        _llm_cache[tier] = MockChatModel()
        return _llm_cache[tier]
    models = [m for m in (_build(p, tier) for p in s.provider_order) if m is not None]
    if not models:
        raise RuntimeError(
            "No LLM available. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY in .env"
        )
    primary, *rest = models
    _llm_cache[tier] = primary.with_fallbacks(rest) if rest else primary
    return _llm_cache[tier]


def reset_provider_cache() -> None:
    global _emb_cache
    _emb_cache = None
    _llm_cache.clear()


def llm_text(msg: Any) -> str:
    """Normalise model output (some providers return list-of-parts content)."""
    c = getattr(msg, "content", msg)
    if isinstance(c, list):
        return "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in c)
    return str(c)
