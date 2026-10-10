"""Agentic RAG as a LangGraph state machine.

START -> route --(smalltalk/offtopic)--> finalize
          |
          v academic
       rewrite  (light LLM: standalone question + sub-queries)
          |
       retrieve (hybrid dense+BM25+RRF, authorization-filtered)
          |
        grade   (light LLM: keep only passages that actually help)
          |
       decide --(nothing relevant & rounds left)--> refine --> retrieve
          |--(nothing relevant & no rounds left)--> no_answer --> finalize
          v
       generate (heavy LLM, strictly from numbered context, cites [n])
          |
        verify  (heavy LLM: is every claim supported by the context?)
          |--(ungrounded, 1st time)--> generate (stricter)   |--(ungrounded again)--> no_answer
          v
       finalize (citations, confidence, trace)

Fails closed: no relevant evidence => honest "not in the material" answer, never a guess.
"""
from __future__ import annotations

import json
import logging
import operator
import re
import time
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import get_settings
from app.providers import get_llm, llm_text
from app.retriever import HybridRetriever, build_where

log = logging.getLogger("rag.agent")

NO_ANSWER = (
    "I couldn't find this in the course material that has been uploaded for your subject, so I "
    "won't guess. I've flagged it so your faculty can add or clarify the material."
)
SMALLTALK = "Hi! I'm your course assistant. Ask me anything about the material your faculty has uploaded."
OFFTOPIC = "I can only help with questions about your course material. Try asking about a topic from your subject."


class LLMUnavailable(RuntimeError):
    pass


class AgentState(TypedDict, total=False):
    # input
    question: str
    history: List[Dict[str, str]]
    subject_codes: List[str]
    subject_ids: List[str]
    department_id: Optional[str]
    document_ids: Optional[List[str]]
    learner_level: str
    # working
    intent: str
    standalone: str
    sub_queries: List[str]
    candidates: Dict[str, Dict[str, Any]]  # chunk_id -> {doc, score}
    relevant: List[Dict[str, Any]]
    round: int
    gen_attempt: int
    answer: str
    support: float
    grounded: bool
    # output
    confidence: float
    sources: List[Dict[str, Any]]
    trace: Annotated[List[Dict[str, Any]], operator.add]
    retrieval: Dict[str, Any]
    final: str


# ---------------------------------------------------------------- helpers
def _json(text: str) -> Optional[dict]:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def _t(node: str, **kw: Any) -> List[Dict[str, Any]]:
    return [{"node": node, "t": round(time.time(), 3), **kw}]


def _fmt_history(h: List[Dict[str, str]]) -> str:
    return "\n".join(f"{m['role']}: {m['content'][:400]}" for m in (h or [])[-4:]) or "(none)"


def _light(prompt: str) -> str:
    return llm_text(get_llm("light").invoke(prompt))


# ---------------------------------------------------------------- nodes
def route_node(s: AgentState) -> dict:
    q = s["question"].strip()
    intent = "academic"
    try:
        out = _json(
            _light(
                "TASK:ROUTE\nClassify the student message. Reply ONLY JSON "
                '{"intent":"academic|smalltalk|offtopic"}. academic = any question about a subject, '
                "concept, assignment or course content (even short follow-ups like 'why?'). "
                "smalltalk = greeting/thanks. offtopic = unrelated to studying.\n"
                f"RECENT CHAT:\n{_fmt_history(s.get('history', []))}\nQUESTION: {q}"
            )
        )
        if out and out.get("intent") in {"academic", "smalltalk", "offtopic"}:
            intent = out["intent"]
    except Exception as e:  # degrade: treat as academic
        log.warning("route failed (%s) -> academic", e)
    return {"intent": intent, "round": 0, "gen_attempt": 0, "candidates": {}, "trace": _t("route", intent=intent)}


def rewrite_node(s: AgentState) -> dict:
    q = s["question"].strip()
    standalone, subs = q, [q]
    try:
        out = _json(
            _light(
                "TASK:REWRITE\n"
                "Given the chat history and the student's current question:\n"
                "- If the question is an obvious follow-up or uses pronouns referring to the conversation, rewrite it to be self-contained.\n"
                "- If the question asks about a new distinct topic or concept, DO NOT force or blend the prior conversation topic into it.\n"
                'Reply ONLY JSON {"standalone":"...","sub_queries":["..."]}.\n'
                f"CHAT:\n{_fmt_history(s.get('history', []))}\nQUESTION: {q}\n"
            )
        )
        if out and out.get("standalone"):
            standalone = str(out["standalone"]).strip() or q
            subs = [str(x).strip() for x in (out.get("sub_queries") or []) if str(x).strip()][:3] or [standalone]
    except Exception as e:
        log.warning("rewrite failed (%s) -> raw question", e)
    if standalone not in subs:
        subs = [standalone] + subs
    if q not in subs:
        subs.append(q)
    return {"standalone": standalone, "sub_queries": subs[:4], "trace": _t("rewrite", queries=subs[:4])}


def retrieve_node(s: AgentState) -> dict:
    cfg = get_settings()
    where = build_where(s.get("subject_codes"), s.get("department_id"), s.get("document_ids"), subject_ids=s.get("subject_ids"))
    retr = HybridRetriever(where=where, top_k=cfg.final_k + 3)
    cands = dict(s.get("candidates") or {})
    agg = {"dense_hits": 0, "sparse_hits": 0}
    for q in s["sub_queries"]:
        for doc, score in retr.search(q):
            cid = doc.metadata["chunk_id"]
            if cid not in cands or score > cands[cid]["score"]:
                cands[cid] = {"doc": doc, "score": score}
        agg["dense_hits"] += retr.last_trace.get("dense_hits", 0)
        agg["sparse_hits"] += retr.last_trace.get("sparse_hits", 0)
    ranked = sorted(cands.values(), key=lambda c: c["score"], reverse=True)[: cfg.final_k + 3]
    cands = {c["doc"].metadata["chunk_id"]: c for c in ranked}
    return {
        "candidates": cands,
        "retrieval": {"strategy": "hybrid_rrf", **agg, "candidates": len(cands)},
        "trace": _t("retrieve", round=s.get("round", 0), candidates=len(cands), **agg),
    }


def grade_node(s: AgentState) -> dict:
    cfg = get_settings()
    ranked = sorted(s["candidates"].values(), key=lambda c: c["score"], reverse=True)
    if not ranked:
        return {"relevant": [], "trace": _t("grade", kept=0)}
    block = "\n".join(f"[P{i+1}] {c['doc'].page_content[:1800]}" for i, c in enumerate(ranked))
    keep = None
    target_q = s.get("question", "").strip() or s["standalone"]
    try:
        out = _json(
            _light(
                "TASK:GRADE\nFor each passage decide if it contains information that helps answer the "
                "question. If a passage explains, defines, or discusses concepts in either question, mark it relevant.\n"
                'Reply ONLY JSON {"grades":[{"id":1,"relevant":true}, ...]}.\n'
                f"QUESTION: {s['standalone']}\nORIGINAL_QUESTION: {target_q}\nPASSAGES:\n{block}"
            )
        )
        if out and isinstance(out.get("grades"), list):
            ok = {int(g["id"]) for g in out["grades"] if g.get("relevant")}
            keep = [c for i, c in enumerate(ranked) if (i + 1) in ok]
    except Exception as e:
        log.warning("grade failed (%s) -> score threshold", e)
    if keep is None:  # grader unavailable: fall back to score threshold
        keep = [c for c in ranked if c["score"] >= cfg.min_relevance * 2]
    keep = keep[: cfg.final_k]
    return {"relevant": keep, "trace": _t("grade", kept=len(keep), of=len(ranked))}


def refine_node(s: AgentState) -> dict:
    """Round > 0: ask the light LLM for alternative search phrasings (never widens access scope)."""
    q = s.get("question", "").strip() or s["standalone"]
    alts: List[str] = [q]
    try:
        out = _json(
            _light(
                "TASK:REWRITE\nThe first search found nothing useful. Give 2 alternative search phrasings or synonyms for the question.\n"
                'Reply ONLY JSON {"standalone":"...","sub_queries":["..."]}.\n'
                f"QUESTION: {q}\n"
            )
        )
        if out:
            alts = [str(x) for x in (out.get("sub_queries") or []) if str(x).strip()]
    except Exception as e:
        log.warning("refine failed (%s)", e)
    # lexical fallback: keep only content words
    from app.providers import tokenize

    alts.append(" ".join(tokenize(q)) or q)
    seen, uniq = set(), []
    for a in alts:
        if a not in seen and a != q:
            seen.add(a)
            uniq.append(a)
    return {"sub_queries": uniq[:3] or [q], "round": s.get("round", 0) + 1, "trace": _t("refine", queries=uniq[:3])}


def _ctx_block(rel: List[Dict[str, Any]]) -> str:
    parts = []
    for i, c in enumerate(rel, 1):
        m = c["doc"].metadata
        parts.append(f"[{i}] ({m.get('file_name','doc')}, p.{m.get('page','?')})\n{c['doc'].page_content}")
    return "\n".join(parts)


_LEVEL = {
    "beginner": "Explain simply with an everyday analogy, define jargon.",
    "intermediate": "Explain clearly with the key steps.",
    "advanced": "Be concise and precise; include nuance.",
}


def generate_node(s: AgentState) -> dict:
    attempt = s.get("gen_attempt", 0)
    strict = (
        "\nYour previous draft contained unsupported statements. Use ONLY facts explicitly in the "
        "context; drop anything you cannot cite."
        if attempt > 0
        else ""
    )
    prompt = (
        "TASK:ANSWER\nYou are a university course tutor. Answer the student's question using ONLY the "
        "numbered context below. Cite sources inline like [1] or [2][3] after the sentences they support. "
        "Do not use outside knowledge. If the context does not contain the answer, reply exactly "
        f"INSUFFICIENT_CONTEXT. {_LEVEL.get(s.get('learner_level','intermediate'), '')}{strict}\n"
        f"CONTEXT:\n{_ctx_block(s['relevant'])}\n"
        f"QUESTION: {s['standalone']}\n"
    )
    try:
        ans = llm_text(get_llm("heavy").invoke(prompt)).strip()
    except Exception as e:
        raise LLMUnavailable(f"All LLM providers failed during generation: {str(e)[:300]}")
    return {"answer": ans, "gen_attempt": attempt + 1, "trace": _t("generate", attempt=attempt + 1, chars=len(ans))}


def verify_node(s: AgentState) -> dict:
    ans = s["answer"]
    if ans.strip().startswith("INSUFFICIENT_CONTEXT"):
        return {"support": 0.0, "grounded": False, "trace": _t("verify", verdict="insufficient")}
    support, verdict = 0.7, "unverified"
    try:
        out = _json(
            llm_text(
                get_llm("heavy").invoke(
                    "TASK:VERIFY\nCheck whether every factual claim in the ANSWER is supported by the CONTEXT. "
                    'Reply ONLY JSON {"supported_ratio":0.0-1.0,"verdict":"grounded|ungrounded"}.\n'
                    f"ANSWER: {ans}\nCONTEXT: {_ctx_block(s['relevant'])}"
                )
            )
        )
        if out and "supported_ratio" in out:
            support = max(0.0, min(1.0, float(out["supported_ratio"])))
            verdict = str(out.get("verdict", "grounded" if support >= 0.6 else "ungrounded"))
    except Exception as e:
        log.warning("verify failed (%s) -> neutral", e)
    return {"support": support, "grounded": support >= 0.6, "trace": _t("verify", support=support, verdict=verdict)}


def no_answer_node(s: AgentState) -> dict:
    return {"final": NO_ANSWER, "grounded": False, "confidence": 0.1, "sources": [], "trace": _t("no_answer")}


def finalize_node(s: AgentState) -> dict:
    intent = s.get("intent", "academic")
    if intent == "smalltalk":
        return {"final": SMALLTALK, "grounded": True, "confidence": 1.0, "sources": [], "trace": _t("finalize")}
    if intent == "offtopic":
        return {"final": OFFTOPIC, "grounded": True, "confidence": 1.0, "sources": [], "trace": _t("finalize")}
    if s.get("final"):  # no_answer path already filled it
        return {"trace": _t("finalize")}
    rel = s["relevant"]
    ans = s["answer"]
    cited = sorted({int(n) for grp in re.findall(r"\[(\d+(?:\s*,\s*\d+)*)\]", ans) for n in re.split(r"\s*,\s*", grp)})
    cited = [n for n in cited if 1 <= n <= len(rel)] or list(range(1, len(rel) + 1))
    sources = []
    for n in cited:
        m = rel[n - 1]["doc"].metadata
        sources.append(
            {
                "document_id": m.get("document_id"),
                "file_name": m.get("file_name"),
                "page": m.get("page"),
                "chunk_index": m.get("chunk_index"),
                "section": m.get("heading") or None,
                "snippet": rel[n - 1]["doc"].page_content[:240],
                "score": rel[n - 1]["score"],
                "ref": n,
            }
        )
    top = max((c["score"] for c in rel), default=0.0)
    frac = len(rel) / max(1, len(s.get("candidates", {})) or 1)
    conf = 0.40 * s.get("support", 0.0) + 0.35 * min(1.0, top / 0.7) + 0.25 * min(1.0, frac * 2)
    return {
        "final": ans,
        "confidence": round(max(0.0, min(1.0, conf)), 3),
        "sources": sources,
        "trace": _t("finalize", confidence=round(conf, 3), cited=cited),
    }


# ---------------------------------------------------------------- edges
def after_route(s: AgentState) -> str:
    return "rewrite" if s.get("intent") == "academic" else "finalize"


def after_grade(s: AgentState) -> str:
    if s.get("relevant"):
        return "generate"
    return "refine" if s.get("round", 0) < get_settings().max_rounds - 1 else "no_answer"


def after_generate(s: AgentState) -> str:
    return "no_answer" if s["answer"].strip().startswith("INSUFFICIENT_CONTEXT") else "verify"


def after_verify(s: AgentState) -> str:
    if s.get("grounded"):
        return "finalize"
    return "generate" if s.get("gen_attempt", 0) < 2 else "no_answer"


def build_graph():
    g = StateGraph(AgentState)
    for name, fn in [
        ("route", route_node), ("rewrite", rewrite_node), ("retrieve", retrieve_node), ("grade", grade_node),
        ("refine", refine_node), ("generate", generate_node), ("verify", verify_node),
        ("no_answer", no_answer_node), ("finalize", finalize_node),
    ]:
        g.add_node(name, fn)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", after_route, {"rewrite": "rewrite", "finalize": "finalize"})
    g.add_edge("rewrite", "retrieve")
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges("grade", after_grade, {"generate": "generate", "refine": "refine", "no_answer": "no_answer"})
    g.add_edge("refine", "retrieve")
    g.add_conditional_edges("generate", after_generate, {"verify": "verify", "no_answer": "no_answer"})
    g.add_conditional_edges("verify", after_verify, {"finalize": "finalize", "generate": "generate", "no_answer": "no_answer"})
    g.add_edge("no_answer", "finalize")
    g.add_edge("finalize", END)
    return g.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def ask(
    question: str,
    *,
    subject_codes: Optional[List[str]] = None,
    subject_ids: Optional[List[str]] = None,
    department_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    learner_level: str = "intermediate",
) -> Dict[str, Any]:
    t0 = time.time()
    st = get_graph().invoke(
        {
            "question": question,
            "history": history or [],
            "subject_codes": subject_codes or [],
            "subject_ids": subject_ids or [],
            "department_id": department_id,
            "document_ids": document_ids,
            "learner_level": learner_level,
            "trace": [],
        },
        config={"recursion_limit": 25},
    )
    return {
        "answer": st.get("final", NO_ANSWER),
        "confidence": st.get("confidence", 0.0),
        "grounded": bool(st.get("grounded", False)),
        "intent": st.get("intent", "academic"),
        "sources": st.get("sources", []),
        "retrieval": st.get("retrieval", {"strategy": "hybrid_rrf"}),
        "agent_trace": st.get("trace", []),
        "standalone_question": st.get("standalone"),
        "latency_ms": int((time.time() - t0) * 1000),
    }
