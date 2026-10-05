import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCcw, Trash2, FileText, Presentation, FileType2, Sliders, BookOpen } from "lucide-react";
import { PageHeader, Card, Pill, statusTone } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { PassageWorkbenchModal } from "@/components/passage-workbench";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import type { FileType, Difficulty } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/documents")({
  component: MyDocuments,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const FILE_ICONS: Record<FileType, React.ElementType> = {
  pdf:  FileText,
  pptx: Presentation,
  docx: FileType2,
};

export const FILE_COLORS: Record<FileType, string> = {
  pdf:  "text-red-brand bg-red-brand/10",
  pptx: "text-gold bg-amber-brand/15",
  docx: "text-violet bg-indigo-brand/10",
};

const DIFFICULTY_PILL: Record<Difficulty, string> = {
  easy:   "bg-green-brand/10 text-success",
  medium: "bg-amber-brand/15 text-gold",
  hard:   "bg-red-brand/10 text-danger",
};

// ─── Component ────────────────────────────────────────────────────────────────

function MyDocuments() {
  const { documents, subjects, modules: learningModules, deleteDocument } = useAppData();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [rerankDoc, setRerankDoc]       = useState<{ id: string; name: string } | null>(null);
  const [viewPdfDoc, setViewPdfDoc]     = useState<{ name: string; fileType: FileType; subjectId: string; uploadedBy: string; date: string } | null>(null);

  const myEmail = (user?.email || "faculty@charusat.edu.in").toLowerCase();
  const myName = (user?.name || "Dr. Nisha Shah").toLowerCase();
  const myId = user?.id || "";

  // Show docs uploaded by the logged-in faculty (or all seeded docs if demo faculty)
  const mine = documents.filter((d) => {
    const docUploader = String(d.uploadedBy || "").toLowerCase();
    const docUploaderName = String(d.uploadedByName || "").toLowerCase();
    const isOwner =
      docUploader === myEmail ||
      docUploaderName === myName ||
      docUploader === myId ||
      (d as any).uploaderId === myId;

    if (myEmail === "faculty@charusat.edu.in" || user?.role === "admin") {
      return true;
    }
    return isOwner;
  });

  const filtered = filterStatus === "all" ? mine : mine.filter((d) => d.status === filterStatus);

  return (
    <div>
      <PageHeader
        title="My Documents"
        subtitle="Everything you've contributed to the knowledge base. View document files, inspect multi-modal chunks, and adjust reranking weights."
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter:</span>
            {["all", "approved", "pending", "rejected"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                  filterStatus === s
                    ? "bg-violet text-white"
                    : "bg-card text-muted-foreground border border-border hover:border-violet/40"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total",        value: mine.length, color: "text-foreground" },
          { label: "Approved",     value: mine.filter(d => d.status === "approved").length, color: "text-green-brand" },
          { label: "Pending",      value: mine.filter(d => d.status === "pending").length, color: "text-amber-brand" },
          { label: "Total chunks", value: mine.reduce((s, d) => s + d.chunks, 0), color: "text-violet" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={cn("mt-2 text-3xl font-bold", color)}>{value}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Document</th>
                <th className="pb-3 pr-4">Subject</th>
                <th className="pb-3 pr-4">Module</th>
                <th className="pb-3 pr-4">Topic</th>
                <th className="pb-3 pr-4">Difficulty</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Chunks</th>
                <th className="pb-3 pr-4">Uploaded</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const subj = subjects.find((s) => s.id === d.subjectId);
                const mod  = learningModules.find((m) => m.id === d.moduleId);
                const Icon = FILE_ICONS[d.fileType];
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-accent/40">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", FILE_COLORS[d.fileType])}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-medium text-foreground leading-tight">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground uppercase">{d.fileType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{subj?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground max-w-[160px]">
                      <span className="truncate block text-xs">{mod?.name ?? <span className="italic text-muted-foreground">—</span>}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {d.topicTag ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{d.topicTag}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", DIFFICULTY_PILL[d.difficulty])}>
                        {d.difficulty}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone={statusTone(d.status)}>{d.status}</Pill>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{d.chunks || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">{d.uploadDate}</td>
                    <td className="py-3">
                      <div className="flex gap-2 text-muted-foreground">
                        <button
                          className="hover:text-violet transition"
                          title="Read Document File"
                          onClick={() => setViewPdfDoc({ name: d.name, fileType: d.fileType, subjectId: d.subjectId, uploadedBy: d.uploadedByName ?? d.uploadedBy, date: d.uploadDate })}
                        >
                          <BookOpen className="h-4 w-4 text-violet" />
                        </button>
                        <button
                          className="hover:text-violet transition"
                          title="Inspect & Rerank Chunks"
                          onClick={() => setRerankDoc({ id: d.id, name: d.name })}
                        >
                          <Sliders className="h-4 w-4 text-muted-foreground hover:text-violet" />
                        </button>
                        <button className="hover:text-red-brand" title="Delete" onClick={() => deleteDocument(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No documents match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reranking Workbench Modal */}
      {rerankDoc && (
        <PassageWorkbenchModal
          docId={rerankDoc.id}
          docName={rerankDoc.name}
          onClose={() => setRerankDoc(null)}
        />
      )}

      {/* Document Viewer Modal */}
      {viewPdfDoc && (
        <DocumentViewerModal
          docName={viewPdfDoc.name}
          fileType={viewPdfDoc.fileType}
          subjectName={subjects.find((s) => s.id === viewPdfDoc.subjectId)?.name ?? "CSE Subject"}
          uploadedBy={viewPdfDoc.uploadedBy}
          uploadDate={viewPdfDoc.date}
          onClose={() => setViewPdfDoc(null)}
        />
      )}
    </div>
  );
}
