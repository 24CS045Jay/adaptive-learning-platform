"""
LangGraph Agent Workflow Definition.
Builds the state graph connecting all RAG lifecycle nodes with conditional edges and bounded retries.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.agents.nodes import (
    analyze_query_node,
    check_evidence_node,
    finalize_response_node,
    generate_answer_node,
    grounding_check_node,
    hybrid_retrieve_node,
    load_context_node,
    plan_retrieval_node,
    refine_query_node,
    rewrite_or_decompose_node,
    scope_gate_node,
    tool_execution_node,
    validate_access_node,
)
from app.agents.state import AgentState

logger = logging.getLogger("rag_service.agents.graph")


def check_scope_status(state: AgentState) -> str:
    """Routes non-academic (greetings, small-talk, off-topic, unclear) directly to finalization."""
    if not state.get("is_academic", True):
        return "out_of_scope"
    return "academic"


def should_retry_retrieval(state: AgentState) -> str:
    """Evaluates whether to loop back for query refinement or proceed to tool/generation or safe refusal."""
    if state.get("draft_answer") and "Access Denied" in state.get("draft_answer"):
        return "finalize"

    sufficient = state.get("evidence_sufficient", True)
    retries = state.get("retrieval_retry_count", 0)

    if not sufficient:
        if retries < 2:
            return "refine"
        else:
            return "finalize"  # Fail closed per Section 26

    return "proceed_to_tools_or_gen"


def check_tool_needed(state: AgentState) -> str:
    """Checks whether tool execution is required before generation."""
    if state.get("requires_tool") and state.get("tool_name"):
        return "execute_tool"
    return "generate"


def check_access_status(state: AgentState) -> str:
    """Routes to finalize immediately if access validation failed."""
    if state.get("draft_answer") and "Access Denied" in state.get("draft_answer"):
        return "denied"
    return "authorized"


class AgentGraphRunner:
    """
    Manages LangGraph compilation and execution.
    Provides robust execution with native LangGraph or sequential state machine fallback.
    """

    def __init__(self):
        self._compiled_graph = None
        self._init_graph()

    def _init_graph(self):
        try:
            from langgraph.graph import END, START, StateGraph

            workflow = StateGraph(AgentState)

            # Register all nodes
            workflow.add_node("scope_gate", scope_gate_node)
            workflow.add_node("load_context", load_context_node)
            workflow.add_node("analyze_query", analyze_query_node)
            workflow.add_node("validate_access", validate_access_node)
            workflow.add_node("plan_retrieval", plan_retrieval_node)
            workflow.add_node("rewrite_or_decompose", rewrite_or_decompose_node)
            workflow.add_node("hybrid_retrieve", hybrid_retrieve_node)
            workflow.add_node("check_evidence", check_evidence_node)
            workflow.add_node("refine_query", refine_query_node)
            workflow.add_node("tool_execution", tool_execution_node)
            workflow.add_node("generate_answer", generate_answer_node)
            workflow.add_node("grounding_check", grounding_check_node)
            workflow.add_node("finalize_response", finalize_response_node)

            # Start at Scope Gate
            workflow.add_edge(START, "scope_gate")
            workflow.add_conditional_edges(
                "scope_gate",
                check_scope_status,
                {
                    "academic": "load_context",
                    "out_of_scope": "finalize_response",
                },
            )

            workflow.add_edge("load_context", "analyze_query")
            workflow.add_edge("analyze_query", "validate_access")

            workflow.add_conditional_edges(
                "validate_access",
                check_access_status,
                {
                    "authorized": "plan_retrieval",
                    "denied": "finalize_response",
                },
            )

            workflow.add_edge("plan_retrieval", "rewrite_or_decompose")
            workflow.add_edge("rewrite_or_decompose", "hybrid_retrieve")
            workflow.add_edge("hybrid_retrieve", "check_evidence")

            # Retrieval retry loop with bounded fail-closed limit
            workflow.add_conditional_edges(
                "check_evidence",
                should_retry_retrieval,
                {
                    "refine": "refine_query",
                    "proceed_to_tools_or_gen": "tool_execution",
                    "finalize": "finalize_response",
                },
            )
            workflow.add_edge("refine_query", "hybrid_retrieve")

            # Tools & Generation
            workflow.add_edge("tool_execution", "generate_answer")
            workflow.add_edge("generate_answer", "grounding_check")
            workflow.add_edge("grounding_check", "finalize_response")
            workflow.add_edge("finalize_response", END)

            self._compiled_graph = workflow.compile()
            logger.info("LangGraph StateGraph compiled successfully with Scope Gate")
        except Exception as e:
            logger.warning(f"Could not compile LangGraph ({e}). Sequential state machine fallback will be used.")
            self._compiled_graph = None

    def run(self, initial_state: AgentState) -> AgentState:
        """Runs the agent graph on input state and returns the finalized output state."""
        if self._compiled_graph is not None:
            try:
                result = self._compiled_graph.invoke(initial_state)
                return result
            except Exception as e:
                logger.error(f"LangGraph execution error: {e}. Executing sequential pipeline fallback.", exc_info=True)

        # Robust Sequential State Machine Fallback
        state = dict(initial_state)

        # 1. Scope Gate
        state.update(scope_gate_node(state))
        if check_scope_status(state) == "out_of_scope":
            state.update(finalize_response_node(state))
            return state

        # 2. Context & Security Access
        state.update(load_context_node(state))
        state.update(analyze_query_node(state))
        state.update(validate_access_node(state))

        if check_access_status(state) == "denied":
            state.update(finalize_response_node(state))
            return state

        state.update(plan_retrieval_node(state))
        state.update(rewrite_or_decompose_node(state))

        # 3. Retrieval with Bounded Fail-Closed Retry Loop
        retries = 0
        while retries <= 2:
            state.update(hybrid_retrieve_node(state))
            state.update(check_evidence_node(state))
            if state.get("evidence_sufficient", True) or retries >= 1:
                break
            state.update(refine_query_node(state))
            retries += 1

        # If evidence remains insufficient after retries, fail closed
        if not state.get("evidence_sufficient", True):
            state.update(finalize_response_node(state))
            return state

        # 4. Tool execution if needed
        if state.get("requires_tool"):
            state.update(tool_execution_node(state))

        # 5. Generation, grounding verification, and finalization
        state.update(generate_answer_node(state))
        state.update(grounding_check_node(state))
        state.update(finalize_response_node(state))

        return state


_global_runner: Optional[AgentGraphRunner] = None


def get_agent_graph() -> AgentGraphRunner:
    global _global_runner
    if _global_runner is None:
        _global_runner = AgentGraphRunner()
    return _global_runner
