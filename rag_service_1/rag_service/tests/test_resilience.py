"""Failure injection: provider outages and malformed model output must degrade safely."""
import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

import app.agent as agent
from app.agent import LLMUnavailable, ask
from app.main import app as fastapi_app

H = {"X-Internal-Token": "test-token"}


class Boom:
    def invoke(self, *_a, **_k):
        raise RuntimeError("provider down")


def test_heavy_llm_outage_raises_and_api_returns_503(corpus, monkeypatch):
    real = agent.get_llm
    monkeypatch.setattr(agent, "get_llm", lambda tier="heavy", **k: Boom() if tier == "heavy" else real(tier))
    with pytest.raises(LLMUnavailable):
        ask("Which organelle produces ATP?", subject_codes=["BIO101"])
    r = TestClient(fastapi_app).post("/query", headers=H, json={"query": "Which organelle produces ATP?", "subjectCode": "BIO101"})
    assert r.status_code == 503  # fail closed: Express then escalates, no fake answer


def test_light_llm_outage_degrades_but_still_answers(corpus, monkeypatch):
    real = agent.get_llm
    monkeypatch.setattr(agent, "get_llm", lambda tier="heavy", **k: Boom() if tier == "light" else real(tier))
    out = ask("Which organelle produces ATP?", subject_codes=["BIO101"])
    assert "mitochondria" in out["answer"].lower() and out["sources"]


def test_garbage_json_from_light_llm_is_survivable(corpus, monkeypatch):
    real = agent.get_llm
    junk = FakeListChatModel(responses=["I think... ```nope``` {bad json"] * 20)
    monkeypatch.setattr(agent, "get_llm", lambda tier="heavy", **k: junk if tier == "light" else real(tier))
    out = ask("Which organelle produces ATP?", subject_codes=["BIO101"])
    assert out["intent"] == "academic" and "mitochondria" in out["answer"].lower()


def test_hallucinating_generator_is_caught_by_verifier(corpus, monkeypatch):
    """Generator invents facts not in context -> verifier marks ungrounded -> no_answer (never shown)."""
    real = agent.get_llm
    liar = FakeListChatModel(responses=["The mitochondria were discovered on Jupiter by purple dragons in 1850 [1]."] * 5)

    def pick(tier="heavy", **k):
        if tier == "heavy":
            class Mix:
                def invoke(self, prompt, *a, **kw):
                    p = prompt if isinstance(prompt, str) else str(prompt)
                    return real("heavy").invoke(prompt) if "TASK:VERIFY" in p else liar.invoke(prompt)
            return Mix()
        return real(tier)

    monkeypatch.setattr(agent, "get_llm", pick)
    out = ask("Which organelle produces ATP?", subject_codes=["BIO101"])
    assert out["grounded"] is False and out["confidence"] < 0.35 and "purple dragons" not in out["answer"]
