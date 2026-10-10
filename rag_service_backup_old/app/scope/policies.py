"""
Scope policies and canned responses for deterministic intent routing.
Ensures zero hallucination, zero wasted retrieval for non-academic queries.
"""

GREETING_RESPONSE = (
    "Hi! I'm your CSPIT AI Learning Assistant. I can help you study your enrolled subjects, "
    "explain concepts, prepare for exams, solve course-related problems, and summarize approved study material. "
    "What would you like to learn today?"
)

SMALL_TALK_RESPONSES = {
    "how_are_you": (
        "I'm doing well and ready to help you with your coursework! Which subject or topic are you working on?"
    ),
    "who_are_you": (
        "I am your university-approved AI Academic Tutor. I use verified lecture slides, textbooks, and course documents "
        "to assist you with your studies. How can I help you today?"
    ),
    "thanks": (
        "You're very welcome! Let me know if you need any more explanations or practice questions."
    ),
    "goodbye": (
        "Goodbye! Best of luck with your studies. Feel free to return anytime you have questions."
    ),
}

OFF_TOPIC_RESPONSE = (
    "I'm focused on helping with your enrolled academic subjects and approved course material. "
    "Please ask me a study-related question."
)

UNCLEAR_RESPONSE = (
    "I can help with your academic subjects and approved course material. "
    "Please ask a clear, study-related question."
)

INSUFFICIENT_EVIDENCE_RESPONSE = (
    "I couldn't find enough information in the approved course material to answer this question. "
    "Please ensure relevant documents are uploaded and approved by your faculty."
)

ACCESS_DENIED_RESPONSE = (
    "Access Denied: You do not have active enrollment permissions to access the requested course material."
)

GENERATION_UNAVAILABLE_RESPONSE = (
    "Generation service is temporarily unavailable. All underlying LLM providers are cooling down or experiencing high traffic. Please retry in a few moments."
)
