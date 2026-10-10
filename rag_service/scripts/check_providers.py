"""Run on YOUR machine with real keys:  python scripts/check_providers.py
Verifies every external dependency one by one and tells you exactly what to fix.
Never prints secret values. Uses a throw-away probe record in Chroma (deleted afterwards)."""
import os, sys, traceback
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["RAG_OFFLINE"] = "0"
from app.config import get_settings  # noqa: E402

S = get_settings()
ok_all = True


def step(name, fn):
    global ok_all
    try:
        print(f"[ .. ] {name}", end="\r"); r = fn(); print(f"[ OK ] {name}: {r}")
    except Exception as e:
        ok_all = False
        print(f"[FAIL] {name}: {type(e).__name__}: {str(e)[:300]}")
        if os.getenv("VERBOSE"): traceback.print_exc()


print("== Configuration ==")
for k, v in [("GEMINI_API_KEY", S.gemini_key), ("GROQ_API_KEY", S.groq_key), ("OPENAI_API_KEY", S.openai_key),
             ("CHROMA_API_KEY", S.chroma_api_key), ("CHROMA_TENANT", S.chroma_tenant), ("CHROMA_DATABASE", S.chroma_database),
             ("INTERNAL_SERVICE_TOKEN", S.internal_token)]:
    print(f"  {k:24s} {'set' if v else 'MISSING'}")
print(f"  embedding provider       {S.embedding_provider}   | vector store: {'Chroma Cloud' if S.use_chroma_cloud else 'LOCAL (cloud keys incomplete)'}")

print("\n== Embeddings ==")
from app.providers import get_embeddings, embedding_id, _build, llm_text  # noqa: E402
step(f"embed query ({embedding_id()})", lambda: f"dim={len(get_embeddings().embed_query('hello world'))}")

print("\n== LLMs (each configured provider, both tiers) ==")
for p in S.provider_order:
    for tier in ("light", "heavy"):
        def t(p=p, tier=tier):
            m = _build(p, tier)
            if m is None: return "skipped (no key)"
            model = getattr(m, "model", None) or getattr(m, "model_name", "?")
            return f"{model} -> {llm_text(m.invoke('Reply with exactly: pong')).strip()[:30]!r}"
        step(f"{p}/{tier}", t)

print("\n== Chroma ==")
from app.store import get_store  # noqa: E402
from langchain_core.documents import Document  # noqa: E402
def chroma():
    st = get_store()
    d = Document(page_content="probe record", metadata={"chunk_id": "__probe__:0", "document_id": "__probe__", "chunk_index": 0, "subject_code": "__PROBE__", "is_active": True})
    st.upsert([d]); got = st.chunks_of("__probe__"); st.delete_document("__probe__")
    return f"{st.mode}, collection={st.collection_name}, probe write/read/delete ok={len(got)==1}"
step("write/read/delete", chroma)

print("\nRESULT:", "ALL GOOD - you can start the service" if ok_all else "FIX THE [FAIL] LINES ABOVE, then re-run")
sys.exit(0 if ok_all else 1)
