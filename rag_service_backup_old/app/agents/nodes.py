"""
LangGraph Nodes implementing the full University Agentic RAG Pipeline.
Every step is fully implemented and traced.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from app.agents.prompts import (
    EVIDENCE_EVAL_PROMPT,
    GROUNDING_VERIFICATION_PROMPT,
    MODE_PROMPTS,
    QUERY_ANALYSIS_PROMPT,
    QUERY_REWRITE_PROMPT,
)
from app.agents.state import AgentState
from app.core.security import build_security_filter
from app.evaluation.metrics import calculate_multi_signal_confidence, extract_citations_from_docs
from app.llm.router import TaskType, get_llm_router
from app.retrieval.hybrid import get_hybrid_retriever
from app.scope.policies import (
    ACCESS_DENIED_RESPONSE,
    GENERATION_UNAVAILABLE_RESPONSE,
    GREETING_RESPONSE,
    INSUFFICIENT_EVIDENCE_RESPONSE,
    OFF_TOPIC_RESPONSE,
    UNCLEAR_RESPONSE,
)
from app.scope.router import ScopeCategory, get_scope_router
from app.tools.registry import get_tool_registry

logger = logging.getLogger("rag_service.agents.nodes")


def _clean_json_str(raw: str) -> str:
    """Strips markdown code blocks and whitespace to parse json."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    return cleaned.strip()


def scope_gate_node(state: AgentState) -> Dict[str, Any]:
    """
    Scope Router Gate: Classifies query before any expensive retrieval.
    Routes GREETING, SMALL_TALK, OFF_TOPIC, UNCLEAR deterministically.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("scope_gate")

    router = get_scope_router()
    decision = router.classify(state.get("query", ""))

    if not decision["is_academic"]:
        cat = decision["category"]
        is_greeting_or_talk = cat in [ScopeCategory.GREETING, ScopeCategory.SMALL_TALK]
        return {
            "scope_category": cat.value,
            "is_academic": False,
            "draft_answer": decision["response"],
            "requires_retrieval": False,
            "evidence_sufficient": False,
            "evidence_score": 0.0,
            "grounded": is_greeting_or_talk,
            "confidence": 1.0 if is_greeting_or_talk else 0.0,
            "agent_trace": trace,
        }

    return {
        "scope_category": ScopeCategory.ACADEMIC.value,
        "is_academic": True,
        "requires_retrieval": True,
        "agent_trace": trace,
    }


def load_context_node(state: AgentState) -> Dict[str, Any]:
    """
    Validates input parameters and builds security filter before any retrieval can happen.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("load_context")

    security_filter = build_security_filter(
        role=state.get("role", "student"),
        user_id=state.get("user_id"),
        university_id=state.get("university_id"),
        department_id=state.get("department_id"),
        semester=state.get("semester"),
        course_ids=state.get("course_ids", []),
        subject_ids=state.get("subject_ids", []),
    )

    return {
        "security_filters": security_filter,
        "agent_trace": trace,
        "retrieval_retry_count": state.get("retrieval_retry_count", 0),
        "generation_retry_count": state.get("generation_retry_count", 0),
        "errors": state.get("errors", []),
    }


def analyze_query_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyzes student query to classify intent, complexity, tool requirements, and decomposition.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("query_analysis")

    llm = get_llm_router()
    history_text = "\n".join(
        [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in state.get("chat_history", [])[-4:]]
    ) or "None"

    prompt = QUERY_ANALYSIS_PROMPT.format(
        subject_name=state.get("subject_name") or "General Coursework",
        learner_level=state.get("learner_level") or "intermediate",
        chat_history=history_text,
        query=state.get("query", ""),
    )

    intent = "conceptual"
    complexity = "medium"
    requires_retrieval = True
    requires_tool = False
    tool_name = None
    tool_args = None
    requires_decomp = False

    try:
        response = llm.generate(
            prompt=prompt,
            task_type=TaskType.FAST,
            temperature=0.0,
            max_tokens=300,
        )
        parsed = json.loads(_clean_json_str(response.content))
        intent = parsed.get("intent", "conceptual")
        complexity = parsed.get("complexity", "medium")
        requires_retrieval = parsed.get("requires_retrieval", True)
        requires_tool = parsed.get("requires_tool", False)
        tool_name = parsed.get("tool_name")
        tool_args = parsed.get("tool_args")
        requires_decomp = parsed.get("requires_decomposition", False)
    except Exception as e:
        logger.warning(f"Error in query analysis LLM: {e}. Defaulting to conceptual retrieval.")

    # Check query for explicit calculation or code keywords
    q_lower = state.get("query", "").lower()
    if any(k in q_lower for k in ["calculate", "compute", "evaluate", "+", "*", "/"]) and not tool_name:
        requires_tool = True
        tool_name = "calculator"

    return {
        "intent": intent,
        "complexity": complexity,
        "requires_retrieval": requires_retrieval,
        "requires_tool": requires_tool,
        "tool_name": tool_name if tool_name != "null" else None,
        "tool_input": tool_args,
        "requires_decomposition": requires_decomp,
        "agent_trace": trace,
    }


def validate_access_node(state: AgentState) -> Dict[str, Any]:
    """
    Rule 4 & 5: Validates authorization context. Halts retrieval if subject access is unauthorized.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("access_validation")

    role = state.get("role", "student")
    subject_id = state.get("subject_id")
    authorized_subjects = state.get("subject_ids", [])

    # If subject_id provided, ensure student has enrollment/access
    if role == "student" and subject_id and authorized_subjects and subject_id not in authorized_subjects:
        logger.warning(f"Access violation: Student {state.get('user_id')} attempted query on unauthorized subject {subject_id}")
        return {
            "draft_answer": "Access Denied: You do not have active enrollment permissions for this subject.",
            "grounded": False,
            "confidence": 0.0,
            "agent_trace": trace,
            "errors": ["Unauthorized subject access"],
            "requires_retrieval": False,
        }

    return {"agent_trace": trace}


def plan_retrieval_node(state: AgentState) -> Dict[str, Any]:
    """
    Sets retrieval strategy based on intent and complexity.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("retrieval_planning")
    return {
        "retrieval_strategy": "hybrid",
        "agent_trace": trace,
    }


def rewrite_or_decompose_node(state: AgentState) -> Dict[str, Any]:
    """
    Rewrites conversational queries into focused academic search strings, and creates subqueries if decomposed.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("query_rewrite")

    query = state.get("query", "")
    history = state.get("chat_history", [])

    # If no history and not decomposed, original query is usually fine
    if not history and not state.get("requires_decomposition"):
        return {
            "rewritten_query": query,
            "subqueries": [],
            "agent_trace": trace,
        }

    llm = get_llm_router()
    history_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-3:]]) or "None"

    prompt = QUERY_REWRITE_PROMPT.format(
        subject_name=state.get("subject_name") or "General",
        chat_history=history_text,
        query=query,
        requires_decomposition=state.get("requires_decomposition", False),
    )

    rewritten = query
    subqueries = []

    try:
        response = llm.generate(
            prompt=prompt,
            task_type=TaskType.FAST,
            temperature=0.0,
            max_tokens=250,
        )
        parsed = json.loads(_clean_json_str(response.content))
        rewritten = parsed.get("rewritten_query", query)
        subqueries = parsed.get("subqueries", [])
    except Exception as e:
        logger.warning(f"Error in query rewriter: {e}")

    return {
        "rewritten_query": rewritten,
        "subqueries": subqueries,
        "agent_trace": trace,
    }


def hybrid_retrieve_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes hybrid retrieval (Dense BGE-M3 + BM25 + RRF + Reranker) with security filtering.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("hybrid_retrieval")

    if not state.get("requires_retrieval", True):
        return {
            "retrieved_documents": [],
            "retrieval_telemetry": {"strategy": "none"},
            "agent_trace": trace,
        }

    retriever = get_hybrid_retriever()
    queries_to_search = [state.get("rewritten_query") or state.get("query")]
    if state.get("subqueries"):
        queries_to_search.extend(state.get("subqueries", [])[:2])

    all_docs = []
    seen_ids = set()
    latest_telemetry = {}

    for q in queries_to_search:
        res = retriever.retrieve(
            query=q,
            where_filter=state.get("security_filters"),
            top_k=5,
        )
        latest_telemetry = res.get("telemetry", {})
        for doc in res.get("documents", []):
            if doc["id"] not in seen_ids:
                seen_ids.add(doc["id"])
                all_docs.append(doc)

    # Sort combined pool by rerank score
    all_docs.sort(key=lambda d: d.get("rerank_score", d.get("score", 0.0)), reverse=True)
    top_docs = all_docs[:7]

    return {
        "retrieved_documents": top_docs,
        "retrieval_telemetry": latest_telemetry,
        "agent_trace": trace,
    }


def check_evidence_node(state: AgentState) -> Dict[str, Any]:
    """
    Evaluates evidence sufficiency. Decides whether to retry retrieval or proceed.
    Fails closed: if no documents or evidence score below threshold, sets evidence_sufficient = False.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("evidence_validation")

    docs = state.get("retrieved_documents", [])
    if not docs:
        retries = state.get("retrieval_retry_count", 0)
        return {
            "evidence_score": 0.0,
            "evidence_sufficient": False,
            "draft_answer": INSUFFICIENT_EVIDENCE_RESPONSE if retries >= 1 else state.get("draft_answer", ""),
            "agent_trace": trace,
        }

    # Aggregate text for evaluation
    chunks_text = "\n\n".join(
        [f"[Doc {i+1}]: {d.get('text', '')[:400]}" for i, d in enumerate(docs[:4])]
    )

    llm = get_llm_router()
    prompt = EVIDENCE_EVAL_PROMPT.format(
        query=state.get("rewritten_query") or state.get("query"),
        chunks_text=chunks_text,
    )

    sufficient = True
    score = 0.8

    try:
        response = llm.generate(
            prompt=prompt,
            task_type=TaskType.FAST,
            temperature=0.0,
            max_tokens=200,
        )
        parsed = json.loads(_clean_json_str(response.content))
        sufficient = bool(parsed.get("sufficient", False))
        score = float(parsed.get("evidence_score", 0.0))
    except Exception as e:
        logger.warning(f"Evidence eval parsing error: {e}. Evaluating deterministic retrieval thresholds.")
        # Deterministic fallback per Section 29:
        top_score = max([float(d.get("rerank_score", d.get("score", 0.0))) for d in docs], default=0.0)
        score = top_score
        sufficient = (score >= 0.45)

    # Calibration threshold check
    if score < 0.4:
        sufficient = False

    retries = state.get("retrieval_retry_count", 0)
    draft_answer = state.get("draft_answer", "")
    if not sufficient and retries >= 1:
        draft_answer = INSUFFICIENT_EVIDENCE_RESPONSE

    return {
        "evidence_sufficient": sufficient,
        "evidence_score": score,
        "draft_answer": draft_answer,
        "agent_trace": trace,
    }


def refine_query_node(state: AgentState) -> Dict[str, Any]:
    """
    Broadens or reformulates the query when initial evidence is insufficient.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("refine_query")

    retry_count = state.get("retrieval_retry_count", 0) + 1
    current_q = state.get("rewritten_query") or state.get("query")
    refined_q = f"{current_q} overview concepts definition"

    return {
        "rewritten_query": refined_q,
        "retrieval_retry_count": retry_count,
        "agent_trace": trace,
    }


def tool_execution_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes specified educational tools (calculator, python executor) in sandbox.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("tool_execution")

    tool_name = state.get("tool_name")
    tool_input = state.get("tool_input") or {}
    tool_registry = get_tool_registry()

    result_str = None
    if tool_name == "calculator":
        expr = tool_input.get("expression") or state.get("query")
        # Extract formula/math expression if inside query
        math_matches = re.findall(r"[\d\.\+\-\*\/\(\)\^\s]+", expr)
        if math_matches:
            longest_match = max(math_matches, key=len).strip()
            if len(longest_match) > 1:
                expr = longest_match
        result_str = tool_registry.execute("calculator", expression=expr)
    elif tool_name == "python_executor":
        code = tool_input.get("code") or ""
        if code:
            exec_res = tool_registry.execute("python_executor", code=code)
            result_str = f"Output:\n{exec_res.get('output', '')}"
            if exec_res.get("error"):
                result_str += f"\nError: {exec_res['error']}"

    return {
        "tool_result": result_str,
        "agent_trace": trace,
    }


def generate_answer_node(state: AgentState) -> Dict[str, Any]:
    """
    Generates grounded academic response according to selected educational mode.
    Fails closed: If already answered (scope/access), or if evidence is insufficient, skips generation.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("generation")

    # If draft_answer is already set (by scope router, access check, or evidence check)
    if state.get("draft_answer"):
        return {"agent_trace": trace}

    # Strict Fail-Closed Check: Academic queries MUST have evidence
    retrieved_docs = state.get("retrieved_documents", [])
    if not retrieved_docs or not state.get("evidence_sufficient", True):
        return {
            "draft_answer": INSUFFICIENT_EVIDENCE_RESPONSE,
            "grounded": False,
            "confidence": 0.0,
            "agent_trace": trace,
        }

    mode = state.get("mode", "ask_tutor")
    system_instruction = MODE_PROMPTS.get(mode, MODE_PROMPTS["ask_tutor"])

    # Adapt to learner level (Section 24)
    learner_level = state.get("learner_level", "intermediate")
    level_instruction = ""
    if learner_level == "beginner":
        level_instruction = "Adapt explanation for a beginner: use clear analogies, simpler phrasing, and gradual progression."
    elif learner_level == "advanced":
        level_instruction = "Adapt explanation for an advanced student: incorporate technical rigor, algorithmic trade-offs, and edge conditions."

    # Build context from retrieved chunks
    context_blocks = []
    for i, d in enumerate(retrieved_docs):
        m = d.get("metadata", {})
        header = f"[Source {i+1}]: {m.get('file_name', 'Course Doc')} | Page {m.get('page', 'N/A')} | Section: {m.get('section', 'General')}"
        context_blocks.append(f"{header}\n{d.get('text', '')}")
    context_text = "\n\n".join(context_blocks)

    tool_info = f"\n\nTool Execution Result:\n{state.get('tool_result')}" if state.get("tool_result") else ""

    generation_prompt = f"""{system_instruction}
{level_instruction}

IMPORTANT GROUNDING RULES:
1. Answer the question using ONLY the facts and concepts from the Approved Course Material below.
2. If the course material does not contain the answer, explicitly state that the course material does not cover this information. Do not invent facts or extrapolate beyond authorized content.
3. Cite sources naturally when making key assertions (e.g., [Source 1, Page X]).

Approved Course Material:
{context_text}
{tool_info}

Student Question:
{state.get('query')}

Educational Tutor Response:"""

    llm = get_llm_router()
    response = llm.generate(
        prompt=generation_prompt,
        task_type=TaskType.SYNTHESIS,
        temperature=0.2,
        max_tokens=1500,
    )

    return {
        "draft_answer": response.content,
        "agent_trace": trace,
    }


def grounding_check_node(state: AgentState) -> Dict[str, Any]:
    """
    Grounding Verification: Verifies that generated assertions are supported by source chunks.
    Fixes Critical Issue #10: An academic question with no retrieved documents fails closed.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("grounding_check")

    # Non-academic queries (greetings, scope refusal) do not need retrieval grounding
    if not state.get("is_academic", True):
        is_greeting = state.get("scope_category") in [ScopeCategory.GREETING.value, ScopeCategory.SMALL_TALK.value]
        return {
            "grounded": is_greeting,
            "grounding_result": {"grounded": is_greeting, "score": 1.0 if is_greeting else 0.0},
            "agent_trace": trace,
        }

    answer = state.get("draft_answer", "")
    docs = state.get("retrieved_documents", [])

    # Critical Issue #10: No retrieved documents for academic query is NOT grounded!
    if not docs:
        return {
            "grounded": False,
            "confidence": 0.0,
            "grounding_result": {"grounded": False, "score": 0.0},
            "agent_trace": trace,
        }

    # If the draft answer is already an insufficient evidence refusal, it is grounded as safe refusal
    if answer == INSUFFICIENT_EVIDENCE_RESPONSE or "couldn't find enough information" in answer.lower():
        return {
            "grounded": True,
            "grounding_result": {"grounded": True, "score": 1.0},
            "agent_trace": trace,
        }

    context_summary = "\n\n".join([f"- {d.get('text', '')[:300]}" for d in docs[:4]])
    prompt = GROUNDING_VERIFICATION_PROMPT.format(
        context_text=context_summary,
        generated_answer=answer[:1200],
    )

    llm = get_llm_router()
    is_grounded = False
    grounding_score = 0.0

    try:
        res = llm.generate(
            prompt=prompt,
            task_type=TaskType.FAST,
            temperature=0.0,
            max_tokens=200,
        )
        parsed = json.loads(_clean_json_str(res.content))
        is_grounded = bool(parsed.get("grounded", False))
        grounding_score = float(parsed.get("grounding_score", 0.0))
    except Exception as e:
        logger.warning(f"Grounding verification parsing error: {e}. Applying fail-closed deterministic check.")
        # Deterministic fallback per Section 30: Check if key concepts from answer appear in context
        if docs and answer:
            answer_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", answer.lower()))
            context_text = " ".join([d.get("text", "") for d in docs[:4]]).lower()
            overlap = sum(1 for w in answer_words if w in context_text) / max(len(answer_words), 1)
            if overlap >= 0.35:
                is_grounded = True
                grounding_score = round(overlap, 2)
            else:
                is_grounded = False
                grounding_score = round(overlap, 2)
        else:
            is_grounded = False
            grounding_score = 0.0

    # If verification failed, fail closed with safe refusal
    updates: Dict[str, Any] = {
        "grounded": is_grounded,
        "grounding_result": {
            "grounded": is_grounded,
            "score": grounding_score,
        },
        "agent_trace": trace,
    }

    if not is_grounded or grounding_score < 0.45:
        updates["draft_answer"] = INSUFFICIENT_EVIDENCE_RESPONSE
        updates["grounded"] = False

    return updates


def finalize_response_node(state: AgentState) -> Dict[str, Any]:
    """
    Produces final citations, multi-signal confidence score, follow-up suggestions, and closes trace.
    """
    trace = list(state.get("agent_trace", []))
    trace.append("final_response")

    # Non-academic or scope refusal handling
    if not state.get("is_academic", True):
        cat = state.get("scope_category")
        is_greeting = cat in [ScopeCategory.GREETING.value, ScopeCategory.SMALL_TALK.value]
        return {
            "confidence": 1.0 if is_greeting else 0.0,
            "citations": [],
            "follow_up": [
                "Explain deadlock prevention in Operating Systems",
                "What is CPU scheduling?",
                "How does virtual memory work?",
            ] if is_greeting else [
                "Ask a question from your course syllabus",
                "Review approved study notes",
            ],
            "agent_trace": trace,
        }

    docs = state.get("retrieved_documents", [])
    ev_score = state.get("evidence_score", 0.0)
    gr_score = state.get("grounding_result", {}).get("score", 0.0)
    has_tool = bool(state.get("tool_result"))

    # Fail closed on insufficient evidence or ungrounded
    if not state.get("evidence_sufficient", True) or not state.get("grounded", True) or not docs:
        return {
            "confidence": 0.0,
            "citations": [],
            "follow_up": [
                "Check that relevant lecture slides are uploaded",
                "Ask a more specific question from course topics",
            ],
            "agent_trace": trace,
        }

    # Multi-signal confidence calculation
    confidence = calculate_multi_signal_confidence(
        retrieved_docs=docs,
        evidence_score=ev_score,
        grounding_score=gr_score,
        has_tool_result=has_tool,
    )

    # Standardized citations
    citations = extract_citations_from_docs(docs)

    # Educational follow-up prompts
    follow_ups = [
        "Give me a real-world example of this concept",
        "Generate a 3-question quiz on this topic",
        "Explain this for exam preparation",
    ]

    return {
        "confidence": confidence,
        "citations": citations,
        "follow_up": follow_ups,
        "agent_trace": trace,
    }
