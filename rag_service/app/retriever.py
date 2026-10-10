"""Hybrid RAG retriever (LangChain BaseRetriever).

dense (Chroma cosine) + sparse (BM25) -> Reciprocal Rank Fusion -> light rerank
(fused score + dense score + query-term coverage). Every call applies an *authorization
filter* (active documents + subject / department scope) so a student can never retrieve
chunks from material they are not allowed to see.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from pydantic import Field
import math
from collections import Counter

from app.config import get_settings
from app.providers import tokenize
from app.store import ChromaStore, get_store

log = logging.getLogger("rag.retriever")

RRF_K = 60


def build_where(
    subject_codes: Optional[List[str]] = None,
    department_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
    only_active: bool = True,
    subject_ids: Optional[List[str]] = None,
) -> Optional[dict]:
    conds: List[dict] = []
    if only_active:
        conds.append({"is_active": True})
    valid_codes = [c for c in (subject_codes or []) if c and str(c).strip().upper() != "GENERAL"]
    if valid_codes:
        conds.append({"subject_code": {"$in": valid_codes}} if len(valid_codes) > 1 else {"subject_code": valid_codes[0]})
    if subject_ids:
        conds.append({"subject_id": {"$in": subject_ids}} if len(subject_ids) > 1 else {"subject_id": subject_ids[0]})
    if department_id:
        conds.append({"department_id": department_id})
    if document_ids:
        conds.append({"document_id": {"$in": document_ids}})
    if not conds:
        return None
    return conds[0] if len(conds) == 1 else {"$and": conds}


class BM25Okapi:
    """Minimal BM25 (Lucene-style IDF, always positive => works on tiny corpora)."""

    def __init__(self, corpus: List[List[str]], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tf = [Counter(d) for d in corpus]
        self.dl = [len(d) for d in corpus]
        self.avg = (sum(self.dl) / len(self.dl)) if corpus else 0.0
        df: Counter = Counter()
        for d in corpus:
            df.update(set(d))
        n = len(corpus)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def get_scores(self, query: List[str]) -> List[float]:
        out = []
        for tf, dl in zip(self.tf, self.dl):
            sc = 0.0
            for t in query:
                f = tf.get(t, 0)
                if not f:
                    continue
                sc += self.idf.get(t, 0.0) * f * (self.k1 + 1) / (
                    f + self.k1 * (1 - self.b + self.b * dl / (self.avg or 1.0))
                )
            out.append(sc)
        return out


class _BM25Cache:
    """BM25 index per filter, rebuilt automatically when the store changes."""

    def __init__(self) -> None:
        self._c: Dict[str, Tuple[int, List[Document], BM25Okapi]] = {}

    def get(self, store: ChromaStore, where: Optional[dict]) -> Tuple[List[Document], Optional[BM25Okapi]]:
        key = repr(where)
        hit = self._c.get(key)
        if hit and hit[0] == store.version:
            return hit[1], hit[2]
        docs = store.fetch(where)
        if not docs:
            self._c[key] = (store.version, [], None)  # type: ignore[assignment]
            return [], None
        bm = BM25Okapi([tokenize(d.page_content) or ["_"] for d in docs])
        self._c[key] = (store.version, docs, bm)
        return docs, bm


_bm25 = _BM25Cache()


class HybridRetriever(BaseRetriever):
    where: Optional[dict] = None
    dense_k: int = Field(default_factory=lambda: get_settings().dense_k)
    sparse_k: int = Field(default_factory=lambda: get_settings().sparse_k)
    top_k: int = Field(default_factory=lambda: get_settings().final_k)
    last_trace: Dict[str, Any] = Field(default_factory=dict)

    def _get_relevant_documents(self, query: str, *, run_manager: CallbackManagerForRetrieverRun) -> List[Document]:
        return [d for d, _ in self.search(query)]

    # richer API that also returns scores
    def search(self, query: str, top_k: Optional[int] = None) -> List[Tuple[Document, float]]:
        store = get_store()
        k = top_k or self.top_k
        dense = store.dense_search(query, self.dense_k, self.where)
        dense_sim = {d.metadata["chunk_id"]: s for d, s in dense}

        corpus, bm = _bm25.get(store, self.where)
        sparse: List[Tuple[Document, float]] = []
        qt = tokenize(query)
        if bm is not None and qt:
            scores = bm.get_scores(qt)
            order = sorted(range(len(corpus)), key=lambda i: scores[i], reverse=True)[: self.sparse_k]
            sparse = [(corpus[i], float(scores[i])) for i in order if scores[i] > 0]

        fused: Dict[str, float] = {}
        docs: Dict[str, Document] = {}
        for rank, (d, _) in enumerate(dense):
            cid = d.metadata["chunk_id"]
            fused[cid] = fused.get(cid, 0) + 1.0 / (RRF_K + rank + 1)
            docs[cid] = d
        for rank, (d, _) in enumerate(sparse):
            cid = d.metadata["chunk_id"]
            fused[cid] = fused.get(cid, 0) + 1.0 / (RRF_K + rank + 1)
            docs[cid] = d

        qset = set(qt)
        max_rrf = max(fused.values()) if fused else 1.0
        ranked: List[Tuple[Document, float]] = []
        for cid, f in fused.items():
            cov = len(qset & set(tokenize(docs[cid].page_content))) / (len(qset) or 1)
            sim = dense_sim.get(cid, 0.0)
            score = 0.45 * (f / max_rrf) + 0.35 * sim + 0.20 * cov
            ranked.append((docs[cid], round(score, 4)))
        ranked.sort(key=lambda x: x[1], reverse=True)
        out = ranked[:k]

        self.last_trace = {
            "dense_hits": len(dense),
            "sparse_hits": len(sparse),
            "fused_candidates": len(fused),
            "returned": len(out),
            "top_score": out[0][1] if out else 0.0,
        }
        return out
