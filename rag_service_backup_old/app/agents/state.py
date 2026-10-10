"""
LangGraph Agent State Definition for University Agentic RAG Platform.
Defines all fields required for state transitions, trace recording, and response generation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # User / Auth / Security Context
    user_id: str
    role: str
    university_id: str
    department_id: str
    semester: Optional[int]
    course_ids: List[str]
    subject_ids: List[str]
    subject_id: Optional[str]
    subject_name: Optional[str]
    learner_level: Optional[str]  # beginner, intermediate, advanced

    # Request specifics
    conversation_id: Optional[str]
    query: str
    chat_history: List[Dict[str, str]]
    mode: str  # ask_tutor, explain, summarize, exam_prep, quiz_me, compare, solve, code_help, study_plan

    # Scope & Intent Routing
    scope_category: Optional[str]
    is_academic: Optional[bool]

    # Security & retrieval filters
    security_filters: Dict[str, Any]

    # Query understanding & planning
    intent: str
    complexity: str
    requires_retrieval: bool
    requires_tool: bool
    requires_decomposition: bool
    rewritten_query: str
    subqueries: List[str]
    retrieval_strategy: str

    # Retrieval results
    retrieved_documents: List[Dict[str, Any]]
    retrieval_telemetry: Dict[str, Any]
    evidence_score: float
    evidence_sufficient: bool

    # Tool invocation
    tool_name: Optional[str]
    tool_input: Optional[Dict[str, Any]]
    tool_result: Optional[str]

    # Answer generation & verification
    draft_answer: str
    grounding_result: Dict[str, Any]
    grounded: bool
    confidence: float
    citations: List[Dict[str, Any]]
    follow_up: List[str]

    # Operational trace & control flow
    agent_trace: List[str]
    errors: List[str]
    retrieval_retry_count: int
    generation_retry_count: int
