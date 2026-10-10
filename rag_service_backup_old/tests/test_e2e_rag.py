"""
End-to-End Acceptance Tests for University Agentic RAG Platform.
Validates the complete Level 12 Final Acceptance Gate.
"""

import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import get_settings
from app.embeddings.manager import get_embedding_manager
from app.ingestion.pipeline import (
    ingest_text,
    verify_document_index,
    reindex_document,
)
from app.retrieval.dense import get_dense_retriever
from app.retrieval.reranker import get_reranker
from app.vectorstore.chroma import get_unified_collection, delete_document_chunks


class TestE2ECompleteRAG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.settings = get_settings()
        cls.collection = get_unified_collection()
        cls.doc_id = "DOC_ACCEPTANCE_TEST_42"
        # Ensure clean state
        delete_document_chunks(cls.collection, cls.doc_id)

    @classmethod
    def tearDownClass(cls):
        delete_document_chunks(cls.collection, cls.doc_id)

    def test_01_canonical_collection_name(self):
        self.assertEqual(self.collection.name, self.settings.CANONICAL_COLLECTION)
        self.assertEqual(self.settings.CANONICAL_COLLECTION, "rag_unified_v1")

    def test_02_embedding_dimension_invariant(self):
        embed_mgr = get_embedding_manager()
        text = "Operating Systems process management and thread synchronization."
        vec = embed_mgr.embed_query(text)
        self.assertEqual(len(vec), embed_mgr.dimension)
        # Invariant assertion
        embed_mgr.validate_vector(vec)

    def test_03_ingest_and_sync_verification(self):
        text = (
            "Section 1: Operating System Deadlocks\n"
            "A deadlock occurs when a set of blocked processes each holds a resource and waits for another.\n"
            "The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait."
        )
        # Test ingestion
        res = asyncio.run(
            ingest_text(
                text=text,
                document_id=self.doc_id,
                subject_id="SUB_OS_101",
                document_version=1,
            )
        )
        self.assertEqual(res.status, "completed")
        self.assertGreater(res.chunk_count, 0)
        self.assertIn("content_hash", res.metadata)

        # Verification contract: chunks == vectors == BM25
        verification = verify_document_index(self.doc_id)
        self.assertTrue(verification["is_synced"])
        self.assertEqual(verification["status"], "VERIFIED")
        self.assertEqual(verification["chroma_vectors"], verification["bm25_records"])

    def test_04_duplicate_detection(self):
        # Ingest exact same document bytes again
        text = (
            "Section 1: Operating System Deadlocks\n"
            "A deadlock occurs when a set of blocked processes each holds a resource and waits for another.\n"
            "The four Coffman conditions are mutual exclusion, hold and wait, no preemption, and circular wait."
        )
        res_dup = asyncio.run(
            ingest_text(
                text=text,
                document_id=self.doc_id,
                subject_id="SUB_OS_101",
                document_version=1,
            )
        )
        self.assertEqual(res_dup.status, "completed")
        self.assertTrue(res_dup.metadata.get("duplicate_skipped"))

    def test_05_dense_retrieval_score_formula(self):
        dense = get_dense_retriever()
        results = dense.query("Coffman conditions mutual exclusion", top_k=2)
        self.assertGreater(len(results), 0)
        top = results[0]
        # Must be in [0, 1] range
        self.assertGreaterEqual(top["score"], 0.0)
        self.assertLessEqual(top["score"], 1.0)

    def test_06_reranker_sigmoid_calibration(self):
        reranker = get_reranker()
        docs = [
            {"id": "c1", "text": "Coffman conditions include mutual exclusion and circular wait", "score": 0.8},
            {"id": "c2", "text": "Photosynthesis is the process used by plants", "score": 0.2},
        ]
        ranked = reranker.rerank("deadlock conditions", docs, top_n=2)
        self.assertEqual(len(ranked), 2)
        # Rerank score must be strictly in [0, 1]
        self.assertGreaterEqual(ranked[0]["rerank_score"], 0.0)
        self.assertLessEqual(ranked[0]["rerank_score"], 1.0)
        self.assertGreater(ranked[0]["rerank_score"], ranked[1]["rerank_score"])

    def test_07_document_update_lifecycle(self):
        # Update document to version 2 with changed text
        new_text = "Section 1: Modern Microkernel OS Architecture.\nMicrokernels keep only IPC and memory in kernel space."
        res_v2 = asyncio.run(
            ingest_text(
                text=new_text,
                document_id=self.doc_id,
                subject_id="SUB_OS_101",
                document_version=2,
            )
        )
        self.assertEqual(res_v2.status, "completed")

        # Verify new knowledge indexed and synced
        verification = verify_document_index(self.doc_id)
        self.assertTrue(verification["is_synced"])
        self.assertEqual(verification["status"], "VERIFIED")

    def test_08_reindex_pipeline(self):
        res = asyncio.run(reindex_document(self.doc_id))
        self.assertEqual(res["status"], "completed")
        self.assertTrue(res["verification"]["is_synced"])

    def test_09_document_deletion_sync(self):
        delete_document_chunks(self.collection, self.doc_id)
        # From BM25 as well
        from app.retrieval.bm25 import get_bm25_retriever
        bm25 = get_bm25_retriever()
        for k in list(bm25.documents.keys()):
            if k.startswith(f"{self.doc_id}_"):
                bm25.remove_document(k)

        verification = verify_document_index(self.doc_id)
        self.assertEqual(verification["chroma_vectors"], 0)
        self.assertEqual(verification["bm25_records"], 0)
        self.assertEqual(verification["status"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
