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
    ("md", "# 00 · Setup & Provider Check\nRun this first. It verifies environment configuration, installed packages, API keys, embedding models, LLM tiers, and Chroma Cloud connectivity.\n\n**Pipeline map:**\n`00 setup` → `01 parse & chunk` → `02 embed & index` → `03 retrieve` → `04 augment & generate` → `05 agentic LangGraph` → `06 evaluation`"),
    ("code", INSTALL),
    ("code", SETUP),
    ("md", "## 1. Environment Key Validation (Values are never printed)"),
    ("code", '''for k in ["GEMINI_API_KEY","GROQ_API_KEY","OPENAI_API_KEY","CHROMA_API_KEY","CHROMA_TENANT","CHROMA_DATABASE","INTERNAL_SERVICE_TOKEN"]:
    print(f"{k:24s}", "SET" if os.getenv(k) else "-- missing --")'''),
    ("md", "## 2. Embedding Model Smoke Test"),
    ("code", '''from app.providers import get_embeddings, embedding_id
emb = get_embeddings()
v = emb.embed_query("What is photosynthesis?")
print("embedding id:", embedding_id(), "| dimension:", len(v))
assert len(v) > 100'''),
    ("md", "## 3. LLM Smoke Test (Light + Heavy Tiers)"),
    ("code", '''from app.providers import get_llm, llm_text
for tier in ("light", "heavy"):
    out = llm_text(get_llm(tier).invoke("Reply with the single word: pong"))
    print(tier, "->", out.strip()[:60])'''),
    ("md", "## 4. Vector Store Connectivity Probe"),
    ("code", '''from app.store import get_store
from langchain_core.documents import Document
st = get_store()
print("mode:", st.mode, "| collection:", st.collection_name, "| heartbeat:", st.heartbeat())
probe = Document(page_content="probe record for connectivity test", metadata={"chunk_id":"__probe__:0","document_id":"__probe__","chunk_index":0,"subject_code":"__PROBE__","is_active":True})
st.upsert([probe]); assert any(d.metadata["document_id"]=="__probe__" for d in st.chunks_of("__probe__"))
st.delete_document("__probe__"); print("probe write/read/delete OK; total chunks now:", st.count())'''),
])

nb("01_document_parsing_and_chunking.ipynb", [
    ("md", "# 01 · Document Parsing and Chunking\nDemonstrates file parsing for all supported academic file types (PDF, PPTX, DOCX, XLSX, CSV, MD, HTML) and structure-aware chunking with metadata preservation."),
    ("code", SETUP),
    ("md", "## 1. Create Synthetic Course Material"),
    ("code", '''import synthetic
files = synthetic.make_all()
for subj, fs in files.items():
    print(subj, {n: f"{len(b)//1024 or 1} KB" for n, b in fs.items()})'''),
    ("md", "## 2. Page & Structure Aware Parsing"),
    ("code", '''from app.parsers import parse_bytes
secs = parse_bytes(files["BIO101"]["bio_notes.pdf"], "bio_notes.pdf")
for s in secs: print(f"page {s.page}:", s.text[:110].replace("\\n"," "), "...")'''),
    ("md", "## 3. Structure-Aware Chunking (Provenance, Headings, Stable IDs)"),
    ("code", '''from app.chunker import chunk_sections
chunks = chunk_sections(secs, "demo-doc", {"subject_code":"BIO101","is_active":True,"file_name":"bio_notes.pdf"})
print(len(chunks), "chunks created | sizes:", [len(c.page_content) for c in chunks])
print("First chunk metadata:")
print(json.dumps(chunks[0].metadata, indent=2))'''),
])

nb("02_embedding_and_chroma_indexing.ipynb", [
    ("md", "# 02 · Embedding and Chroma Indexing\nCovers embedding creation, batch vector indexing in Chroma, idempotency, document active toggles, and vector deletion."),
    ("code", SETUP),
    ("md", "## 1. Generate Embeddings"),
    ("code", '''from app.providers import get_embeddings
import synthetic
from app.parsers import parse_bytes
from app.chunker import chunk_sections
files = synthetic.make_all()
secs = parse_bytes(files["BIO101"]["bio_notes.pdf"], "bio_notes.pdf")
chunks = chunk_sections(secs, "demo-doc", {"subject_code":"BIO101","is_active":True,"file_name":"bio_notes.pdf"})
vecs = get_embeddings().embed_documents([c.page_content for c in chunks])
print("Vectors generated:", len(vecs), "x", len(vecs[0]), "dimensions")'''),
    ("md", "## 2. Ingest the Complete Synthetic Corpus into Chroma"),
    ("code", '''from app.ingest import ingest_document, get_status
results = {}
for subj, fs in files.items():
    for name, data in fs.items():
        did = f"{subj}-{name}"
        results[did] = ingest_document(did, {"subject": subj, "is_active": True}, data=data, file_name=name)
import pandas as pd
pd.DataFrame(results).T[["chunkCount","durationMs","collection"]]'''),
    ("md", "## 3. Verify Vector Store Ingestion Status"),
    ("code", '''from app.store import get_store
st = get_store()
print("Total chunks in vector store:", st.count())
print("Ingestion status for BIO101-bio_notes.pdf:", get_status("BIO101-bio_notes.pdf"))'''),
    ("md", "## 4. Idempotent Ingestion & Deletion Testing"),
    ("code", '''n0 = len(st.chunks_of("PHY101-physics.docx"))
ingest_document("PHY101-physics.docx", {"subject":"PHY101","is_active":True}, data=files["PHY101"]["physics.docx"], file_name="physics.docx")
assert len(st.chunks_of("PHY101-physics.docx")) == n0, "Re-ingestion must be idempotent without duplicates"
print("Idempotency verified: chunk count is stable at", n0)'''),
])

nb("03_retrieval_pipeline.ipynb", [
    ("md", "# 03 · Retrieval Pipeline\nHybrid retrieval combining Dense (Chroma cosine similarity) and Sparse (BM25) with Reciprocal Rank Fusion (RRF) and subject authorization filtering."),
    ("code", SETUP),
    ("code", '''from app.retriever import HybridRetriever, build_where
from app.store import get_store
assert get_store().count() > 0, "Run notebook 02 first"
def show(q, subj, k=3):
    r = HybridRetriever(where=build_where([subj]), top_k=k)
    print(f"Q: {q}   [scope={subj}]")
    for d, s in r.search(q): print(f"  {s:.3f} | {d.metadata['file_name']:<22} p.{d.metadata['page']} | {d.page_content[:70]!r}")
    print("  trace:", r.last_trace, "\\n")
show("Which organelle produces ATP?", "BIO101")
show("When does total internal reflection occur?", "PHY101")'''),
    ("md", "## LangChain BaseRetriever Interface"),
    ("code", '''r = HybridRetriever(where=build_where(["CS201"]), top_k=2)
for d in r.invoke("What is third normal form?"): print(d.metadata["file_name"], "|", d.page_content[:80])'''),
    ("md", "## Strict Subject Authorization Isolation"),
    ("code", '''r = HybridRetriever(where=build_where(["PHY101"]), top_k=10)
hits = r.search("Which organelle produces ATP?")
print({d.metadata["subject_code"] for d, _ in hits})
assert all(d.metadata["subject_code"] == "PHY101" for d, _ in hits)'''),
    ("md", "## Retrieval Recall Evaluation (hit@3)"),
    ("code", '''import synthetic, pandas as pd
rows = []
for subj, q, kw, _ in synthetic.QA:
    top = HybridRetriever(where=build_where([subj]), top_k=3).search(q)
    rows.append({"subject": subj, "question": q, "hit@3": any(kw in d.page_content.lower() for d, _ in top)})
df = pd.DataFrame(rows); print("hit@3 =", df["hit@3"].mean()); df'''),
])

nb("04_augmentation_and_generation.ipynb", [
    ("md", "# 04 · Augmentation & Grounded Generation\nConstructs the structured context block from retrieved passages, executes grounded generation, verifies claims, and validates fail-closed behavior for unanswerable queries."),
    ("code", SETUP),
    ("code", '''from app.retriever import HybridRetriever, build_where
from app.agent import _ctx_block, NO_ANSWER
from app.providers import get_llm, llm_text
question = "Which organelle produces ATP and what kind of DNA does it have?"
hits = HybridRetriever(where=build_where(["BIO101"]), top_k=3).search(question)
relevant = [{"doc": d, "score": s} for d, s in hits]
print(_ctx_block(relevant)[:600], "...")'''),
    ("md", "## 1. Augmented Prompt Assembly"),
    ("code", '''prompt = ("TASK:ANSWER\\nYou are a university course tutor. Answer ONLY from the numbered context. Cite like [1]. "
          "If the context lacks the answer reply exactly INSUFFICIENT_CONTEXT.\\n"
          f"CONTEXT:\\n{_ctx_block(relevant)}\\nQUESTION: {question}\\n")
print(len(prompt), "chars assembled for LLM context")'''),
    ("md", "## 2. Heavy Tier LLM Generation"),
    ("code", '''answer = llm_text(get_llm("heavy").invoke(prompt)).strip()
print("Generated Answer:\\n", answer)'''),
    ("md", "## 3. Grounding & Citation Verification"),
    ("code", '''from app.agent import _json
v = _json(llm_text(get_llm("heavy").invoke(
    "TASK:VERIFY\\nReply ONLY JSON {\\"supported_ratio\\":0-1,\\"verdict\\":\\"grounded|ungrounded\\"}.\\n"
    f"ANSWER: {answer}\\nCONTEXT: {_ctx_block(relevant)}")))
print("Verification verdict:", v)'''),
    ("md", "## 4. Fail-Closed Abstention on Out-of-Scope Questions"),
    ("code", '''q2 = "Who won the football world cup in 1998?"
h2 = HybridRetriever(where=build_where(["BIO101"]), top_k=3).search(q2)
p2 = prompt.split("CONTEXT:")[0] + f"CONTEXT:\\n{_ctx_block([{'doc':d,'score':s} for d,s in h2])}\\nQUESTION: {q2}\\n"
print("Response for unanswerable query:", llm_text(get_llm("heavy").invoke(p2)).strip())'''),
])

nb("05_agentic_rag_langgraph.ipynb", [
    ("md", "# 05 · Agentic RAG with LangGraph\nExecutes the complete production LangGraph state machine: **route → rewrite → retrieve → grade → (refine loop) → generate → verify → finalize** with bounded retries and trace inspection."),
    ("code", SETUP),
    ("md", "## 1. LangGraph State Machine Diagram"),
    ("code", '''from app.agent import get_graph
print(get_graph().get_graph().draw_mermaid())'''),
    ("md", "## 2. Multi-turn Agent Execution"),
    ("code", '''from app.agent import ask
from app.store import get_store
assert get_store().count() > 0, "Run notebook 02 first"
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
run("Who won the football world cup in 1998?")'''),
    ("md", "## 3. History-Aware Context Rewriting without Drift"),
    ("code", '''h = [{"role":"user","content":"What is DNA replication?"},{"role":"assistant","content":"It copies DNA before cell division."}]
o = run("Which enzyme does it use?", history=h)
print("Rewritten query:", o["standalone_question"])'''),
    ("md", "## 4. Execution Trace Breakdown"),
    ("code", '''import pandas as pd
pd.DataFrame(ask("Which enzyme adds nucleotides during DNA replication?", subject_codes=["BIO101"])["agent_trace"]).drop(columns="t")'''),
])

nb("06_evaluation_and_regression_tests.ipynb", [
    ("md", "# 06 · Evaluation & Regression Tests\nAutomated evaluation over the synthetic academic benchmark, testing answer correctness, grounding, citation accuracy, abstention rates, and running the full pytest suite."),
    ("code", SETUP),
    ("md", "## 1. Benchmark Evaluation on Synthetic QA Set"),
    ("code", '''import synthetic, pandas as pd
from app.agent import ask, NO_ANSWER
from app.store import get_store
assert get_store().count() > 0, "Run notebook 02 first"
rows = []
for subj, q, kw, src in synthetic.QA:
    o = ask(q, subject_codes=[subj])
    rows.append(dict(subject=subj, question=q, correct=kw in o["answer"].lower(), grounded=o["grounded"],
                     cited=bool(o["sources"]), conf=o["confidence"], ms=o["latency_ms"]))
ans = pd.DataFrame(rows); ans'''),
    ("code", '''print("Answer Correctness :", round(ans.correct.mean(), 3))
print("Groundedness       :", round(ans.grounded.mean(), 3))
print("Citation Presence  :", round(ans.cited.mean(), 3))
print("Mean Confidence    :", round(ans.conf.mean(), 3), "| Mean Latency ms:", int(ans.ms.mean()))'''),
    ("md", "## 2. Unanswerable Query Abstention Rate"),
    ("code", '''un = [ask(q, subject_codes=[s]) for s, q in synthetic.UNANSWERABLE]
print("Abstained correctly:", sum(o["answer"] == NO_ANSWER for o in un), "/", len(un))'''),
    ("md", "## 3. Cross-Subject Leakage Probes"),
    ("code", '''leaks = [ask(q, subject_codes=[s]) for s, q, _ in synthetic.LEAKAGE]
print("Zero leakage verified:", all(o["answer"] == NO_ANSWER and not o["sources"] for o in leaks))'''),
    ("md", "## 4. Run Pytest Regression Suite"),
    ("code", '''import subprocess
r = subprocess.run([sys.executable, "-m", "pytest", "-q", "tests"], cwd=ROOT, capture_output=True, text=True)
print(r.stdout[-600:])'''),
])
print("built:", sorted(p.name for p in OUT.glob("*.ipynb")))
