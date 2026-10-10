"""
Structure-aware document chunker.

Uses LangChain's text splitters with custom enhancements for:
- Heading-aware splitting
- Table preservation
- Code block preservation
- Configurable chunk sizes
- Overlap management
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from app.core.config import get_settings
from app.ingestion.parsers import ParsedDocument, ParsedSection

logger = logging.getLogger("rag_service.ingestion.chunker")


@dataclass
class DocumentChunk:
    """A single chunk of a document with its metadata."""
    chunk_id: str = ""
    text: str = ""
    chunk_index: int = 0
    metadata: dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


def _create_splitter(chunk_size: int, chunk_overlap: int) -> RecursiveCharacterTextSplitter:
    """Create a LangChain RecursiveCharacterTextSplitter configured for
    academic content."""
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=[
            "\n\n\n",     # Multiple blank lines (major section break)
            "\n\n",       # Paragraph boundary
            "\n",         # Line break
            ". ",         # Sentence end
            "? ",         # Question end
            "! ",         # Exclamation end
            "; ",         # Semicolon
            ", ",         # Comma
            " ",          # Word boundary
            "",           # Character boundary (last resort)
        ],
        length_function=len,
        is_separator_regex=False,
    )


def chunk_document(
    parsed_doc: ParsedDocument,
    document_id: str,
    extra_metadata: dict[str, Any] | None = None,
) -> list[DocumentChunk]:
    """
    Chunk a parsed document using structure-aware splitting.

    Strategy:
    1. If the document has sections with headings, chunk each section
       independently to preserve heading context.
    2. For sections without clear structure, use RecursiveCharacterTextSplitter.
    3. Preserve table content as individual chunks.
    4. Each chunk gets rich metadata for retrieval filtering and citation.
    """
    settings = get_settings()
    chunk_size = settings.CHUNK_SIZE
    chunk_overlap = settings.CHUNK_OVERLAP
    min_chunk = settings.MIN_CHUNK_SIZE

    splitter = _create_splitter(chunk_size, chunk_overlap)
    chunks: list[DocumentChunk] = []
    chunk_index = 0
    base_meta = extra_metadata or {}

    if parsed_doc.sections:
        # Structure-aware: chunk each section independently
        for section in parsed_doc.sections:
            section_text = ""
            if section.heading:
                section_text = f"{section.heading}\n\n"
            section_text += section.content

            if not section_text.strip():
                continue

            if len(section_text) <= chunk_size:
                # Section fits in one chunk — keep it intact
                if len(section_text.strip()) >= min_chunk:
                    chunks.append(DocumentChunk(
                        chunk_id=f"{document_id}_chunk_{chunk_index}",
                        text=section_text.strip(),
                        chunk_index=chunk_index,
                        metadata={
                            **base_meta,
                            "document_id": document_id,
                            "file_name": parsed_doc.file_name,
                            "chapter": section.heading if section.level <= 1 else "",
                            "section": section.heading if section.level >= 2 else "",
                            "page": str(section.page) if section.page else "",
                            "chunk_index": str(chunk_index),
                            "content_type": section.content_type,
                        },
                    ))
                    chunk_index += 1
            else:
                # Split long section
                sub_chunks = splitter.split_text(section_text)
                for sub_text in sub_chunks:
                    if len(sub_text.strip()) < min_chunk:
                        continue
                    chunks.append(DocumentChunk(
                        chunk_id=f"{document_id}_chunk_{chunk_index}",
                        text=sub_text.strip(),
                        chunk_index=chunk_index,
                        metadata={
                            **base_meta,
                            "document_id": document_id,
                            "file_name": parsed_doc.file_name,
                            "chapter": section.heading if section.level <= 1 else "",
                            "section": section.heading if section.level >= 2 else "",
                            "page": str(section.page) if section.page else "",
                            "chunk_index": str(chunk_index),
                            "content_type": section.content_type,
                        },
                    ))
                    chunk_index += 1
    else:
        # No structure detected — use raw text
        full_text = parsed_doc.full_text
        if not full_text.strip():
            logger.warning("Document %s has no text to chunk", document_id)
            return []

        sub_chunks = splitter.split_text(full_text)
        for sub_text in sub_chunks:
            if len(sub_text.strip()) < min_chunk:
                continue
            chunks.append(DocumentChunk(
                chunk_id=f"{document_id}_chunk_{chunk_index}",
                text=sub_text.strip(),
                chunk_index=chunk_index,
                metadata={
                    **base_meta,
                    "document_id": document_id,
                    "file_name": parsed_doc.file_name,
                    "chunk_index": str(chunk_index),
                    "content_type": "text",
                },
            ))
            chunk_index += 1

    logger.info(
        "Chunked %s into %d chunks (avg %d chars)",
        parsed_doc.file_name,
        len(chunks),
        sum(len(c.text) for c in chunks) // max(len(chunks), 1),
    )

    return chunks
