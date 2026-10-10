"""
Document parsers — registry of file-type-specific parsers.
Each parser returns a normalized document representation.

Supported Phase 1: PDF, DOCX, PPTX, TXT, Markdown, XLSX, CSV
Phase 2: scanned PDFs (OCR), images
"""

from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("rag_service.ingestion.parsers")


@dataclass
class ParsedSection:
    """A section extracted from a document."""
    heading: str = ""
    level: int = 0        # heading level (1=chapter, 2=section, etc.)
    content: str = ""
    page: int | None = None
    content_type: str = "text"  # text, table, code, image_text


@dataclass
class ParsedDocument:
    """Normalized document representation returned by all parsers."""
    document_id: str = ""
    file_name: str = ""
    file_type: str = ""
    pages: list[str] = field(default_factory=list)
    sections: list[ParsedSection] = field(default_factory=list)
    tables: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""
    page_count: int = 0
    error: str | None = None

    @property
    def full_text(self) -> str:
        """Return the complete text content."""
        if self.raw_text:
            return self.raw_text
        parts = []
        for section in self.sections:
            if section.heading:
                parts.append(f"{'#' * max(section.level, 1)} {section.heading}")
            if section.content:
                parts.append(section.content)
        return "\n\n".join(parts) if parts else ""


# ── Individual Parsers ────────────────────────────────────────────────────────

def parse_pdf(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a PDF file using pypdf with structure extraction."""
    try:
        from pypdf import PdfReader
    except ImportError:
        try:
            # Fallback to pdf-parse compatible lib
            import pypdf
            PdfReader = pypdf.PdfReader
        except ImportError:
            return ParsedDocument(
                file_name=file_name, file_type="pdf",
                error="pypdf not installed"
            )

    doc = ParsedDocument(file_name=file_name, file_type="pdf")

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        doc.page_count = len(reader.pages)
        sections = []
        all_text_parts = []

        for page_num, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""

            # Step 20 OCR fallback if page text is empty
            if not text.strip() and hasattr(page, "images") and len(page.images) > 0:
                try:
                    import pytesseract
                    from PIL import Image
                    ocr_parts = []
                    for img_obj in page.images:
                        try:
                            img = Image.open(io.BytesIO(img_obj.data))
                            ocr_res = pytesseract.image_to_string(img)
                            if ocr_res.strip():
                                ocr_parts.append(ocr_res.strip())
                        except Exception:
                            pass
                    if ocr_parts:
                        text = "\n".join(ocr_parts)
                        logger.info(f"[OCR] Extracted {len(text)} characters from page {page_num} via OCR")
                except Exception as ocr_err:
                    logger.debug(f"[OCR] Fallback skipped on page {page_num}: {ocr_err}")

            doc.pages.append(text)
            all_text_parts.append(text)

            if text.strip():
                # Try to extract headings from the page text
                lines = text.split("\n")
                current_section = ParsedSection(page=page_num, level=2)
                section_lines = []

                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        continue
                    # Heuristic: short uppercase or bold-like lines are headings
                    if (len(stripped) < 80 and stripped.isupper()) or \
                       re.match(r"^(Chapter|Section|Unit|Module)\s+\d+", stripped, re.I):
                        # Save previous section
                        if section_lines:
                            current_section.content = "\n".join(section_lines)
                            sections.append(current_section)
                        current_section = ParsedSection(
                            heading=stripped, level=1 if "chapter" in stripped.lower() else 2,
                            page=page_num, content_type="text"
                        )
                        section_lines = []
                    else:
                        section_lines.append(stripped)

                if section_lines:
                    current_section.content = "\n".join(section_lines)
                    sections.append(current_section)

        doc.sections = sections if sections else [
            ParsedSection(content="\n".join(all_text_parts), page=1, content_type="text")
        ]
        doc.raw_text = "\n\n".join(all_text_parts)

    except Exception as e:
        doc.error = f"PDF parse error: {e}"
        logger.error("Failed to parse PDF %s: %s", file_name, e)

    return doc


def parse_docx(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a DOCX file preserving heading structure."""
    doc = ParsedDocument(file_name=file_name, file_type="docx")

    try:
        from docx import Document as DocxDocument
        document = DocxDocument(io.BytesIO(file_bytes))

        sections = []
        current_heading = ""
        current_level = 0
        current_content_lines = []

        for para in document.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            style_name = (para.style.name or "").lower()

            if "heading" in style_name:
                # Save previous section
                if current_content_lines:
                    sections.append(ParsedSection(
                        heading=current_heading,
                        level=current_level,
                        content="\n".join(current_content_lines),
                        content_type="text",
                    ))
                    current_content_lines = []

                # Determine heading level
                try:
                    current_level = int(re.search(r"\d+", style_name).group())
                except (AttributeError, ValueError):
                    current_level = 1
                current_heading = text
            else:
                current_content_lines.append(text)

        # Final section
        if current_content_lines:
            sections.append(ParsedSection(
                heading=current_heading,
                level=current_level,
                content="\n".join(current_content_lines),
                content_type="text",
            ))

        doc.sections = sections
        doc.raw_text = "\n\n".join(
            (s.heading + "\n" if s.heading else "") + s.content
            for s in sections
        )
        doc.page_count = max(1, len(sections) // 3)

        # Extract tables
        for table in document.tables:
            rows = []
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                rows.append(cells)
            if rows:
                doc.tables.append({"rows": rows})
                # Add table content as a section
                table_text = "\n".join(" | ".join(r) for r in rows)
                sections.append(ParsedSection(
                    content=table_text, content_type="table"
                ))

    except Exception as e:
        doc.error = f"DOCX parse error: {e}"
        logger.error("Failed to parse DOCX %s: %s", file_name, e)

    return doc


def parse_pptx(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a PPTX file extracting slide text."""
    doc = ParsedDocument(file_name=file_name, file_type="pptx")

    try:
        from pptx import Presentation
        prs = Presentation(io.BytesIO(file_bytes))

        sections = []
        all_text = []

        for slide_num, slide in enumerate(prs.slides, 1):
            slide_texts = []
            title = ""

            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        text = paragraph.text.strip()
                        if text:
                            slide_texts.append(text)
                            if not title and shape == slide.shapes.title:
                                title = text

                if shape.has_table:
                    table_rows = []
                    for row in shape.table.rows:
                        cells = [cell.text.strip() for cell in row.cells]
                        table_rows.append(" | ".join(cells))
                    slide_texts.extend(table_rows)

            if slide_texts:
                content = "\n".join(slide_texts)
                sections.append(ParsedSection(
                    heading=title or f"Slide {slide_num}",
                    level=2,
                    content=content,
                    page=slide_num,
                    content_type="text",
                ))
                all_text.append(content)

        doc.sections = sections
        doc.raw_text = "\n\n".join(all_text)
        doc.page_count = len(prs.slides)
        doc.pages = [s.content for s in sections]

    except Exception as e:
        doc.error = f"PPTX parse error: {e}"
        logger.error("Failed to parse PPTX %s: %s", file_name, e)

    return doc


def parse_txt(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a plain text file."""
    doc = ParsedDocument(file_name=file_name, file_type="txt")

    try:
        text = file_bytes.decode("utf-8", errors="replace")
        doc.raw_text = text
        doc.sections = [ParsedSection(content=text, content_type="text")]
        doc.page_count = max(1, text.count("\n") // 50)
    except Exception as e:
        doc.error = f"TXT parse error: {e}"

    return doc


def parse_markdown(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a Markdown file preserving heading hierarchy."""
    doc = ParsedDocument(file_name=file_name, file_type="md")

    try:
        text = file_bytes.decode("utf-8", errors="replace")
        doc.raw_text = text

        sections = []
        heading_re = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)

        # Split on headings
        parts = heading_re.split(text)
        # parts = [before_first_heading, hashes, title, content, hashes, title, content, ...]
        idx = 0
        # Text before first heading
        if parts and not parts[0].startswith("#"):
            preamble = parts[0].strip()
            if preamble:
                sections.append(ParsedSection(content=preamble, content_type="text"))
            idx = 1

        while idx < len(parts) - 2:
            hashes = parts[idx]
            title = parts[idx + 1].strip()
            content = parts[idx + 2].strip() if idx + 2 < len(parts) else ""
            level = len(hashes)
            sections.append(ParsedSection(
                heading=title, level=level, content=content, content_type="text"
            ))
            idx += 3

        doc.sections = sections if sections else [
            ParsedSection(content=text, content_type="text")
        ]
        doc.page_count = max(1, len(sections))

    except Exception as e:
        doc.error = f"Markdown parse error: {e}"

    return doc


def parse_xlsx(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse an Excel file extracting sheet data as text."""
    doc = ParsedDocument(file_name=file_name, file_type="xlsx")

    try:
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)

        sections = []
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            rows = []
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                if any(cells):
                    rows.append(cells)

            if rows:
                # First row as header
                header = " | ".join(rows[0])
                data_lines = [" | ".join(r) for r in rows[1:]]
                content = header + "\n" + "-" * len(header) + "\n" + "\n".join(data_lines)
                sections.append(ParsedSection(
                    heading=f"Sheet: {sheet}",
                    level=1,
                    content=content,
                    content_type="table",
                ))
                doc.tables.append({"sheet": sheet, "rows": rows})

        doc.sections = sections
        doc.raw_text = "\n\n".join(s.content for s in sections)
        doc.page_count = len(sections)
        wb.close()

    except Exception as e:
        doc.error = f"XLSX parse error: {e}"
        logger.error("Failed to parse XLSX %s: %s", file_name, e)

    return doc


def parse_csv(file_bytes: bytes, file_name: str = "") -> ParsedDocument:
    """Parse a CSV file as tabular text."""
    doc = ParsedDocument(file_name=file_name, file_type="csv")

    try:
        text = file_bytes.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)

        if rows:
            header = " | ".join(rows[0])
            data_lines = [" | ".join(r) for r in rows[1:]]
            content = header + "\n" + "-" * len(header) + "\n" + "\n".join(data_lines)
            doc.sections = [ParsedSection(content=content, content_type="table")]
            doc.tables.append({"rows": rows})
            doc.raw_text = content
            doc.page_count = 1

    except Exception as e:
        doc.error = f"CSV parse error: {e}"

    return doc


# ── Parser Registry ───────────────────────────────────────────────────────────

PARSER_REGISTRY: dict[str, callable] = {
    "pdf": parse_pdf,
    "docx": parse_docx,
    "pptx": parse_pptx,
    "txt": parse_txt,
    "text": parse_txt,
    "md": parse_markdown,
    "markdown": parse_markdown,
    "xlsx": parse_xlsx,
    "xls": parse_xlsx,
    "csv": parse_csv,
}

SUPPORTED_EXTENSIONS = set(PARSER_REGISTRY.keys())


def detect_file_type(file_name: str) -> str:
    """Detect file type from extension."""
    ext = Path(file_name).suffix.lower().lstrip(".")
    return ext if ext in PARSER_REGISTRY else "unknown"


def parse_document(
    file_bytes: bytes,
    file_name: str,
    document_id: str = "",
) -> ParsedDocument:
    """
    Main entry point — detect file type and parse using the appropriate parser.
    Returns a normalized ParsedDocument.
    """
    ext = detect_file_type(file_name)

    if ext not in PARSER_REGISTRY:
        return ParsedDocument(
            document_id=document_id,
            file_name=file_name,
            file_type=ext,
            error=f"Unsupported file type: .{ext}",
        )

    parser = PARSER_REGISTRY[ext]
    doc = parser(file_bytes, file_name)
    doc.document_id = document_id
    doc.file_name = file_name

    if not doc.raw_text and not doc.sections:
        doc.error = doc.error or "No text content extracted"
        logger.warning("Document %s (%s) produced no text", file_name, ext)

    logger.info(
        "Parsed %s: %d sections, %d pages, %d chars",
        file_name, len(doc.sections), doc.page_count, len(doc.full_text),
    )

    return doc
