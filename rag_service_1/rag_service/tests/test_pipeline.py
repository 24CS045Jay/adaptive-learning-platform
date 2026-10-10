import pytest

import synthetic
from app.agent import NO_ANSWER, ask
from app.ingest import get_status, ingest_document
from app.parsers import ParseError, parse_bytes
from app.retriever import HybridRetriever, build_where
from app.store import get_store


# ---------------------------------------------------------------- parsing (every format)
@pytest.mark.parametrize("subj,name", [(s, n) for s, f in synthetic.make_all().items() for n in f])
def test_every_format_parses_and_contains_text(subj, name):
    data = synthetic.make_all()[subj][name]
    secs = parse_bytes(data, name)
    assert secs and all(s.text.strip() for s in secs)
    assert sum(len(s.text) for s in secs) > 100


def test_pdf_keeps_page_numbers():
    secs = parse_bytes(synthetic.make_pdf(synthetic.BIO), "x.pdf")
    assert [s.page for s in secs] == [1, 2]  # 2 headings -> 2 pages


def test_html_strips_scripts():
    secs = parse_bytes(synthetic.make_all()["CS201"]["db_page.html"], "p.html")
    assert "x=1" not in secs[0].text and "ACID" in secs[0].text


@pytest.mark.parametrize("name,data", [("a.exe", b"abc"), ("a.pdf", b""), ("a.pdf", b"not a pdf"), ("a.docx", b"junk"), ("a.txt", b"   ")])
def test_bad_files_raise_parse_error(name, data):
    with pytest.raises(ParseError):
        parse_bytes(data, name)


# ---------------------------------------------------------------- ingestion
def test_ingest_reports_chunks_and_metrics(corpus):
    st = get_status("BIO101-bio_notes.pdf")
    assert st["status"] == "completed"
    m = st["metrics"]
    assert m["chunks_created"] == m["vectors_indexed"] >= 2
    assert m["characters_extracted"] > 200


def test_chunk_metadata_provenance(corpus):
    chunks = get_store().chunks_of("BIO101-bio_notes.pdf")
    assert chunks
    for c in chunks:
        md = c.metadata
        assert md["subject_code"] == "BIO101" and md["is_active"] is True
        assert md["page"] >= 1 and md["chunk_id"].startswith("BIO101-bio_notes.pdf:")


def test_reingest_is_idempotent(corpus):
    before = len(get_store().chunks_of("PHY101-physics.docx"))
    for _ in range(2):
        ingest_document("PHY101-physics.docx", {"subject": "PHY101"}, data=synthetic.make_all()["PHY101"]["physics.docx"], file_name="physics.docx")
    assert len(get_store().chunks_of("PHY101-physics.docx")) == before


def test_failed_ingest_marks_status_failed():
    with pytest.raises(ParseError):
        ingest_document("bad-doc", {"subject": "X"}, data=b"junk", file_name="x.docx")
    st = get_status("bad-doc")
    assert st["status"] == "failed" and st["error"]


# ---------------------------------------------------------------- retrieval quality
def test_retrieval_hit_rate(corpus):
    hits = 0
    for subj, q, kw, _ in synthetic.QA:
        r = HybridRetriever(where=build_where([subj]), top_k=3)
        got = " ".join(d.page_content.lower() for d, _ in r.search(q))
        hits += kw.lower() in got
    assert hits / len(synthetic.QA) >= 0.9, f"hit@3 = {hits}/{len(synthetic.QA)}"


# ---------------------------------------------------------------- authorization isolation
@pytest.mark.parametrize("subj,q,secret", synthetic.LEAKAGE)
def test_no_cross_subject_leak_in_retrieval(corpus, subj, q, secret):
    r = HybridRetriever(where=build_where([subj]), top_k=8)
    for d, _ in r.search(q):
        assert d.metadata["subject_code"] == subj


@pytest.mark.parametrize("subj,q,secret", synthetic.LEAKAGE)
def test_agent_refuses_out_of_scope_subject(corpus, subj, q, secret):
    out = ask(q, subject_codes=[subj])
    assert out["answer"] == NO_ANSWER and out["sources"] == []


def test_inactive_documents_are_invisible(corpus):
    ingest_document("PHY101-hidden", {"subject": "PHY101", "is_active": False}, text="Zorbonium is a secret element discovered by hidden researchers.", file_name="h.txt")
    out = ask("What is Zorbonium?", subject_codes=["PHY101"])
    assert out["answer"] == NO_ANSWER
    get_store().set_active("PHY101-hidden", True)
    out = ask("What is Zorbonium?", subject_codes=["PHY101"])
    assert "zorbonium" in out["answer"].lower() and out["grounded"]
    get_store().delete_document("PHY101-hidden")


def test_delete_removes_from_answers(corpus):
    ingest_document("CS201-tmp", {"subject": "CS201"}, text="The Quibblesort algorithm sorts frogs by hopping distance.", file_name="t.txt")
    assert "quibblesort" in ask("What is Quibblesort?", subject_codes=["CS201"])["answer"].lower()
    get_store().delete_document("CS201-tmp")
    assert ask("What is Quibblesort?", subject_codes=["CS201"])["answer"] == NO_ANSWER


# ---------------------------------------------------------------- agent behaviour
@pytest.mark.parametrize("subj,q,kw,src", synthetic.QA)
def test_answers_are_correct_cited_and_grounded(corpus, subj, q, kw, src):
    out = ask(q, subject_codes=[subj])
    assert kw.lower() in out["answer"].lower(), out["answer"]
    assert out["grounded"] is True
    assert out["sources"], "answer must carry real citations"
    assert all(subj in s["document_id"] for s in out["sources"])
    assert out["confidence"] >= 0.35  # above Express escalation threshold
    nodes = [t["node"] for t in out["agent_trace"]]
    assert nodes[:4] == ["route", "rewrite", "retrieve", "grade"] and nodes[-1] == "finalize"


@pytest.mark.parametrize("subj,q", synthetic.UNANSWERABLE)
def test_unanswerable_questions_fail_closed(corpus, subj, q):
    out = ask(q, subject_codes=[subj])
    assert out["answer"] == NO_ANSWER and out["confidence"] < 0.35 and out["sources"] == []


def test_greeting_and_offtopic_skip_retrieval(corpus):
    for q in ["hello", "what is the weather today"]:
        out = ask(q, subject_codes=["BIO101"])
        assert "retrieve" not in [t["node"] for t in out["agent_trace"]] and out["confidence"] == 1.0


def test_retry_loop_is_bounded(corpus):
    out = ask("Tell me about quantum chromodynamics gluons", subject_codes=["BIO101"])
    assert [t["node"] for t in out["agent_trace"]].count("retrieve") <= 2
