"""
Automated Integration Tests for University Agentic RAG Platform.
Run via: pytest rag_service/tests/ or python -m unittest
"""

import unittest
import sys
import os

# Add rag_service to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import get_settings
from app.core.security import build_security_filter
from app.tools.calculator import calculate
from app.tools.python_executor import execute_sandboxed_python
from app.retrieval.bm25 import BM25Retriever
from app.evaluation.metrics import calculate_multi_signal_confidence
from app.agents.prompts import MODE_PROMPTS


class TestAgenticRAG(unittest.TestCase):
    def test_settings(self):
        settings = get_settings()
        self.assertEqual(settings.primary_llm_provider, "gemini")
        self.assertTrue(settings.service_port > 0)

    def test_security_filter(self):
        filter_dict = build_security_filter(
            role="student",
            user_id="s123",
            university_id="u1",
            department_id="ce",
            semester=5,
            course_ids=["c301"],
            subject_ids=["sub_os"],
        )
        self.assertEqual(filter_dict["subject_id"], "sub_os")
        self.assertEqual(filter_dict["department_id"], "ce")
        self.assertEqual(filter_dict["semester"], 5)

    def test_calculator(self):
        res = calculate("2 ** 8 + 10")
        self.assertEqual(res, "266")

    def test_python_executor(self):
        res = execute_sandboxed_python("print('hello' * 2)")
        self.assertTrue(res["success"])
        self.assertEqual(res["output"], "hellohello")

    def test_python_forbidden_module(self):
        res = execute_sandboxed_python("import os\nos.listdir('.')")
        self.assertFalse(res["success"])
        self.assertIn("Security restriction", res["error"])

    def test_bm25_retrieval(self):
        bm25 = BM25Retriever()
        bm25.add_documents([
            {"id": "doc1", "text": "Operating Systems deadlock prevention banker algorithm", "metadata": {"subject_id": "os"}},
            {"id": "doc2", "text": "Database normalization third normal form BCNF", "metadata": {"subject_id": "dbms"}},
        ])
        results = bm25.query("deadlock banker", top_k=1, where_filter={"subject_id": "os"})
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "doc1")

    def test_confidence_scoring(self):
        docs = [{"score": 0.9, "rerank_score": 0.88, "metadata": {"document_id": "d1"}}]
        conf = calculate_multi_signal_confidence(
            retrieved_docs=docs,
            evidence_score=0.9,
            grounding_score=0.95,
        )
        self.assertGreaterEqual(conf, 0.7)
        self.assertLessEqual(conf, 1.0)

    def test_modes_prompts(self):
        modes = ["ask_tutor", "explain", "summarize", "exam_prep", "quiz_me", "compare", "solve", "code_help"]
        for m in modes:
            self.assertIn(m, MODE_PROMPTS)


if __name__ == "__main__":
    unittest.main()
