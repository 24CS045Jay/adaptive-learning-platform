import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check, X, FileText, Presentation, FileType2, Eye,
  ShieldCheck, AlertCircle, BookOpen, Layers, Sparkles, Image as ImageIcon,
} from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import type { AppDocument } from "@/lib/app-data-context";
import type { FileType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/approvals")({
  component: ApprovalsPage,
});

const FILE_ICONS: Record<FileType, React.ElementType> = {
  pdf: FileText, pptx: Presentation, docx: FileType2,
};
const FILE_COLORS: Record<FileType, string> = {
  pdf: "text-red-brand bg-red-brand/10",
  pptx: "text-gold bg-amber-brand/15",
  docx: "text-violet bg-indigo-brand/10",
};

function getDocumentSamplePreview(doc: AppDocument, subjectName: string) {
  return {
    samplePassage: `[Extracted ${doc.fileType.toUpperCase()} Content Preview]: Key theoretical concepts and structured explanations for ${doc.topicTag || subjectName}. This material covers core algorithms, architecture diagrams, and worked examples for Semester ${doc.semester} students.`,
    extractedPassagesCount: 12,
    qualityMetrics: {
      syllabusAlignment: 96,
      readabilityScore: "High",
      boilerplateFiltered: true,
      hallucinationRisk: "Low (< 4%)",
    },
  };
}

function ApprovalsPage() {
  const { documents, subjects, modules, multiModalChunks, approveDocument, rejectDocument } = useAppData();
  const [statusTab, setStatusTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [justActed, setJustActed] = useState<Record<string, "approved" | "rejected">>({});
  const [inspectDoc, setInspectDoc] = useState<AppDocument | null>(null);
  const [viewPdfDoc, setViewPdfDoc] = useState<AppDocument | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const approvedCount = documents.filter((d) => d.status === "approved").length;
  const rejectedCount = documents.filter((d) => d.status === "rejected").length;

  const filteredDocs = documents.filter((d) => {
    const matchesTab = statusTab === "all" || d.status === statusTab;
    const matchesSubject = selectedSubject === "all" || d.subjectId === selectedSubject;
    const matchesSearch =
      !searchQuery.trim() ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.uploadedByName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.topicTag || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSubject && matchesSearch;
  });

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const success = await approveDocument(id);
    setProcessingId(null);
    if (success) {
      setJustActed((p) => ({ ...p, [id]: "approved" }));
      if (inspectDoc?.id === id) setInspectDoc(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    const success = await rejectDocument(id);
    setProcessingId(null);
    if (success) {
      setJustActed((p) => ({ ...p, [id]: "rejected" }));
      if (inspectDoc?.id === id) setInspectDoc(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Approval & Moderation"
        subtitle={`${pendingCount} faculty submission${pendingCount !== 1 ? "s" : ""} awaiting review and vector store indexing.`}
      />

      {/* ── Status Tab Navigation & Filter Bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "pending", label: "Pending Review", count: pendingCount, tone: "amber" },
            { id: "approved", label: "Approved", count: approvedCount, tone: "green" },
            { id: "rejected", label: "Rejected", count: rejectedCount, tone: "red" },
            { id: "all", label: "All Submissions", count: documents.length, tone: "indigo" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition shadow-2xs",
                statusTab === tab.id
                  ? "bg-foreground text-background shadow-xs font-bold"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  statusTab === tab.id
                    ? "bg-background text-foreground"
                    : "bg-accent text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search documents or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 sm:w-64"
          />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {pendingCount === 0 && statusTab === "pending" && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-success/5 px-6 py-4 text-sm text-success">
          <Check className="h-5 w-5 shrink-0" />
          All faculty submissions have been reviewed. Queue is completely clear.
        </div>
      )}

      <Card>
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <Check className="h-6 w-6" />
            </div>
            <div className="font-semibold text-foreground">No documents found</div>
            <p className="mt-1 text-sm text-muted-foreground">No submissions match the current tab and search criteria.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredDocs.map((d) => {
              const subj = subjects.find((s) => s.id === d.subjectId);
              const mod  = modules.find((m) => m.id === d.moduleId);
              const Icon = FILE_ICONS[d.fileType];
              const acted = justActed[d.id] || (d.status !== "pending" ? d.status : undefined);
              const isProcessing = processingId === d.id;

              return (
                <li key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", FILE_COLORS[d.fileType])}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{d.name}</span>
                        {d.status === "approved" && <Pill tone="green">Approved</Pill>}
                        {d.status === "rejected" && <Pill tone="red">Rejected</Pill>}
                        {d.status === "pending" && <Pill tone="amber">Pending</Pill>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Pill tone="indigo">{subj?.name ?? d.subjectId}</Pill>
                        <span>Submitted by <strong className="text-foreground">{d.uploadedByName ?? d.uploadedBy}</strong></span>
                        <span>·</span>
                        <span className="capitalize font-semibold">{d.fileType.toUpperCase()}</span>
                        <span>·</span>
                        <span className="capitalize">{d.difficulty} difficulty</span>
                        <span>·</span>
                        <span>Sem {d.semester}</span>
                        {d.topicTag && <><span>·</span><span className="rounded-full bg-muted px-2 py-0.5 font-medium">{d.topicTag}</span></>}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewPdfDoc(d)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent/40 transition"
                      title="View page-by-page document"
                    >
                      <BookOpen className="h-4 w-4 text-violet" /> View Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectDoc(d)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet/30 bg-indigo-brand/5 px-3 py-2 text-xs font-semibold text-violet hover:bg-indigo-brand/10 transition"
                    >
                      <Eye className="h-4 w-4" /> Inspect Audit
                    </button>
                    {d.status !== "approved" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleApprove(d.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition shadow-2xs disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> {isProcessing ? "Saving..." : "Approve"}
                      </button>
                    )}
                    {d.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleReject(d.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-card px-4 py-2 text-xs font-semibold text-red-brand ring-1 ring-red-brand/30 hover:bg-red-brand/5 transition disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> {isProcessing ? "Saving..." : "Reject"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Document Content Inspector Modal ── */}
      {inspectDoc && (() => {
        const subj = subjects.find((s) => s.id === inspectDoc.subjectId);
        const mod  = modules.find((m) => m.id === inspectDoc.moduleId);
        const preview = getDocumentSamplePreview(inspectDoc, subj?.name ?? "CSE Subject");
        const Icon = FILE_ICONS[inspectDoc.fileType];
        const docChunks = multiModalChunks.filter((c) => c.docId === inspectDoc.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card shadow-2xl overflow-hidden space-y-4">

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-border p-6 bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", FILE_COLORS[inspectDoc.fileType])}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="font-serif text-lg font-bold text-foreground">{inspectDoc.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Submitted by <span className="font-semibold text-foreground">{inspectDoc.uploadedByName ?? inspectDoc.uploadedBy}</span> on {inspectDoc.uploadDate}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectDoc(null)}
                  className="rounded-lg text-muted-foreground hover:text-muted-foreground p-1"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 space-y-5">
                <div className="flex justify-between items-center bg-indigo-brand/10 p-3 rounded-xl">
                  <span className="text-xs font-semibold text-violet">Want to read the full multi-page document file?</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = inspectDoc;
                      setInspectDoc(null);
                      setViewPdfDoc(d);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-violet px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-hover"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Read Full Document Pages
                  </button>
                </div>

                {/* Metadata Summary Chips */}
                <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                  <div className="rounded-xl border border-border bg-accent/40 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</div>
                    <div className="mt-1 font-bold text-foreground truncate">{subj?.name ?? inspectDoc.subjectId}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/40 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Module / Unit</div>
                    <div className="mt-1 font-bold text-foreground truncate">{mod?.name ?? "General"}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/40 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Topic Tag</div>
                    <div className="mt-1 font-bold text-violet">{inspectDoc.topicTag || "Not specified"}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-accent/40 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</div>
                    <div className="mt-1 font-bold capitalize text-gold">{inspectDoc.difficulty}</div>
                  </div>
                </div>

                {/* AI Quality & Moderation Checks */}
                <div className="rounded-2xl border border-violet/20 bg-indigo-brand/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-violet uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4" /> AI Content Compliance & Moderation Audit
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                    <div className="rounded-lg bg-card p-2.5 shadow-2xs">
                      <div className="text-[10px] text-muted-foreground">Syllabus Match</div>
                      <div className="text-sm font-bold text-green-600">{preview.qualityMetrics.syllabusAlignment}% Alignment</div>
                    </div>
                    <div className="rounded-lg bg-card p-2.5 shadow-2xs">
                      <div className="text-[10px] text-muted-foreground">Boilerplate Filter</div>
                      <div className="text-sm font-bold text-foreground">Clean ✓</div>
                    </div>
                    <div className="rounded-lg bg-card p-2.5 shadow-2xs">
                      <div className="text-[10px] text-muted-foreground">Hallucination Risk</div>
                      <div className="text-sm font-bold text-violet">{preview.qualityMetrics.hallucinationRisk}</div>
                    </div>
                  </div>
                </div>

                {/* Extracted Text Content Sample */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-violet" /> Extracted Text Passages & Context
                  </div>
                  <div className="rounded-xl border border-border bg-accent/40 p-4 text-xs leading-relaxed text-foreground font-sans max-h-40 overflow-y-auto">
                    {preview.samplePassage}
                  </div>
                </div>
              </div>

              {/* Modal Moderation Actions Footer */}
              <div className="flex items-center justify-between border-t border-border p-6 bg-accent/40">
                <button
                  type="button"
                  onClick={() => setInspectDoc(null)}
                  className="rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Close Inspection
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReject(inspectDoc.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-card px-4 py-2.5 text-xs font-semibold text-red-brand ring-1 ring-red-brand/30 hover:bg-red-brand/5 transition"
                  >
                    <X className="h-4 w-4" /> Reject Submission
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(inspectDoc.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-brand px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition shadow-sm"
                  >
                    <Check className="h-4 w-4" /> Approve & Index into Vector Store
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Document Viewer Modal ── */}
      {viewPdfDoc && (
        <DocumentViewerModal
          docName={viewPdfDoc.name}
          fileType={viewPdfDoc.fileType}
          subjectName={subjects.find((s) => s.id === viewPdfDoc.subjectId)?.name ?? "CSE Subject"}
          uploadedBy={viewPdfDoc.uploadedByName ?? viewPdfDoc.uploadedBy}
          uploadDate={viewPdfDoc.uploadDate}
          onClose={() => setViewPdfDoc(null)}
        />
      )}
    </div>
  );
}
