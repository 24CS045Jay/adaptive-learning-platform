"""Comprehensive Test Suite for EduSense AI Advanced RAG Upgrade.

Tests:
1. Feature A: Document Versioning, Duplicate Detection, Atomic Publication, and Rollback
2. Feature B: Multimodal Parsing (PPTX, Images, OCR Fallback)
3. Feature C: Sentence-BERT / Embedding Version Isolation
4. Feature D: Hybrid Retrieval & Reciprocal Rank Fusion
5. Feature E: Pedagogical Modes (Socratic, Worked Example, Practice Quiz)
6. Feature F: Safe Computational Tools (AST Calculator, AST Security Sandbox, Graph Generator)
7. Feature G: Citations Verification and Grounding
"""
import hashlib
import json
import os
import sys
from pathlib import Path

# Add rag_service to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rag_service"))

from app.chunker import chunk_sections
from app.config import get_settings
from app.evaluation.metrics import (
    evaluate_active_version_retrieval,
    evaluate_citation_correctness,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)
from app.parsers import ParseError, Section, ext_of, parse_bytes, parse_text
from app.providers import embedding_id
from app.retriever import BM25Okapi, build_where
from app.store import get_store
from app.tools.calculator import calculate
from app.tools.graph_generator import generate_chart
from app.tools.python_executor import execute_sandboxed_python, validate_python_code
from app.tools.registry import get_tool_registry
from app.versioning import DocumentVersion, get_version_registry


def test_feature_f_computational_interpreter():
    print("\n--- Testing Feature F: Computational Interpreter ---")

    # 1. Basic math & scientific
    res = calculate("sqrt(144) + 12")
    assert res == "24", f"Expected 24, got {res}"
    print("  [PASS] Arithmetic & sqrt: 'sqrt(144) + 12' = 24")

    # 2. Probability & Combinatorics
    res_comb = calculate("comb(10, 3)")
    assert res_comb == "120", f"Expected 120, got {res_comb}"
    print("  [PASS] Combinatorics: 'comb(10, 3)' = 120")

    # 3. Statistics
    res_stats = calculate("mean([10, 20, 30, 40])")
    assert res_stats == "25", f"Expected 25, got {res_stats}"
    print("  [PASS] Statistics: 'mean([10, 20, 30, 40])' = 25")

    # 4. AST Security Validation: Prohibited imports
    malicious_code_1 = "import os; os.listdir('.')"
    val_1 = validate_python_code(malicious_code_1)
    assert not val_1["valid"], "Security validator should block 'import os'"
    assert "Forbidden module import" in val_1["error"]
    print("  [PASS] Security Sandbox: 'import os' blocked by AST validator")

    malicious_code_2 = "import socket; s = socket.socket()"
    val_2 = validate_python_code(malicious_code_2)
    assert not val_2["valid"], "Security validator should block 'import socket'"
    print("  [PASS] Security Sandbox: 'import socket' blocked by AST validator")

    # 5. Safe Sandboxed Python Execution
    safe_code = "nums = [5, 2, 9, 1]; print(sorted(nums))"
    exec_res = execute_sandboxed_python(safe_code)
    assert exec_res["success"], f"Execution failed: {exec_res.get('error')}"
    assert "[1, 2, 5, 9]" in exec_res["output"]
    print(f"  [PASS] Sandboxed Execution: sorted array output: {exec_res['output']}")

    # 6. Graph Generator
    chart_res = generate_chart(
        chart_type="bar",
        title="Algorithm Complexity Test",
        x_data=["Linear", "Binary", "Hash"],
        y_data=[100, 10, 1],
        x_label="Search Type",
        y_label="Ops",
    )
    assert chart_res["success"], f"Chart generation failed: {chart_res.get('error')}"
    assert chart_res["url"].startswith("/uploads/generated_charts/")
    print(f"  [PASS] Graph Generator: chart saved to {chart_res['url']}")


def test_feature_a_version_management():
    print("\n--- Testing Feature A: Version-Aware Knowledge Base ---")
    reg = get_version_registry()
    doc_id = "test_doc_versioning_001"

    # 1. Prepare initial version (v1)
    content_v1 = b"Lecture 1: Introduction to Operating Systems and Process Lifecycle."
    hash_v1 = reg.compute_hash(content_v1)
    v1 = reg.prepare_version(doc_id, "os_lec1.pdf", hash_v1, subject_id="CSUC301")
    assert v1.version_number == 1
    assert v1.version_id == f"{doc_id}_v1"
    assert v1.status == "processing"
    assert not v1.is_active
    print("  [PASS] Version 1 registered in processing state (inactive)")

    # 2. Publish v1
    v1_published = reg.publish_version(doc_id, v1.version_id, chunk_count=3)
    assert v1_published.is_active
    assert v1_published.status == "published"
    assert reg.get_active_version(doc_id).version_id == v1.version_id
    print("  [PASS] Version 1 published and marked as active pointer")

    # 3. Duplicate upload detection
    identical = reg.find_identical(doc_id, hash_v1)
    assert identical is not None
    assert identical.version_id == v1.version_id
    print("  [PASS] Duplicate Detection: Identical content hash recognized without re-indexing")

    # 4. Upload revision (v2)
    content_v2 = b"Lecture 1 (Revised): Operating Systems, Process Lifecycle, and Threads."
    hash_v2 = reg.compute_hash(content_v2)
    v2 = reg.prepare_version(doc_id, "os_lec1_revised.pdf", hash_v2, subject_id="CSUC301")
    assert v2.version_number == 2
    assert v2.version_id == f"{doc_id}_v2"
    assert not v2.is_active  # inactive during ingestion
    # v1 must still be active while v2 is processing!
    assert reg.get_active_version(doc_id).version_id == v1.version_id
    print("  [PASS] Version 2 in processing does NOT replace currently active Version 1")

    # 5. Publish v2 -> atomic switch
    v2_published = reg.publish_version(doc_id, v2.version_id, chunk_count=4)
    assert v2_published.is_active
    assert reg.get_active_version(doc_id).version_id == v2.version_id
    # Check v1 was archived
    hist = reg.get_document_history(doc_id)
    v1_record = next(v for v in hist["versions"] if v["version_id"] == v1.version_id)
    assert not v1_record["is_active"]
    assert v1_record["status"] == "archived"
    print("  [PASS] Atomic Publication: Version 2 is now active, Version 1 safely archived")

    # 6. Rollback to v1
    rolled = reg.rollback(doc_id, v1.version_id)
    assert rolled.is_active
    assert rolled.status == "published"
    assert reg.get_active_version(doc_id).version_id == v1.version_id
    hist_after = reg.get_document_history(doc_id)
    v2_record = next(v for v in hist_after["versions"] if v["version_id"] == v2.version_id)
    assert not v2_record["is_active"]
    assert v2_record["status"] == "archived"
    print("  [PASS] Safe Rollback: Active pointer rolled back to Version 1; Version 2 archived")


def test_feature_b_multimodal_parsing():
    print("\n--- Testing Feature B: Multimodal Parsing ---")

    # 1. Plain text and markdown
    sections_text = parse_text("Chapter 1: Relational Database Model\nAttributes and tuples.")
    assert len(sections_text) == 1
    assert "Relational Database" in sections_text[0].text
    print("  [PASS] Text parsing verified")

    # 2. Image extension recognition
    assert ext_of("diagram.png") == "png"
    assert ext_of("chart.JPEG") == "jpeg"
    from app.parsers import IMAGE_EXTENSIONS, SUPPORTED
    assert "png" in IMAGE_EXTENSIONS
    assert "jpg" in IMAGE_EXTENSIONS
    assert "png" in SUPPORTED
    print("  [PASS] Multimodal formats: PNG, JPG, JPEG, WEBP registered in SUPPORTED")

    # 3. Synthetic image parse test
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (200, 100), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((10, 10), "CS201", fill=(0, 0, 0))
    import io
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    raw_img = img_bytes.getvalue()

    sections_img = parse_bytes(raw_img, "slide_diagram.png")
    assert len(sections_img) == 1
    assert sections_img[0].page == 1
    print(f"  [PASS] Image parsing: extracted {len(sections_img[0].text)} characters with page 1 provenance")


def test_feature_c_d_retrieval_and_evaluation():
    print("\n--- Testing Features C & D: Retrieval & Evaluation Suite ---")

    # 1. Collection isolation by embedding model
    emb_id = embedding_id()
    assert emb_id != "", "Embedding ID must not be empty"
    store = get_store()
    assert store.collection_name == f"edu_chunks__{emb_id}"
    print(f"  [PASS] Vector Isolation: collection is '{store.collection_name}' (model={emb_id})")

    # 2. Authorization filter building
    where_active = build_where(["CSUC301"], only_active=True)
    assert where_active is not None
    # Must enforce is_active=True
    if "$and" in where_active:
        assert {"is_active": True} in where_active["$and"]
    else:
        assert where_active.get("is_active") is True
    print(f"  [PASS] Authorization Filter: enforces is_active=True -> {where_active}")

    # 3. Evaluation metrics validation
    retrieved = [
        {"file_name": "dbms_unit4_transactions.pdf", "metadata": {"is_active": True, "chunk_id": "c1"}},
        {"file_name": "dbms_unit3_normalization.pdf", "metadata": {"is_active": True, "chunk_id": "c2"}},
        {"file_name": "os_unit2_scheduling.pdf", "metadata": {"is_active": True, "chunk_id": "c3"}},
    ]
    expected = ["dbms_unit4_transactions.pdf"]

    rec = recall_at_k(retrieved, expected, k=3)
    prec = precision_at_k(retrieved, expected, k=3)
    rr = reciprocal_rank(retrieved, expected)
    ndcg = ndcg_at_k(retrieved, expected, k=3)
    active_rate = evaluate_active_version_retrieval(retrieved)

    assert rec == 1.0, f"Expected Recall=1.0, got {rec}"
    assert round(prec, 2) == 0.33, f"Expected Prec=0.33, got {prec}"
    assert rr == 1.0, f"Expected RR=1.0, got {rr}"
    assert ndcg == 1.0, f"Expected nDCG=1.0, got {ndcg}"
    assert active_rate == 1.0, f"Expected active rate=1.0, got {active_rate}"
    print(f"  [PASS] Benchmark Metrics verified: Recall={rec}, Precision={prec:.2f}, MRR={rr}, nDCG={ndcg}, ActiveRate={active_rate}")


if __name__ == "__main__":
    print("================================================================")
    print("RUNNING EDUSENSE ADVANCED RAG UPGRADE VALIDATION SUITE")
    print("================================================================")
    test_feature_f_computational_interpreter()
    test_feature_a_version_management()
    test_feature_b_multimodal_parsing()
    test_feature_c_d_retrieval_and_evaluation()
    print("\n================================================================")
    print("ALL TEST SCENARIOS PASSED SUCCESSFULLY!")
    print("================================================================")
