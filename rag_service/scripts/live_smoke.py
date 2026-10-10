"""End-to-end test with REAL providers on YOUR machine:  python scripts/live_smoke.py
Ingests the synthetic files under subject codes ZZSMOKE_*, asks questions, checks answers,
then deletes everything it created (only touches docs whose id starts with 'smoke-')."""
import os, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "sample_data"))


def main():
    os.environ["RAG_OFFLINE"] = "0"
    import synthetic
    from app.agent import ask, NO_ANSWER, OFFTOPIC
    from app.ingest import ingest_document
    from app.store import get_store
    PFX = "ZZSMOKE_"
    ids, fails = [], []
    t0 = time.time()
    try:
        for subj, files in synthetic.make_all().items():
            for name, data in files.items():
                did = f"smoke-{subj}-{name}"; ids.append(did)
                r = ingest_document(did, {"subject": PFX + subj, "is_active": True}, data=data, file_name=name)
                print(f"ingested {name:22s} -> {r['chunkCount']} chunks ({r['durationMs']} ms)")
        print()
        for subj, q, kw, _ in synthetic.QA:
            o = ask(q, subject_codes=[PFX + subj])
            good = kw.lower() in o["answer"].lower() and o["grounded"] and o["sources"]
            print(("PASS" if good else "FAIL"), f"| conf={o['confidence']:.2f} | {o['latency_ms']:>5}ms | {q}")
            if not good: fails.append(q); print("      got:", o["answer"][:160].replace("\n", " "))
        for subj, q in synthetic.UNANSWERABLE:
            o = ask(q, subject_codes=[PFX + subj]); good = o["answer"] in {NO_ANSWER, OFFTOPIC}
            print(("PASS" if good else "FAIL"), "| refuses unanswerable:", q)
            if not good: fails.append(q)
        for subj, q, _ in synthetic.LEAKAGE:
            o = ask(q, subject_codes=[PFX + subj]); good = o["answer"] == NO_ANSWER and not o["sources"]
            print(("PASS" if good else "FAIL"), "| no cross-subject leak:", q)
            if not good: fails.append(q)
    finally:
        st = get_store()
        for d in ids: st.delete_document(d)
        print(f"\ncleaned up {len(ids)} smoke documents")
    print(f"{'ALL PASSED' if not fails else str(len(fails)) + ' FAILED'} in {time.time()-t0:.0f}s")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
