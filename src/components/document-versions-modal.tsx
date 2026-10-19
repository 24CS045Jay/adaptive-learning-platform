import React, { useState, useEffect } from "react";
import { X, History, Upload, CheckCircle2, RotateCcw, AlertCircle, FileText, Layers } from "lucide-react";
import { Pill } from "@/components/app-shell";

interface VersionItem {
  version_id: string;
  version_number: number;
  original_filename: string;
  content_hash: string;
  status: string;
  is_active: boolean;
  uploaded_at: string;
  published_at?: string;
  chunk_count: number;
  embedding_model?: string;
  error_details?: string;
}

interface DocumentVersionsModalProps {
  docId: string;
  docName: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export function DocumentVersionsModal({ docId, docName, onClose, onRefresh }: DocumentVersionsModalProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const token = localStorage.getItem("auth_token") || "";

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load version history");
      const data = await res.json();
      setVersions(data.versions || []);
      setActiveVersionId(data.active_version_id || null);
    } catch (e: any) {
      setError(e.message || "Failed to fetch versions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [docId]);

  const handleUploadRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`/api/documents/${docId}/revision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Revision upload failed");
      }

      setUploadSuccess("New revision uploaded and queued for processing!");
      setSelectedFile(null);
      await fetchVersions();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message || "Failed to upload revision");
    } finally {
      setUploading(false);
    }
  };

  const handleRollback = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Are you sure you want to rollback to Version ${versionNumber}? Normal student retrieval will switch to this version immediately.`)) {
      return;
    }

    setRollingBack(versionId);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/rollback/${versionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Rollback failed");
      }

      await fetchVersions();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setError(e.message || "Failed to rollback version");
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-card border border-border shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Document Version History</h2>
              <p className="text-xs text-muted-foreground truncate max-w-md">{docName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-brand/10 p-3 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-brand/10 p-3 text-xs text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* Upload Revision Section */}
          <div className="rounded-xl border border-dashed border-border bg-accent/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-violet" />
              <h3 className="text-xs font-semibold text-foreground">Upload Revised Version</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Upload a modified PPT, PDF, or image for this logical document. Superseded versions are automatically archived and isolated from standard student retrieval.
            </p>
            <form onSubmit={handleUploadRevision} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="file"
                accept=".pdf,.pptx,.docx,.xlsx,.csv,.txt,.md,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet/10 file:text-violet hover:file:bg-violet/20"
              />
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet/90 disabled:opacity-50 transition shrink-0"
              >
                {uploading ? "Indexing Revision..." : "Publish Revision"}
              </button>
            </form>
          </div>

          {/* Version History Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Revisions ({versions.length})
              </h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading revision history...</div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No previous revision records found. Current document is Version 1.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Chunks</th>
                      <th className="py-2.5 px-3">SHA-256 Hash</th>
                      <th className="py-2.5 px-3">Uploaded</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {versions.map((v) => {
                      const isActive = v.is_active || v.version_id === activeVersionId;
                      return (
                        <tr key={v.version_id} className="hover:bg-accent/40">
                          <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-violet" />
                              <span>v{v.version_number}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-brand/10 px-2 py-0.5 text-[11px] font-medium text-success">
                                <CheckCircle2 className="h-3 w-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                                {v.status}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {v.chunk_count ? `${v.chunk_count} chunks` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono text-[10px]">
                            {v.content_hash ? `${v.content_hash.slice(0, 10)}...` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isActive ? (
                              <span className="text-[11px] text-muted-foreground italic">Current</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRollback(v.version_id, v.version_number)}
                                disabled={rollingBack === v.version_id}
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-violet hover:text-white transition disabled:opacity-50"
                              >
                                <RotateCcw className="h-3 w-3" />
                                {rollingBack === v.version_id ? "Rolling back..." : "Rollback"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-muted px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
