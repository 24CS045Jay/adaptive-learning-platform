"""
Pydantic schemas for the University Agentic RAG Service API.
Implements the exact response contract defined in Section 32 of the Master Specification.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# Security Context Input
class SecurityContext(BaseModel):
    user_id: str
    role: str = "student"
    university_id: Optional[str] = None
    department_id: Optional[str] = None
    semester: Optional[int] = None
    course_ids: List[str] = Field(default_factory=list)
    subject_ids: List[str] = Field(default_factory=list)


# Chat Message
class ChatMessage(BaseModel):
    role: str
    content: str


# Query Request Schema
class QueryRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    mode: str = "ask_tutor"  # ask_tutor, explain, summarize, exam_prep, quiz_me, compare, solve, code_help, study_plan
    learner_level: Optional[str] = "intermediate"  # beginner, intermediate, advanced
    chat_history: List[ChatMessage] = Field(default_factory=list)
    security_context: SecurityContext


# Citation / Source Model
class SourceItem(BaseModel):
    document_id: str
    file_name: str
    page: Optional[int] = None
    section: Optional[str] = None
    score: float


# Retrieval Telemetry Model
class RetrievalTelemetry(BaseModel):
    strategy: str = "hybrid"
    dense_candidates: int = 0
    sparse_candidates: int = 0
    reranked: int = 0


# Subject Info Model
class SubjectInfo(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


# Standard Response Contract (Section 32)
class QueryResponse(BaseModel):
    conversation_id: Optional[str] = None
    answer: str
    confidence: float
    grounded: bool
    mode: str
    intent: str
    subject: SubjectInfo
    sources: List[SourceItem] = Field(default_factory=list)
    retrieval: RetrievalTelemetry
    agent_trace: List[str] = Field(default_factory=list)
    tool_used: Optional[str] = None
    follow_up: List[str] = Field(default_factory=list)


# Ingestion Schemas
class IngestTextRequest(BaseModel):
    document_id: str
    version_id: Optional[str] = None
    title: str = "Untitled Document"
    text_content: Optional[str] = None
    content: Optional[str] = None
    text: Optional[str] = None
    university_id: Optional[str] = None
    department_id: Optional[str] = None
    course_id: Optional[str] = None
    subject_id: Optional[str] = None
    semester: Optional[int] = None
    is_faculty_only: bool = False
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def get_text(self) -> str:
        return self.text_content or self.content or self.text or ""


class IngestionResponse(BaseModel):
    document_id: str
    version_id: Optional[str] = None
    chunks_indexed: int
    status: str
    message: str
