import { useState, useEffect } from "react";
import {
  Layers, AlertCircle, CheckCircle2, ShieldAlert,
  Search, RefreshCw, X, Database, Cpu, BookOpen, Hash, ArrowUpDown
} from "lucide-react";
import { API_BASE, authHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ChunkMetadata {
  document_id?: string;
  subject_id?: string;
  chapter?: string;
  section?: string;
  page?: string | number;
  chunk_index?: number;
  char_count?: number;
  token_count?: number;
  [key: string]: any;
}

interface RealChunk {
  id: string;
  index: number;
  text: string;
  metadata: ChunkMetadata;
}

interface IngestionStatusData {
  document_id?: string;
  status?: string;
  step?: string;
  metrics?: {
    characters_extracted?: number;
    sections_found?: number;
    chunks_created?: number;
    embeddings_created?: number;
    vectors_indexed?: number;
    embedding_dimension?: number;
    embedding_model?: string;
    duration_ms?: number;
  };
}

export function PassageWorkbenchModal({
  docId,
  docName,
  onClose,
}: {
  docId: string;
  docName: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [chunks, setChunks] = useState<RealChunk[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState<string>("BAAI/bge-m3");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isReindexing, setIsReindexing] = useState<boolean>(false);

  const fetchChunkData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = authHeaders(user?.token, { role: user?.role, id: user?.studentId || user?.facultyId });
      
      // Fetch real chunks
      const chunkRes = await fetch(`${API_BASE}/api/documents/${docId}/chunks`, {
        headers,
      });

      if (!chunkRes.ok) {
        throw new Error(`Failed to fetch chunks (${chunkRes.status} ${chunkRes.statusText})`);
      }

      const chunkData = await chunkRes.json();
      setChunks(chunkData.chunks || []);
      setTotalCount(chunkData.count ?? (chunkData.chunks ? chunkData.chunks.length : 0));
      if (chunkData.embedding_model) {
        setEmbeddingModel(chunkData.embedding_model);
      }

      // Fetch ingestion status telemetry
      try {
        const statusRes = await fetch(`${API_BASE}/api/documents/${docId}/ingestion-status`, {
          headers,
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIngestionStatus(statusData);
        }
      } catch (statusErr) {
        console.warn("[PassageWorkbench] Could not fetch detailed status:", statusErr);
      }
    } catch (err: any) {
      console.error("[PassageWorkbench] Error:", err);
      setError(err.message || "Failed to load vector chunks from microservice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChunkData();
  }, [docId]);

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const headers = authHeaders(user?.token, { role: user?.role, id: user?.studentId || user?.facultyId });
      const res = await fetch(`${API_BASE}/api/documents/${docId}/reingest`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Re-index request failed");
      await fetchChunkData();
    } catch (err: any) {
      alert("Reindexing failed: " + err.message);
    } finally {
      setIsReindexing(false);
    }
  };

  // Filter chunks by search query
  const filteredChunks = chunks.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const textMatch = c.text.toLowerCase().includes(q);
    const secMatch = (c.metadata?.section || "").toLowerCase().includes(q);
    const chapMatch = (c.metadata?.chapter || "").toLowerCase().includes(q);
    const pageMatch = String(c.metadata?.page || "").includes(q);
    return textMatch || secMatch || chapMatch || pageMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                Passage Inspection & Chunk Observability
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Real Vectors
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Document: <span className="font-semibold text-foreground">{docName}</span> · ID: <span className="font-mono text-[11px]">{docId}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReindex}
              disabled={isReindexing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isReindexing && "animate-spin")} />
              {isReindexing ? "Reindexing..." : "Reindex"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Real-time Ingestion & Health Banner */}
        <div className="border-b border-border bg-accent/20 px-6 py-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Chroma Vectors:</span>
                <span className="font-mono font-bold text-foreground">{totalCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono font-medium text-foreground">{embeddingModel}</span>
              </div>
              {ingestionStatus?.metrics?.embedding_dimension && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Dimension:</span>
                  <span className="font-mono font-medium text-foreground">{ingestionStatus.metrics.embedding_dimension}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">Pipeline State:</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                (ingestionStatus?.status === "completed" || totalCount > 0)
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              )}>
                <CheckCircle2 className="h-3 w-3" />
                {ingestionStatus?.status || (totalCount > 0 ? "indexed" : "pending")}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="border-b border-border px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search extracted chunk content, section titles, page numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredChunks.length}</span> of {chunks.length} chunks
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-semibold text-foreground">Querying Python RAG Microservice...</div>
              <p className="text-xs text-muted-foreground">Fetching vector passages directly from Chroma store.</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="text-sm font-bold text-destructive">Failed to Load Vector Chunks</div>
              <p className="text-xs text-muted-foreground max-w-md">{error}</p>
              <button
                type="button"
                onClick={fetchChunkData}
                className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                Retry Request
              </button>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Layers className="h-10 w-10 text-muted-foreground/40" />
              <div className="font-semibold text-foreground">
                {chunks.length === 0 ? "No vector chunks indexed in Chroma" : "No matching chunks found"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {chunks.length === 0
                  ? "This document may still be queued, or processing was not completed. Trigger reindexing to extract and embed passages."
                  : "Try a different search keyword or clear the search query."}
              </p>
              {chunks.length === 0 && (
                <button
                  type="button"
                  onClick={handleReindex}
                  disabled={isReindexing}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  {isReindexing ? "Indexing..." : "Index Now with BGE-M3"}
                </button>
              )}
            </div>
          ) : (
            filteredChunks.map((chunk, idx) => {
              const charCount = chunk.metadata?.char_count || chunk.text.length;
              const tokenEstimate = chunk.metadata?.token_count || Math.ceil(charCount / 4);
              const page = chunk.metadata?.page ?? "N/A";
              const section = chunk.metadata?.section || "Default Section";
              const chapter = chunk.metadata?.chapter;

              return (
                <div
                  key={chunk.id || `chunk-${idx}`}
                  className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 transition hover:border-primary/40"
                >
                  {/* Top Metadata Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 px-2 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-bold text-primary">
                        Chunk #{chunk.index ?? idx}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                        Page {page}
                      </span>
                      {chapter && (
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                          {chapter}
                        </span>
                      )}
                      <span className="font-semibold text-foreground truncate max-w-xs">
                        {section}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      <span>{charCount} chars</span>
                      <span>·</span>
                      <span>~{tokenEstimate} tokens</span>
                      <span>·</span>
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-600 font-sans font-semibold">
                        Chroma + BM25 Ready
                      </span>
                    </div>
                  </div>

                  {/* Chunk Text Content */}
                  <div className="rounded-lg bg-muted/30 p-3 border border-border/40 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap selection:bg-primary/20">
                    {chunk.text}
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] text-muted-foreground/70">ID: {chunk.id}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/40">
          <div className="text-xs text-muted-foreground">
            Directly connected to <span className="font-semibold text-foreground">rag_service</span>. All passages are searchable via dense BGE-M3 + BM25 sparse hybrid retrieval.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm"
          >
            Close Workbench
          </button>
        </div>

      </div>
    </div>
  );
}
