import os
import shutil
import sys
import tempfile
from pathlib import Path

# MUST be set before app modules read settings: offline = no API calls, local temp Chroma only
os.environ["RAG_OFFLINE"] = "1"
os.environ["INTERNAL_SERVICE_TOKEN"] = "test-token"
_tmp = tempfile.mkdtemp(prefix="rag_test_chroma_")
os.environ["CHROMA_LOCAL_DIR"] = _tmp
os.environ.setdefault("MIN_RELEVANCE", "0.15")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "sample_data"))

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    shutil.rmtree(_tmp, ignore_errors=True)


@pytest.fixture(scope="session")
def corpus():
    """Ingest the full synthetic corpus once for the whole session."""
    import synthetic
    from app.ingest import ingest_document

    ids = {}
    for subj, files in synthetic.make_all().items():
        for name, data in files.items():
            did = f"{subj}-{name}"
            ingest_document(did, {"subject": subj, "is_active": True}, data=data, file_name=name)
            ids[did] = subj
    return ids
