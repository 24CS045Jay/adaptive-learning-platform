import json

import pytest
from fastapi.testclient import TestClient

import synthetic
from app.agent import NO_ANSWER
from app.main import app

H = {"X-Internal-Token": "test-token"}
c = TestClient(app)


def test_health_is_open_and_reports_state():
    r = c.get("/health").json()
    assert r["chroma_connected"] and r["offline_mode"] and r["vector_store_mode"] == "chroma_local"


@pytest.mark.parametrize("method,path", [("post", "/query"), ("post", "/ingest"), ("get", "/documents/x/chunks"), ("post", "/delete-document")])
def test_endpoints_require_token(method, path):
    assert c.request(method.upper(), path).status_code == 401
    assert c.request(method.upper(), path, headers={"X-Internal-Token": "wrong"}).status_code == 401


def test_full_express_flow():
    """Replays exactly what routes/documents.js and routes/tutor.js send."""
    text = "The Krebs cycle takes place in the mitochondrial matrix and produces NADH and FADH2."
    r = c.post("/ingest", headers=H, json={"documentId": "api-doc1", "subjectCode": "BIO900", "text": text,
        "metadata": {"subject": "BIO900", "fileName": "krebs.txt", "is_active": True, "semester": 2}})
    assert r.status_code == 200 and r.json()["chunkCount"] >= 1

    st = c.get("/documents/api-doc1/ingestion-status", headers=H).json()
    assert st["status"] == "completed" and st["metrics"]["vectors_indexed"] >= 1
    ch = c.get("/documents/api-doc1/chunks", headers=H).json()
    assert ch["count"] >= 1 and ch["chunks"][0]["text"] and "embedding_model" in ch

    body = {"query": "Where does the Krebs cycle take place?", "subjectCode": "BIO900", "subject_name": "Bio",
            "mode": "ask_tutor", "learner_level": "beginner", "chat_history": [],
            "security_context": {"user_id": "s1", "role": "student", "department_id": "dept-default", "subject_ids": ["mongo-id"]}}
    q = c.post("/query", headers=H, json=body).json()
    assert "matrix" in q["answer"].lower() and q["grounded"] and q["sources"][0]["document_id"] == "api-doc1"
    for k in ["confidence", "mode", "intent", "retrieval", "agent_trace", "tool_used", "follow_up"]:
        assert k in q

    body["subjectCode"] = "OTHER"
    assert c.post("/query", headers=H, json=body).json()["answer"] == NO_ANSWER

    assert c.post("/delete-document", headers=H, json={"documentId": "api-doc1", "subjectCode": "BIO900"}).json()["deletedChunks"] >= 1
    body["subjectCode"] = "BIO900"
    assert c.post("/query", headers=H, json=body).json()["answer"] == NO_ANSWER


def test_multipart_upload_all_formats():
    for subj, files in synthetic.make_all().items():
        for name, data in files.items():
            r = c.post("/ingest-file", headers=H, files={"file": (name, data)},
                       data={"documentId": f"up-{subj}-{name}", "subjectCode": subj, "metadata": json.dumps({"is_active": True})})
            assert r.status_code == 200 and r.json()["chunkCount"] >= 1, (name, r.text)


def test_unparseable_upload_returns_422():
    r = c.post("/ingest-file", headers=H, files={"file": ("x.pdf", b"garbage")}, data={"documentId": "bad", "subjectCode": "X"})
    assert r.status_code == 422 and "Cannot parse" in r.json()["detail"]
    assert c.get("/documents/bad/ingestion-status", headers=H).json()["status"] == "failed"


def test_student_without_subject_is_rejected():
    r = c.post("/query", headers=H, json={"query": "hi there", "security_context": {"role": "student", "user_id": "s"}})
    assert r.status_code == 400


def test_empty_query_rejected():
    assert c.post("/query", headers=H, json={"query": "  ", "subjectCode": "X"}).status_code == 400
