"""Version management for learning materials in EduSense AI.

Handles:
- SHA-256 content hashing to detect identical files
- Distinct logical document_id vs unique version_id (v1, v2, ...)
- Atomic activation / archiving of revisions
- Chroma metadata synchronization (is_active)
- Safe rollback to prior published revisions
- History inspection
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger("rag.versioning")

REGISTRY_PATH = Path(__file__).resolve().parent.parent / "data" / "document_versions.json"


@dataclass
class DocumentVersion:
    version_id: str
    version_number: int
    document_id: str
    original_filename: str
    content_hash: str
    status: str  # "processing" | "published" | "archived" | "failed"
    is_active: bool
    uploaded_at: str
    published_at: Optional[str] = None
    chunk_count: int = 0
    embedding_model: str = ""
    course_id: str = ""
    subject_id: str = ""
    faculty_id: str = ""
    error_details: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LogicalDocument:
    document_id: str
    active_version_id: Optional[str] = None
    latest_version_number: int = 0
    versions: List[DocumentVersion] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


class VersionRegistry:
    def __init__(self, storage_path: Path = REGISTRY_PATH) -> None:
        self.storage_path = storage_path
        self._lock = threading.Lock()
        self._docs: Dict[str, LogicalDocument] = {}
        self._load()

    def _load(self) -> None:
        if not self.storage_path.exists():
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for doc_id, doc_dict in raw.items():
                versions = [DocumentVersion(**v) for v in doc_dict.get("versions", [])]
                self._docs[doc_id] = LogicalDocument(
                    document_id=doc_dict["document_id"],
                    active_version_id=doc_dict.get("active_version_id"),
                    latest_version_number=doc_dict.get("latest_version_number", len(versions)),
                    versions=versions,
                    created_at=doc_dict.get("created_at", ""),
                    updated_at=doc_dict.get("updated_at", ""),
                )
        except Exception as e:
            log.warning("Failed to load version registry from %s: %s", self.storage_path, e)

    def _save(self) -> None:
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            data = {}
            for doc_id, ldoc in self._docs.items():
                data[doc_id] = {
                    "document_id": ldoc.document_id,
                    "active_version_id": ldoc.active_version_id,
                    "latest_version_number": ldoc.latest_version_number,
                    "created_at": ldoc.created_at,
                    "updated_at": ldoc.updated_at,
                    "versions": [asdict(v) for v in ldoc.versions],
                }
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            log.error("Failed to persist version registry: %s", e)

    @staticmethod
    def compute_hash(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def find_identical(self, doc_id: str, content_hash: str) -> Optional[DocumentVersion]:
        """Check if this document or version already has identical content."""
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                # Also check across all documents if needed
                for d in self._docs.values():
                    for v in d.versions:
                        if v.content_hash == content_hash and v.status == "published":
                            return v
                return None
            for v in ldoc.versions:
                if v.content_hash == content_hash and v.status == "published":
                    return v
            return None

    def prepare_version(
        self,
        doc_id: str,
        filename: str,
        content_hash: str,
        subject_id: str = "",
        course_id: str = "",
        faculty_id: str = "",
        embedding_model: str = "",
    ) -> DocumentVersion:
        """Create a new version record in 'processing' state."""
        with self._lock:
            now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                ldoc = LogicalDocument(
                    document_id=doc_id,
                    latest_version_number=0,
                    created_at=now_str,
                    updated_at=now_str,
                )
                self._docs[doc_id] = ldoc

            next_ver = ldoc.latest_version_number + 1
            ver_id = f"{doc_id}_v{next_ver}"
            new_ver = DocumentVersion(
                version_id=ver_id,
                version_number=next_ver,
                document_id=doc_id,
                original_filename=filename,
                content_hash=content_hash,
                status="processing",
                is_active=False,
                uploaded_at=now_str,
                embedding_model=embedding_model,
                course_id=course_id,
                subject_id=subject_id,
                faculty_id=faculty_id,
            )
            ldoc.latest_version_number = next_ver
            ldoc.versions.append(new_ver)
            ldoc.updated_at = now_str
            self._save()
            return new_ver

    def publish_version(self, doc_id: str, version_id: str, chunk_count: int) -> DocumentVersion:
        """Atomically activate new version and archive prior active versions."""
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                raise ValueError(f"Document {doc_id} not found")
            now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            target_ver = None
            for v in ldoc.versions:
                if v.version_id == version_id:
                    v.status = "published"
                    v.is_active = True
                    v.published_at = now_str
                    v.chunk_count = chunk_count
                    target_ver = v
                else:
                    if v.is_active:
                        v.is_active = False
                        v.status = "archived"

            if not target_ver:
                raise ValueError(f"Version {version_id} not found in document {doc_id}")

            ldoc.active_version_id = version_id
            ldoc.updated_at = now_str
            self._save()
            return target_ver

    def mark_failed(self, doc_id: str, version_id: str, error: str) -> None:
        """Mark version processing as failed, leaving active version unchanged."""
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                return
            for v in ldoc.versions:
                if v.version_id == version_id:
                    v.status = "failed"
                    v.is_active = False
                    v.error_details = str(error)[:500]
            self._save()

    def rollback(self, doc_id: str, target_version_id: str) -> DocumentVersion:
        """Rollback active pointer to a previous published version."""
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                raise ValueError(f"Document {doc_id} not found")
            target = None
            for v in ldoc.versions:
                if v.version_id == target_version_id:
                    if v.status not in {"published", "archived"}:
                        raise ValueError(f"Cannot rollback to version {target_version_id} with status '{v.status}'")
                    target = v

            if not target:
                raise ValueError(f"Version {target_version_id} not found in document {doc_id}")

            now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            for v in ldoc.versions:
                if v.version_id == target_version_id:
                    v.is_active = True
                    v.status = "published"
                else:
                    if v.is_active:
                        v.is_active = False
                        v.status = "archived"

            ldoc.active_version_id = target_version_id
            ldoc.updated_at = now_str
            self._save()
            return target

    def get_document_history(self, doc_id: str) -> Dict[str, Any]:
        """Return history of all versions for this document."""
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc:
                return {"document_id": doc_id, "active_version_id": None, "versions": []}
            return {
                "document_id": ldoc.document_id,
                "active_version_id": ldoc.active_version_id,
                "latest_version_number": ldoc.latest_version_number,
                "created_at": ldoc.created_at,
                "updated_at": ldoc.updated_at,
                "versions": [asdict(v) for v in reversed(ldoc.versions)],
            }

    def get_active_version(self, doc_id: str) -> Optional[DocumentVersion]:
        with self._lock:
            ldoc = self._docs.get(doc_id)
            if not ldoc or not ldoc.active_version_id:
                return None
            for v in ldoc.versions:
                if v.version_id == ldoc.active_version_id:
                    return v
            return None


_registry: Optional[VersionRegistry] = None


def get_version_registry() -> VersionRegistry:
    global _registry
    if _registry is None:
        _registry = VersionRegistry()
    return _registry
