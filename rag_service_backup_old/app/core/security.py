"""
Internal service security — validates requests from the Express backend.
"""

from __future__ import annotations

import hmac
from typing import Optional

from fastapi import Header, HTTPException, Request

from app.core.config import get_settings


def verify_service_token(
    x_service_token: Optional[str] = Header(None, alias="X-Service-Token"),
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> bool:
    """
    FastAPI dependency that verifies the internal service token.
    Accepts X-Service-Token, X-Internal-Token, or Bearer token.
    If INTERNAL_SERVICE_TOKEN is not configured, allows requests in dev mode.
    """
    settings = get_settings()
    expected = settings.INTERNAL_SERVICE_TOKEN

    if not expected:
        return True

    token = x_service_token or x_internal_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    if not token:
        # Development fallback token check
        if expected in ("univ-rag-internal-dev-token", ""):
            return True
        raise HTTPException(
            status_code=401,
            detail="Missing internal service token (X-Internal-Token header).",
        )

    if not hmac.compare_digest(token, expected):
        raise HTTPException(
            status_code=403,
            detail="Invalid internal service token.",
        )

    return True


verify_internal_auth = verify_service_token


def build_security_filter(
    role: str = "student",
    user_id: Optional[str] = None,
    university_id: Optional[str] = None,
    department_id: Optional[str] = None,
    semester: Optional[int] = None,
    course_ids: Optional[list] = None,
    subject_ids: Optional[list] = None,
    **kwargs,
) -> dict:
    """
    Flexible alias for constructing retrieval security filters.
    """
    course_id = course_ids[0] if course_ids and len(course_ids) == 1 else None
    subject_id = subject_ids[0] if subject_ids and len(subject_ids) == 1 else None

    filters: dict = {}

    if university_id:
        filters["university_id"] = university_id
    if department_id:
        filters["department_id"] = department_id
    if semester is not None:
        filters["semester"] = semester
    if course_id:
        filters["course_id"] = course_id
    if subject_id:
        filters["subject_id"] = subject_id
    elif subject_ids and len(subject_ids) > 1:
        filters["subject_id"] = {"$in": subject_ids}

    return filters


def build_security_filters(
    *,
    university_id: str | None = None,
    department_id: str | None = None,
    semester: int | None = None,
    course_id: str | None = None,
    subject_id: str | None = None,
    subject_ids: list[str] | None = None,
) -> dict:
    """
    Construct Chroma metadata filters that enforce access control
    **before** retrieval.  Only chunks matching ALL supplied filters
    will be returned.
    """
    filters: dict = {
        "is_active": "true",
        "visibility": "enrolled_students",
    }

    if university_id:
        filters["university_id"] = university_id
    if department_id:
        filters["department_id"] = department_id
    if semester is not None:
        filters["semester"] = str(semester)
    if course_id:
        filters["course_id"] = course_id
    if subject_id:
        filters["subject_id"] = subject_id

    # When the student is enrolled in multiple subjects, we build a
    # $in filter.  Chroma where-clause uses {"subject_id": {"$in": [...]}}
    if subject_ids and len(subject_ids) > 1:
        filters.pop("subject_id", None)
        # This will be converted to Chroma $in syntax by the retriever
        filters["subject_id__in"] = subject_ids

    return filters


def chroma_where_from_filters(filters: dict) -> dict:
    """
    Convert our flat filter dict to a Chroma-compatible `where` clause.
    Handles the `$in` pseudo-key for multi-value matching.
    """
    clauses = []
    for key, value in filters.items():
        if key.endswith("__in"):
            real_key = key.replace("__in", "")
            clauses.append({real_key: {"$in": value}})
        else:
            clauses.append({key: value})

    if len(clauses) == 0:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}
