"""Structure-aware chunking with LangChain's RecursiveCharacterTextSplitter.

Each chunk keeps provenance (document id, page, heading, chunk index) in metadata and gets a
stable id (doc_id:index) so re-ingesting the same document overwrites instead of duplicating.
"""
from __future__ import annotations

from typing import Dict, List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings
from app.parsers import Section


def chunk_sections(sections: List[Section], doc_id: str, base_meta: Dict) -> List[Document]:
    s = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=s.chunk_size,
        chunk_overlap=s.chunk_overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
        length_function=len,
    )
    docs: List[Document] = []
    idx = 0
    for sec in sections:
        for piece in splitter.split_text(sec.text):
            piece = piece.strip()
            if len(piece) < 25:  # drop noise fragments
                continue
            meta = dict(base_meta)
            meta.update(
                {
                    "document_id": doc_id,
                    "chunk_index": idx,
                    "page": sec.page,
                    "heading": sec.heading or "",
                    "chunk_id": f"{doc_id}:{idx}",
                }
            )
            # Prefix heading so the embedding captures section context
            content = f"{sec.heading}\n{piece}" if sec.heading and not piece.startswith(sec.heading) else piece
            docs.append(Document(page_content=content, metadata=meta))
            idx += 1
    return docs
