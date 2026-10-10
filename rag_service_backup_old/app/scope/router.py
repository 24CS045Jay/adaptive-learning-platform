"""
Deterministic and LLM-assisted Scope Router.
Classifies user query into:
- GREETING
- SMALL_TALK
- OFF_TOPIC
- UNCLEAR
- ACADEMIC

Fails closed on off-topic and unclear queries without triggering vector retrieval.
"""

from __future__ import annotations

import enum
import re
from typing import Dict, Any, Optional
from app.scope.policies import (
    GREETING_RESPONSE,
    SMALL_TALK_RESPONSES,
    OFF_TOPIC_RESPONSE,
    UNCLEAR_RESPONSE,
)


class ScopeCategory(str, enum.Enum):
    GREETING = "GREETING"
    SMALL_TALK = "SMALL_TALK"
    OFF_TOPIC = "OFF_TOPIC"
    UNCLEAR = "UNCLEAR"
    ACADEMIC = "ACADEMIC"


class ScopeRouter:
    """
    Deterministic scope classifier with sub-millisecond execution for standard cases.
    """

    GREETING_PATTERNS = [
        r"^(hi|hello|hey|greetings|namaste|good\s+(morning|afternoon|evening|day))[\s!.]*$",
        r"^(hi|hello|hey)\s+(tutor|there|ai|bot|assistant)[\s!.]*$",
    ]

    SMALL_TALK_PATTERNS = {
        "how_are_you": r"^(how\s+are\s+you|how\s+do\s+you\s+do|how\'s\s+it\s+going|wassup|sup)[\s!?.]*$",
        "who_are_you": r"^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself)[\s!?.]*$",
        "thanks": r"^(thanks|thank\s+you|thx|ty|much\s+appreciated|thanks\s+a\s+lot)[\s!.]*$",
        "goodbye": r"^(bye|goodbye|see\s+you|take\s+care|farewell)[\s!.]*$",
    }

    OFF_TOPIC_KEYWORDS = [
        "cricket", "ipl", "football", "fifa", "basketball", "nba", "messi", "ronaldo", "virat", "dhoni",
        "movie", "cinema", "actor", "actress", "hollywood", "bollywood", "netflix",
        "song", "music", "spotify", "weather", "recipe", "cook", "restaurant",
        "election", "president", "prime minister", "politics", "crypto", "bitcoin",
        "joke", "dating", "horoscope", "zodiac"
    ]

    def classify(self, query: str) -> Dict[str, Any]:
        """
        Classifies user query and returns routing decision and canned response if non-academic.
        """
        cleaned = (query or "").strip().lower()

        # 1. Unclear / empty / gibberish
        if not cleaned or len(cleaned) < 2:
            return {
                "category": ScopeCategory.UNCLEAR,
                "is_academic": False,
                "response": UNCLEAR_RESPONSE,
            }

        # Check for keyboard spam / repetitive chars (e.g. asdfgh, aaaaa, ????)
        if re.match(r"^[^a-zA-Z0-9]+$", cleaned) or len(set(cleaned.replace(" ", ""))) <= 2 and len(cleaned) > 5:
            return {
                "category": ScopeCategory.UNCLEAR,
                "is_academic": False,
                "response": UNCLEAR_RESPONSE,
            }

        if cleaned in ["asdf", "asdfgh", "asdfghjkl", "qwerty", "random", "tell me something random"]:
            return {
                "category": ScopeCategory.UNCLEAR,
                "is_academic": False,
                "response": UNCLEAR_RESPONSE,
            }

        # 2. Greetings
        for pat in self.GREETING_PATTERNS:
            if re.match(pat, cleaned):
                return {
                    "category": ScopeCategory.GREETING,
                    "is_academic": False,
                    "response": GREETING_RESPONSE,
                }

        # 3. Small Talk
        for talk_type, pat in self.SMALL_TALK_PATTERNS.items():
            if re.match(pat, cleaned):
                return {
                    "category": ScopeCategory.SMALL_TALK,
                    "is_academic": False,
                    "response": SMALL_TALK_RESPONSES.get(talk_type, GREETING_RESPONSE),
                }

        # 4. Off-Topic keywords check (only if clearly conversational or non-academic query)
        words = set(re.findall(r"\b[a-z]+\b", cleaned))
        for kw in self.OFF_TOPIC_KEYWORDS:
            if kw in words or kw in cleaned:
                # Ensure it's not actually an academic topic (e.g. "binary search vs cricket" -> off-topic)
                academic_markers = ["algorithm", "complexity", "architecture", "database", "sql", "network", "protocol", "operating system"]
                if not any(marker in cleaned for marker in academic_markers):
                    return {
                        "category": ScopeCategory.OFF_TOPIC,
                        "is_academic": False,
                        "response": OFF_TOPIC_RESPONSE,
                    }

        # 5. Default to Academic
        return {
            "category": ScopeCategory.ACADEMIC,
            "is_academic": True,
            "response": None,
        }


_router_instance: Optional[ScopeRouter] = None


def get_scope_router() -> ScopeRouter:
    global _router_instance
    if _router_instance is None:
        _router_instance = ScopeRouter()
    return _router_instance
