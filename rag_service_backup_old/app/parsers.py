"""Parse any supported document type into page-level text sections.

Returns a list of Section(text, page, heading). `page` is a 1-based page / slide / sheet
number so answers can cite real locations.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import List, Optional

SUPPORTED = {"pdf", "docx", "pptx", "xlsx", "xls", "csv", "txt", "md", "markdown", "html", "htm", "json", "rtf"}


@dataclass
class Section:
    text: str
    page: int = 1
    heading: Optional[str] = None


class ParseError(Exception):
    pass


def ext_of(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _clean(t: str) -> str:
    t = t.replace("\x00", " ").replace("\u00ad", "")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _pdf(data: bytes) -> List[Section]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise ParseError("PDF is password-protected")
    except ParseError:
        raise
    except Exception as e:
        raise ParseError(f"Cannot open PDF: {e}")
    out = []
    for i, page in enumerate(reader.pages, 1):
        try:
            t = _clean(page.extract_text() or "")
        except Exception:
            t = ""
        if t:
            out.append(Section(t, i))
    if not out:
        raise ParseError("PDF has no extractable text (scanned image PDF? run OCR first)")
    return out


def _docx(data: bytes) -> List[Section]:
    import docx

    try:
        d = docx.Document(io.BytesIO(data))
    except Exception as e:
        raise ParseError(f"Cannot open DOCX: {e}")
    sections: List[Section] = []
    heading, buf = None, []

    def flush():
        nonlocal buf
        t = _clean("\n".join(buf))
        if t:
            sections.append(Section(t, len(sections) + 1, heading))
        buf = []

    for p in d.paragraphs:
        txt = p.text.strip()
        if not txt:
            continue
        if p.style is not None and p.style.name.lower().startswith("heading"):
            flush()
            heading = txt
            buf.append(txt)
        else:
            buf.append(txt)
    flush()
    for ti, table in enumerate(d.tables, 1):
        rows = [" | ".join(c.text.strip() for c in r.cells) for r in table.rows]
        t = _clean("\n".join(rows))
        if t:
            sections.append(Section(f"Table {ti}:\n{t}", len(sections) + 1, f"Table {ti}"))
    if not sections:
        raise ParseError("DOCX has no text")
    return sections


def _pptx(data: bytes) -> List[Section]:
    from pptx import Presentation

    try:
        prs = Presentation(io.BytesIO(data))
    except Exception as e:
        raise ParseError(f"Cannot open PPTX: {e}")
    out = []
    for i, slide in enumerate(prs.slides, 1):
        parts, title = [], None
        for sh in slide.shapes:
            if sh.has_text_frame:
                t = "\n".join(p.text for p in sh.text_frame.paragraphs if p.text.strip())
                if t.strip():
                    if title is None and getattr(sh, "is_placeholder", False):
                        title = t.strip().split("\n")[0]
                    parts.append(t)
            if getattr(sh, "has_table", False) and sh.has_table:
                for r in sh.table.rows:
                    parts.append(" | ".join(c.text for c in r.cells))
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame is not None:
            n = slide.notes_slide.notes_text_frame.text.strip()
            if n:
                parts.append("Speaker notes: " + n)
        t = _clean("\n".join(parts))
        if t:
            out.append(Section(t, i, title))
    if not out:
        raise ParseError("PPTX has no text")
    return out


def _xlsx(data: bytes) -> List[Section]:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:
        raise ParseError(f"Cannot open spreadsheet: {e}")
    out = []
    for i, ws in enumerate(wb.worksheets, 1):
        rows = []
        for r in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c) for c in r]
            if any(cells):
                rows.append(" | ".join(cells))
        t = _clean("\n".join(rows))
        if t:
            out.append(Section(f"Sheet {ws.title}:\n{t}", i, ws.title))
    if not out:
        raise ParseError("Spreadsheet is empty")
    return out


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="ignore")


def _csv(data: bytes) -> List[Section]:
    text = _decode(data)
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ParseError("CSV is empty")
    header = rows[0]
    lines = [" | ".join(header)] + [" | ".join(r) for r in rows[1:]]
    return [Section(_clean("\n".join(lines)), 1, "CSV")]


def _html(data: bytes) -> List[Section]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(_decode(data), "html.parser")
    for t in soup(["script", "style", "noscript"]):
        t.decompose()
    t = _clean(soup.get_text("\n"))
    if not t:
        raise ParseError("HTML has no text")
    return [Section(t, 1, soup.title.string.strip() if soup.title and soup.title.string else None)]


def _text(data: bytes) -> List[Section]:
    t = _clean(_decode(data))
    if not t:
        raise ParseError("File is empty")
    return [Section(t, 1)]


def parse_bytes(data: bytes, file_name: str) -> List[Section]:
    e = ext_of(file_name)
    if e not in SUPPORTED:
        raise ParseError(f"Unsupported file type '.{e}'. Supported: {', '.join(sorted(SUPPORTED))}")
    if not data:
        raise ParseError("File is empty")
    if e == "pdf":
        return _pdf(data)
    if e == "docx":
        return _docx(data)
    if e == "pptx":
        return _pptx(data)
    if e in {"xlsx", "xls"}:
        return _xlsx(data)
    if e == "csv":
        return _csv(data)
    if e in {"html", "htm"}:
        return _html(data)
    return _text(data)  # txt, md, json, rtf (plain)


def parse_text(text: str) -> List[Section]:
    t = _clean(text or "")
    if not t:
        raise ParseError("Text is empty")
    return [Section(t, 1)]
