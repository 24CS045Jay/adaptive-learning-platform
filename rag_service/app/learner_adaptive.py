"""Learner-Aware Adaptive RAG module.

Provides:
- LearnerKnowledgeProfile: Structured topic and student level mastery model
- Intent & Query Analyzer: Dissects learning goal, requested depth, prerequisite gaps
- Adaptive Teaching Planner: Tailors instructional scaffolding, depth, and teaching modes
- Evidence-based Mastery Updates: Updates topic mastery from quizzes, checks, and explicit signals
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from app.providers import get_llm, llm_text

log = logging.getLogger("rag.adaptive")

VALID_MASTERY_LEVELS = ["beginner", "developing", "proficient", "advanced"]
VALID_TEACHING_MODES = [
    "explain",
    "step_by_step",
    "socratic",
    "worked_example",
    "practice",
    "exam_revision",
    "compare_concepts",
    "ask_tutor",
]


@dataclass
class EvidenceRecord:
    source: str  # "quiz", "understanding_check", "self_report", "tutor_interaction"
    detail: str
    score: Optional[float] = None
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    weight: float = 1.0


@dataclass
class LearnerKnowledgeProfile:
    student_id: str
    subject_id: Optional[str] = None
    estimated_mastery_level: str = "developing"  # beginner, developing, proficient, advanced
    concepts_demonstrated: List[str] = field(default_factory=list)
    concepts_needing_practice: List[str] = field(default_factory=list)
    recent_quiz_scores: List[float] = field(default_factory=list)
    recurring_mistakes: List[str] = field(default_factory=list)
    preferred_explanation_depth: str = "developing"
    preferred_language: str = "en"
    preferred_teaching_mode: str = "ask_tutor"
    last_assessed_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    evidence_sources: List[Dict[str, Any]] = field(default_factory=list)
    confidence_in_mastery_estimate: float = 0.5  # 0.0 - 1.0

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]], student_id: str = "anonymous") -> "LearnerKnowledgeProfile":
        if not data:
            return cls(student_id=student_id)
        level = data.get("estimated_mastery_level") or data.get("masteryLevel") or data.get("learner_level") or "developing"
        if level not in VALID_MASTERY_LEVELS:
            level = "developing"
        depth = data.get("preferred_explanation_depth") or level
        if depth not in VALID_MASTERY_LEVELS:
            depth = "developing"
        mode = data.get("preferred_teaching_mode") or data.get("mode") or "ask_tutor"
        if mode not in VALID_TEACHING_MODES:
            mode = "ask_tutor"

        return cls(
            student_id=str(data.get("student_id") or data.get("studentId") or student_id),
            subject_id=data.get("subject_id") or data.get("subjectId"),
            estimated_mastery_level=level,
            concepts_demonstrated=list(data.get("concepts_demonstrated") or data.get("conceptsDemonstrated") or []),
            concepts_needing_practice=list(data.get("concepts_needing_practice") or data.get("conceptsNeedingPractice") or []),
            recent_quiz_scores=[float(s) for s in (data.get("recent_quiz_scores") or data.get("recentQuizScores") or [])],
            recurring_mistakes=list(data.get("recurring_mistakes") or data.get("recurringMistakes") or []),
            preferred_explanation_depth=depth,
            preferred_language=str(data.get("preferred_language") or data.get("preferredLanguage") or "en"),
            preferred_teaching_mode=mode,
            last_assessed_at=str(data.get("last_assessed_at") or data.get("lastAssessedAt") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
            evidence_sources=list(data.get("evidence_sources") or data.get("evidenceSources") or []),
            confidence_in_mastery_estimate=float(data.get("confidence_in_mastery_estimate") or data.get("confidence") or 0.5),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class QueryLearningIntent:
    topic: str
    subtopic: str
    immediate_goal: str  # "definition", "explanation", "example", "derivation", "numerical_solution", "code", "revision", "practice", "comparison"
    requested_depth: Optional[str]  # "beginner", "developing", "proficient", "advanced" or None
    is_explicit_override: bool
    prerequisite_gaps: List[str]
    needs_scaffolding: bool
    normalized_query: str
    language: str


def _clean_json(text: str) -> Optional[dict]:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def analyze_query_and_intent(
    question: str,
    history: List[Dict[str, str]],
    profile: LearnerKnowledgeProfile,
) -> QueryLearningIntent:
    """Dissects the student query to extract learning goals, requested depth, and prerequisite gaps."""
    q = question.strip()
    norm_q = q

    prompt = (
        "TASK:ANALYZE_LEARNER_INTENT\n"
        "You are an educational psychology and learning analytics assistant. Analyze the student's question.\n"
        "Extract:\n"
        "1. topic: High-level academic topic (e.g. Operating Systems Concurrency, Database Normalization).\n"
        "2. subtopic: Specific concept (e.g. Deadlocks, Banker's Algorithm, 3NF).\n"
        "3. goal: One of [definition, explanation, example, derivation, numerical_solution, code, revision, practice, comparison].\n"
        "4. requested_depth: Did the student explicitly ask for a specific level? (e.g. 'explain simply', 'in simple words' -> beginner; 'formal proof', 'in-depth math' -> advanced). If not specified, return null.\n"
        "5. normalized_query: Clean spelling errors and resolve references (e.g. 'what is that' -> 'what is Banker Algorithm') while preserving the exact semantic intent.\n"
        "6. language: 'en', 'gu', 'hi', or detected language code.\n"
        "7. prerequisite_gaps: Which of the STUDENT KNOWN WEAK CONCEPTS are prerequisites needed to understand this topic? Return list of strings, or [].\n\n"
        f"STUDENT KNOWN WEAK CONCEPTS: {json.dumps(profile.concepts_needing_practice)}\n"
        f"RECENT CONVERSATION:\n{json.dumps(history[-3:] if history else [])}\n"
        f"QUESTION: {q}\n\n"
        "Reply ONLY valid JSON:\n"
        '{"topic":"...", "subtopic":"...", "goal":"...", "requested_depth":null|"beginner"|"developing"|"proficient"|"advanced", "normalized_query":"...", "language":"en", "prerequisite_gaps":["..."]}'
    )

    try:
        raw = llm_text(get_llm("light").invoke(prompt))
        parsed = _clean_json(raw) or {}
    except Exception as e:
        log.warning("Intent analysis LLM fallback: %s", e)
        parsed = {}

    topic = parsed.get("topic") or "General Course Concept"
    subtopic = parsed.get("subtopic") or topic
    goal = parsed.get("goal") or "explanation"
    req_depth = parsed.get("requested_depth")
    if req_depth not in VALID_MASTERY_LEVELS:
        req_depth = None
    norm_q = parsed.get("normalized_query") or q
    lang = parsed.get("language") or profile.preferred_language or "en"

    # Identify prerequisite gaps against the learner profile
    gaps = []
    llm_gaps = parsed.get("prerequisite_gaps") or []
    if isinstance(llm_gaps, list):
        for g in llm_gaps:
            clean_g = str(g).strip()
            if any(clean_g.lower() == w.lower() for w in profile.concepts_needing_practice):
                gaps.append(clean_g)

    for weak in profile.concepts_needing_practice:
        if weak.lower() in norm_q.lower() or weak.lower() in subtopic.lower() or weak.lower() in topic.lower():
            if weak not in gaps:
                gaps.append(weak)

    is_override = req_depth is not None and req_depth != profile.estimated_mastery_level

    return QueryLearningIntent(
        topic=topic,
        subtopic=subtopic,
        immediate_goal=goal,
        requested_depth=req_depth,
        is_explicit_override=is_override,
        prerequisite_gaps=gaps,
        needs_scaffolding=len(gaps) > 0 and profile.estimated_mastery_level in {"beginner", "developing"},
        normalized_query=norm_q,
        language=lang,
    )


class TeachingPlanner:
    """Plans tailored pedagogical instructions and scaffolding."""

    STRATEGIES: Dict[str, str] = {
        "beginner": (
            "- Use accessible, intuitive language and everyday relatable analogies.\n"
            "- Define essential jargon simply before using it.\n"
            "- Break complex mechanisms into small, digestible sequential steps.\n"
            "- Avoid overwhelming the student with excessive mathematical formalism or edge cases at first."
        ),
        "developing": (
            "- Use structured, progressive explanations.\n"
            "- Introduce formal technical terminology alongside clear practical explanations.\n"
            "- Include worked walkthroughs connecting principles to real application examples.\n"
            "- Reinforce core mechanics with concise reasoning."
        ),
        "proficient": (
            "- Deliver thorough conceptual explanations with analytical depth.\n"
            "- Highlight architectural, algorithmic, or theoretical tradeoffs and comparisons.\n"
            "- Emphasize independent problem-solving and underlying mechanisms.\n"
            "- Briefly reference relevant edge cases and optimization principles."
        ),
        "advanced": (
            "- Use precise academic and industry terminology without dumbing down.\n"
            "- Provide formal mathematical notation, algorithmic complexity, and foundational assumptions.\n"
            "- Discuss subtle edge cases, failure modes, concurrent race conditions, or optimization bottlenecks.\n"
            "- Challenge the student with thought-provoking architectural nuances."
        ),
    }

    MODE_GUIDELINES: Dict[str, str] = {
        "explain": "- Focus on an illuminating, concept-first educational breakdown.",
        "step_by_step": "- Break the entire explanation down into numbered sequential steps (1, 2, 3...).",
        "socratic": (
            "- SOCRATIC TUTORING: Do NOT give the complete final answer immediately.\n"
            "- Provide a guiding conceptual hint and ask an insightful follow-up question that leads the student to the next step."
        ),
        "worked_example": (
            "- Structure as an explicit, step-by-step worked problem:\n"
            "  1. Problem Definition & Given Parameters\n"
            "  2. Governing Course Principles / Formulas\n"
            "  3. Step-by-Step Derivation\n"
            "  4. Final Verified Result & Key Takeaway"
        ),
        "practice": (
            "- Generate 2 targeted practice multiple-choice questions (A, B, C, D) based strictly on this material.\n"
            "- Provide hidden or trailing answer keys with step-by-step explanations."
        ),
        "exam_revision": (
            "- Structure as a high-yield exam revision brief:\n"
            "  * Core Formula / Definition Summary\n"
            "  * Key Architectural Points\n"
            "  * Common Exam Pitfalls & Misconceptions to Avoid\n"
            "  * Likely 5-mark / 10-mark Question Angle"
        ),
        "compare_concepts": (
            "- Provide an explicit side-by-side comparative table contrasting key criteria (Definition, Purpose, Mechanics, Advantages, Tradeoffs)."
        ),
        "ask_tutor": "- Standard balanced pedagogical tutor response.",
    }

    @classmethod
    def generate_instruction(
        cls,
        intent: QueryLearningIntent,
        profile: LearnerKnowledgeProfile,
        effective_mode: str,
    ) -> str:
        # Explicit student request takes precedence over profile mastery level
        effective_depth = intent.requested_depth or profile.preferred_explanation_depth or profile.estimated_mastery_level or "developing"
        if effective_depth not in VALID_MASTERY_LEVELS:
            effective_depth = "developing"

        strategy_text = cls.STRATEGIES.get(effective_depth, cls.STRATEGIES["developing"])
        mode_text = cls.MODE_GUIDELINES.get(effective_mode, cls.MODE_GUIDELINES["ask_tutor"])

        scaffolding_block = ""
        if intent.needs_scaffolding and intent.prerequisite_gaps:
            scaffolding_block = (
                f"\nPEDAGOGICAL SCAFFOLDING REQUIRED:\n"
                f"The student has demonstrated prerequisite gaps in: {', '.join(intent.prerequisite_gaps)}.\n"
                f"Before addressing the advanced topic, dedicate the first 2-3 sentences to briefly grounding "
                f"the prerequisite concept in simple terms so the student has the foundation to understand the main answer.\n"
            )

        understanding_check_block = (
            "\nFORMATIVE UNDERSTANDING CHECK:\n"
            "At the very end of your response, include ONE concise, friendly concept-check question "
            "(e.g. 'Quick check: What would happen if...?') to test the student's grasp of the core takeaway. "
            "Label it clearly as '### 💡 Quick Concept Check'.\n"
            "Do not force an understanding check if the user specifically asked for quick code or a brief definition."
        )

        return (
            f"\n--- ADAPTIVE PEDAGOGICAL PLAN ---\n"
            f"Target Explanation Level: {effective_depth.upper()}"
            f"{' (Explicit Student Override)' if intent.is_explicit_override else ' (Inferred from Learner Profile)'}\n"
            f"{strategy_text}\n"
            f"Teaching Mode: {effective_mode}\n"
            f"{mode_text}\n"
            f"{scaffolding_block}"
            f"{understanding_check_block}\n"
            f"----------------------------------\n"
        )


def update_learner_profile_mastery(
    profile: LearnerKnowledgeProfile,
    topic: str,
    evidence_type: str,  # "quiz", "understanding_check", "self_report"
    score: float,  # 0.0 to 100.0
    detail: str,
) -> LearnerKnowledgeProfile:
    """Updates learner profile based on explicit evidence using recency-weighted Bayesian adjustment."""
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Add evidence record
    record = {
        "source": evidence_type,
        "topic": topic,
        "score": score,
        "detail": detail,
        "timestamp": now,
    }
    profile.evidence_sources.append(record)
    if len(profile.evidence_sources) > 30:
        profile.evidence_sources = profile.evidence_sources[-30:]

    if evidence_type == "quiz":
        profile.recent_quiz_scores.append(score)
        if len(profile.recent_quiz_scores) > 10:
            profile.recent_quiz_scores = profile.recent_quiz_scores[-10:]

    # Update concept lists
    if score >= 75.0:
        if topic not in profile.concepts_demonstrated:
            profile.concepts_demonstrated.append(topic)
        if topic in profile.concepts_needing_practice:
            profile.concepts_needing_practice.remove(topic)
    elif score < 60.0:
        if topic not in profile.concepts_needing_practice:
            profile.concepts_needing_practice.append(topic)
        if topic in profile.concepts_demonstrated:
            profile.concepts_demonstrated.remove(topic)
        if detail and detail not in profile.recurring_mistakes:
            profile.recurring_mistakes.append(detail)
            if len(profile.recurring_mistakes) > 10:
                profile.recurring_mistakes = profile.recurring_mistakes[-10:]

    # Compute overall mastery level from evidence
    total_ev = len(profile.evidence_sources)
    scores = [e["score"] for e in profile.evidence_sources if isinstance(e.get("score"), (int, float))]

    if not scores:
        profile.confidence_in_mastery_estimate = 0.2
    else:
        # Exponential recency weighting: recent scores carry higher weight
        weights = [1.0 + (i / max(1, len(scores))) for i in range(len(scores))]
        weighted_avg = sum(s * w for s, w in zip(scores, weights)) / sum(weights)

        # Map to 4-tier mastery scale
        if weighted_avg >= 85.0 and total_ev >= 3:
            profile.estimated_mastery_level = "advanced"
        elif weighted_avg >= 70.0:
            profile.estimated_mastery_level = "proficient"
        elif weighted_avg >= 55.0:
            profile.estimated_mastery_level = "developing"
        else:
            profile.estimated_mastery_level = "beginner"

        # Confidence increases with amount of consistent evidence
        profile.confidence_in_mastery_estimate = min(0.95, round(0.3 + (total_ev * 0.05), 2))

    profile.last_assessed_at = now
    return profile
