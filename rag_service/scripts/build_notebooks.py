"""Generates the 6 connected notebooks in ../notebooks. Run: python scripts/build_notebooks.py"""
import nbformat as nbf
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "notebooks"
OUT.mkdir(exist_ok=True)

SETUP = '''# ---- Shared setup (identical in every notebook) -------------------------------
import os, sys, json, pathlib, time
from dotenv import load_dotenv
ROOT = pathlib.Path.cwd().parent if pathlib.Path.cwd().name == "notebooks" else pathlib.Path.cwd()
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "sample_data"))

# Automatically load environment variables from rag_service/.env and repo-root .env
load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT.parent / ".env", override=False)

# OFFLINE=True  -> deterministic hash embeddings + mock LLM + local Chroma. No keys, no network.
# OFFLINE=False -> REAL Gemini/Groq/OpenAI + Chroma Cloud from your .env (default when keys are present)
has_keys = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY"))
OFFLINE = (os.getenv("NB_OFFLINE", "0" if has_keys else "1") == "1")
if OFFLINE:
    os.environ["RAG_OFFLINE"] = "1"
    os.environ["CHROMA_LOCAL_DIR"] = str(ROOT / "chroma_notebook")   # shared by all notebooks
else:
    os.environ["RAG_OFFLINE"] = "0"

from app.config import get_settings, reset_settings_cache
reset_settings_cache()
S = get_settings()
print("mode            :", "OFFLINE (mock)" if S.offline else "LIVE providers")
print("vector store    :", "Chroma Cloud" if S.use_chroma_cloud else f"local ({S.chroma_local_dir})")
print("embedding       :", "hash512" if S.offline else S.embedding_provider)
print("LLM providers   :", [p for p, k in (("gemini", S.gemini_key), ("groq", S.groq_key), ("openai", S.openai_key)) if k] or "none (offline mock)")'''

INSTALL = '''# Install every library the pipeline needs (safe to re-run)
%pip install -q -r ../requirements.txt'''


def nb(name, cells):
    n = nbf.v4.new_notebook()
    n.metadata["kernelspec"] = {"display_name": "Python 3", "language": "python", "name": "python3"}
    n.cells = [nbf.v4.new_markdown_cell(c[1]) if c[0] == "md" else nbf.v4.new_code_cell(c[1]) for c in cells]
    nbf.write(n, OUT / name)


nb("00_setup_and_provider_check.ipynb", [
    ("md", "# 00 · Setup & provider check\nRun this first. It installs libraries, shows which keys are configured, and (in LIVE mode) makes one tiny real call to each provider so key/model problems show up *here* instead of inside the chatbot.\n\n**Pipeline map (notebooks are connected through the shared Chroma store):**\n`01 ingest` → `02 retrieve` → `03 augment + generate` → `04 agentic LangGraph` → `05 evaluate`"),
    ("code", INSTALL),
    ("code", SETUP),
    ("md", "## Which keys are present? (values are never printed)"),
    ("code", '''for k in ["GEMINI_API_KEY","GROQ_API_KEY","OPENAI_API_KEY","CHROMA_API_KEY","CHROMA_TENANT","CHROMA_DATABASE","INTERNAL_SERVICE_TOKEN"]:
    print(f"{k:24s}", "SET" if os.getenv(k) else "-- missing --")'''),
    ("md", "## Embedding model smoke test"),
    ("code", '''from app.providers import get_embeddings, embedding_id
emb = get_embeddings()
v = emb.embed_query("What is photosynthesis?")
print("embedding id:", embedding_id(), "| dimension:", len(v))
assert len(v) > 100'''),
    ("md", "## LLM smoke test (light + heavy tier)"),
    ("code", '''from app.providers import get_llm, llm_text
for tier in ("light", "heavy"):
    out = llm_text(get_llm(tier).invoke("Reply with the single word: pong"))
    print(tier, "->", out.strip()[:60])'''),
    ("md", "## Vector store connectivity (write → read → delete a probe record)"),
    ("code", '''from app.store import get_store
from langchain_core.documents import Document
st = get_store()
print("mode:", st.mode, "| collection:", st.collection_name, "| heartbeat:", st.heartbeat())
probe = Document(page_content="probe record for connectivity test", metadata={"chunk_id":"__probe__:0","document_id":"__probe__","chunk_index":0,"subject_code":"__PROBE__","is_active":True})
st.upsert([probe]); assert any(d.metadata["document_id"]=="__probe__" for d in st.chunks_of("__probe__"))
st.delete_document("__probe__"); print("probe write/read/delete OK; total chunks now:", st.count())'''),
])

nb("01_ingestion_pipeline.ipynb", [
    ("md", "# 01 · Ingestion pipeline\n**What happens when a faculty member uploads a file:** parse → chunk → embed → store in Chroma.\nEach step is shown separately, then run end-to-end exactly as the API does. Data written here is reused by notebooks 02–05."),
    ("code", SETUP),
    ("md", "## 1. Create synthetic course files (PDF, PPTX, DOCX, XLSX, MD, CSV, HTML)"),
    ("code", '''import synthetic
files = synthetic.make_all()
for subj, fs in files.items():
    print(subj, {n: f"{len(b)//1024 or 1} KB" for n, b in fs.items()})'''),
    ("md", "## 2. Parse (page/slide/sheet aware)"),
    ("code", '''from app.parsers import parse_bytes
secs = parse_bytes(files["BIO101"]["bio_notes.pdf"], "bio_notes.pdf")
for s in secs: print(f"page {s.page}:", s.text[:110].replace("\\n"," "), "...")'''),
    ("md", "## 3. Chunk (recursive splitter, provenance metadata, stable ids)"),
    ("code", '''from app.chunker import chunk_sections
chunks = chunk_sections(secs, "demo-doc", {"subject_code":"BIO101","is_active":True,"file_name":"bio_notes.pdf"})
print(len(chunks), "chunks | sizes:", [len(c.page_content) for c in chunks])
print(json.dumps(chunks[0].metadata, indent=1))'''),
    ("md", "## 4. Embed"),
    ("code", '''from app.providers import get_embeddings
vecs = get_embeddings().embed_documents([c.page_content for c in chunks])
print("vectors:", len(vecs), "x", len(vecs[0]))'''),
    ("md", "## 5. Run the full pipeline for every synthetic file (this is what `POST /ingest` does)"),
    ("code", '''from app.ingest import ingest_document, get_status
results = {}
for subj, fs in files.items():
    for name, data in fs.items():
        did = f"{subj}-{name}"
        results[did] = ingest_document(did, {"subject": subj, "is_active": True}, data=data, file_name=name)
import pandas as pd
pd.DataFrame(results).T[["chunkCount","durationMs","collection"]]'''),
    ("md", "## 6. Verify what is really stored"),
    ("code", '''from app.store import get_store
st = get_store()
print("total chunks in collection:", st.count())
print(get_status("BIO101-bio_notes.pdf"))
sample = st.chunks_of("PHY101-physics.docx")[0]
print(sample.metadata["subject_code"], "| page", sample.metadata["page"], "|", sample.page_content[:100])'''),
    ("md", "## 7. Idempotency + failure handling"),
    ("code", '''n0 = len(st.chunks_of("PHY101-physics.docx"))
ingest_document("PHY101-physics.docx", {"subject":"PHY101","is_active":True}, data=files["PHY101"]["physics.docx"], file_name="physics.docx")
assert len(st.chunks_of("PHY101-physics.docx")) == n0, "re-ingest must not duplicate"
from app.parsers import ParseError
try: ingest_document("bad", {"subject":"X"}, data=b"junk", file_name="bad.pdf")
except ParseError as e: print("clean failure ->", e, "| status:", get_status("bad")["status"])'''),
])

nb("02_retrieval_pipeline.ipynb", [
    ("md", "# 02 · Retrieval pipeline\nDense (Chroma cosine) + sparse (BM25) → Reciprocal Rank Fusion → rerank, always inside an **authorization filter**.\nRequires notebook 01 to have been run (it reads the same store)."),
    ("code", SETUP),
    ("code", '''from app.retriever import HybridRetriever, build_where
from app.store import get_store
assert get_store().count() > 0, "Run notebook 01 first"
def show(q, subj, k=3):
    r = HybridRetriever(where=build_where([subj]), top_k=k)
    print(f"Q: {q}   [scope={subj}]")
    for d, s in r.search(q): print(f"  {s:.3f} | {d.metadata['file_name']:<22} p.{d.metadata['page']} | {d.page_content[:70]!r}")
    print("  trace:", r.last_trace, "\\n")
show("Which organelle produces ATP?", "BIO101")
show("When does total internal reflection occur?", "PHY101")'''),
    ("md", "## LangChain retriever interface\n`HybridRetriever` is a standard `BaseRetriever`, so it also works in any LangChain chain via `.invoke()`."),
    ("code", '''r = HybridRetriever(where=build_where(["CS201"]), top_k=2)
for d in r.invoke("What is third normal form?"): print(d.metadata["file_name"], "|", d.page_content[:80])'''),
    ("md", "## Authorization isolation: a Physics student must never see Biology chunks"),
    ("code", '''r = HybridRetriever(where=build_where(["PHY101"]), top_k=10)
hits = r.search("Which organelle produces ATP?")
print({d.metadata["subject_code"] for d, _ in hits})
assert all(d.metadata["subject_code"] == "PHY101" for d, _ in hits)'''),
    ("md", "## Retrieval quality on the synthetic QA set (hit@3)"),
    ("code", '''import synthetic, pandas as pd
rows = []
for subj, q, kw, _ in synthetic.QA:
    top = HybridRetriever(where=build_where([subj]), top_k=3).search(q)
    rows.append({"subject": subj, "question": q, "hit@3": any(kw in d.page_content.lower() for d, _ in top)})
df = pd.DataFrame(rows); print("hit@3 =", df["hit@3"].mean()); df'''),
])

nb("03_augmentation_and_generation.ipynb", [
    ("md", "# 03 · Augmentation & generation\nBuild the augmented prompt from retrieved chunks (numbered context), generate with the **heavy** model, then verify grounding. This is the manual version of what the LangGraph agent automates in notebook 04."),
    ("code", SETUP),
    ("code", '''from app.retriever import HybridRetriever, build_where
from app.agent import _ctx_block, NO_ANSWER
from app.providers import get_llm, llm_text
question = "Which organelle produces ATP and what kind of DNA does it have?"
hits = HybridRetriever(where=build_where(["BIO101"]), top_k=3).search(question)
relevant = [{"doc": d, "score": s} for d, s in hits]
print(_ctx_block(relevant)[:600], "...")'''),
    ("md", "## Augmented prompt"),
    ("code", '''prompt = ("TASK:ANSWER\\nYou are a university course tutor. Answer ONLY from the numbered context. Cite like [1]. "
          "If the context lacks the answer reply exactly INSUFFICIENT_CONTEXT.\\n"
          f"CONTEXT:\\n{_ctx_block(relevant)}\\nQUESTION: {question}\\n")
print(len(prompt), "chars sent to the LLM")'''),
    ("md", "## Generation (heavy tier)"),
    ("code", '''answer = llm_text(get_llm("heavy").invoke(prompt)).strip()
print(answer)'''),
    ("md", "## Grounding verification (is every claim supported by the context?)"),
    ("code", '''from app.agent import _json
v = _json(llm_text(get_llm("heavy").invoke(
    "TASK:VERIFY\\nReply ONLY JSON {\\"supported_ratio\\":0-1,\\"verdict\\":\\"grounded|ungrounded\\"}.\\n"
    f"ANSWER: {answer}\\nCONTEXT: {_ctx_block(relevant)}")))
print(v)'''),
    ("md", "## Fail-closed demo: a question the material cannot answer"),
    ("code", '''q2 = "Who won the football world cup in 1998?"
h2 = HybridRetriever(where=build_where(["BIO101"]), top_k=3).search(q2)
p2 = prompt.split("CONTEXT:")[0] + f"CONTEXT:\\n{_ctx_block([{'doc':d,'score':s} for d,s in h2])}\\nQUESTION: {q2}\\n"
print(llm_text(get_llm("heavy").invoke(p2)).strip())'''),
])

nb("04_agentic_rag_langgraph.ipynb", [
    ("md", "# 04 · Agentic RAG with LangGraph\nThe full agent: **route → rewrite → retrieve → grade → (refine loop) → generate → verify → finalize**, with bounded retries and a fail-closed `no_answer` path."),
    ("code", SETUP),
    ("md", "## Graph structure"),
    ("code", '''from app.agent import get_graph
print(get_graph().get_graph().draw_mermaid())'''),
    ("md", "Paste the Mermaid text into https://mermaid.live to see the diagram."),
    ("code", '''from app.agent import ask
from app.store import get_store
assert get_store().count() > 0, "Run notebook 01 first"
def run(q, subj="BIO101", history=None):
    out = ask(q, subject_codes=[subj], history=history or [])
    print("Q:", q); print("A:", out["answer"])
    print(f"   confidence={out['confidence']} grounded={out['grounded']} intent={out['intent']} latency={out['latency_ms']}ms")
    print("   sources:", [(s['file_name'], 'p.%s' % s['page']) for s in out["sources"]])
    print("   path   :", " → ".join(t["node"] for t in out["agent_trace"]), "\\n")
    return out
run("hello")
run("Which organelle produces ATP?")
run("Where does photosynthesis take place in a plant cell?")
run("Who won the football world cup in 1998?")
run("what is the weather today")'''),
    ("md", "## Multi-turn: follow-up question resolved with chat history"),
    ("code", '''h = [{"role":"user","content":"What is DNA replication?"},{"role":"assistant","content":"It copies DNA before cell division."}]
o = run("Which enzyme does it use?", history=h)
print("rewritten:", o["standalone_question"])'''),
    ("md", "## Scope enforcement: same question, other subject → refusal"),
    ("code", '''run("Which organelle produces ATP?", subj="PHY101")'''),
    ("md", "## Inspect the full trace of one run"),
    ("code", '''import pandas as pd
pd.DataFrame(ask("Which enzyme adds nucleotides during DNA replication?", subject_codes=["BIO101"])["agent_trace"]).drop(columns="t")'''),
])

nb("05_evaluation_and_testing.ipynb", [
    ("md", "# 05 · Evaluation & testing with synthetic data\nMeasures retrieval, answer correctness, grounding, citations, fail-closed behaviour and cross-subject leakage over the synthetic corpus. Also runs the pytest suite."),
    ("code", SETUP),
    ("code", '''import synthetic, pandas as pd
from app.agent import ask, NO_ANSWER
from app.store import get_store
assert get_store().count() > 0, "Run notebook 01 first"
rows = []
for subj, q, kw, src in synthetic.QA:
    o = ask(q, subject_codes=[subj])
    rows.append(dict(subject=subj, question=q, correct=kw in o["answer"].lower(), grounded=o["grounded"],
                     cited=bool(o["sources"]), conf=o["confidence"], ms=o["latency_ms"]))
ans = pd.DataFrame(rows); ans'''),
    ("code", '''print("answer correctness :", ans.correct.mean())
print("grounded            :", ans.grounded.mean())
print("has citations       :", ans.cited.mean())
print("mean confidence     :", round(ans.conf.mean(), 3), "| mean latency ms:", int(ans.ms.mean()))'''),
    ("md", "## Fail-closed on unanswerable questions"),
    ("code", '''un = [ask(q, subject_codes=[s]) for s, q in synthetic.UNANSWERABLE]
print("refused correctly:", sum(o["answer"] == NO_ANSWER for o in un), "/", len(un))'''),
    ("md", "## Cross-subject leakage probes"),
    ("code", '''leaks = [ask(q, subject_codes=[s]) for s, q, _ in synthetic.LEAKAGE]
print("no leakage:", all(o["answer"] == NO_ANSWER and not o["sources"] for o in leaks))'''),
    ("md", "## Run the automated test-suite"),
    ("code", '''import subprocess
r = subprocess.run([sys.executable, "-m", "pytest", "-q", "tests"], cwd=ROOT, capture_output=True, text=True)
print(r.stdout[-600:])'''),
    ("md", "### Reading the results\nIn **OFFLINE** mode the LLM is a rule-based mock, so these numbers prove the *plumbing, security and fail-closed logic*. Set `NB_OFFLINE=0` (real providers) and re-run to measure real answer quality; correctness below ~0.9 on this easy set usually means a chunking, embedding-model or prompt issue worth investigating."),
])
print("built:", sorted(p.name for p in OUT.glob("*.ipynb")))
