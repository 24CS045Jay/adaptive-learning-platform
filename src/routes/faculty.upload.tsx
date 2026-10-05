import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Upload, FileText, Presentation, FileType2, X, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";
import { PageHeader, Card, PrimaryButton } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import type { Difficulty, FileType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/upload")({
  component: UploadContent,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type AcceptedExt = ".pdf" | ".pptx" | ".docx";

const ALLOWED_TYPES: Record<string, FileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const FILE_ICONS: Record<FileType, React.ElementType> = {
  pdf:  FileText,
  pptx: Presentation,
  docx: FileType2,
};

const FILE_COLORS: Record<FileType, string> = {
  pdf:  "text-red-brand bg-red-brand/10",
  pptx: "text-gold bg-amber-brand/15",
  docx: "text-violet bg-indigo-brand/10",
};

const FILE_LABELS: Record<FileType, string> = {
  pdf:  "PDF",
  pptx: "PPTX",
  docx: "DOCX",
};

interface SelectedFile {
  file: File;
  fileType: FileType;
}

// ─── Component ────────────────────────────────────────────────────────────────

function UploadContent() {
  const { subjects, modules: learningModules, uploadDocument } = useAppData();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Metadata form
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [moduleId, setModuleId]   = useState("");
  const [topicTag, setTopicTag]   = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [semester, setSemester]   = useState(String(subjects[0]?.semester || "1"));

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      setSubjectId(subjects[0].id);
      setSemester(String(subjects[0].semester || "1"));
    }
  }, [subjects, subjectId]);

  const availableModules = learningModules.filter((m) => m.subjectId === subjectId);

  const handleFile = (file: File) => {
    setFileError(null);
    setSubmitted(false);
    
    // Check file extension if type is generic
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let ft: FileType | undefined = ALLOWED_TYPES[file.type];
    if (!ft) {
      if (ext === "pdf") ft = "pdf";
      else if (ext === "pptx") ft = "pptx";
      else if (ext === "docx") ft = "docx";
    }

    if (!ft) {
      setFileError("Only PDF, PPTX, and DOCX files are accepted.");
      setSelected(null);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError("File exceeds the 50 MB size limit.");
      setSelected(null);
      return;
    }
    setSelected({ file, fileType: ft });
    // Auto-fill semester from selected subject
    const subj = subjects.find((s) => s.id === subjectId);
    if (subj) setSemester(String(subj.semester || "1"));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setFileError("Please select a file first.");
      return;
    }

    setLoading(true);
    setFileError(null);

    const formData = new FormData();
    formData.append("file", selected.file);
    formData.append("subjectId", subjectId || subjects[0]?.id || "");
    if (moduleId) formData.append("unit", moduleId);
    if (topicTag) formData.append("topicTag", topicTag);

    const success = await uploadDocument(formData);
    setLoading(false);

    if (!success) {
      setFileError("Upload failed. Please try again.");
      return;
    }

    setSubmitted(true);
    setSelected(null);
    setTopicTag("");
    setModuleId("");
  };

  const FileIcon = selected ? FILE_ICONS[selected.fileType] : null;

  return (
    <div>
      <PageHeader
        title="Upload Content"
        subtitle="Add course material (PDF, PPTX, or DOCX) for admin review before it's indexed into the tutor."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Main upload form ── */}
        <Card className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Success banner */}
            {submitted && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-success/5 px-4 py-3 text-sm text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Document submitted for admin review. It will appear in "My Documents" until approved.
              </div>
            )}

            {/* ── Drop zone ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
                  dragging
                    ? "border-violet bg-indigo-brand/5"
                    : selected
                    ? "border-green-300 bg-success/5"
                    : "border-border bg-accent/40 hover:border-violet/50 hover:bg-indigo-brand/5"
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.pptx,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                {selected ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl text-2xl", FILE_COLORS[selected.fileType])}>
                      {FileIcon && <FileIcon className="h-7 w-7" />}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{selected.file.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {FILE_LABELS[selected.fileType]} · {(selected.file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelected(null); setFileError(null); }}
                      className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-3 text-sm font-medium text-foreground">
                      Drop a file here, or <span className="text-violet">browse</span>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      {(["pdf", "pptx", "docx"] as FileType[]).map((t) => {
                        const Icon = FILE_ICONS[t];
                        return (
                          <span key={t} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", FILE_COLORS[t])}>
                            <Icon className="h-3 w-3" /> {FILE_LABELS[t]}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Max 50 MB</div>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {fileError}
                </div>
              )}
            </div>

            {/* ── Subject ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setModuleId("");
                  const subj = subjects.find((s) => s.id === e.target.value);
                  if (subj) setSemester(String(subj.semester));
                }}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-violet"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            {/* ── Module ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Module / Unit <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-violet"
              >
                <option value="">— Not linked to a module —</option>
                {availableModules.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* ── Topic tag ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Topic tag <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                value={topicTag}
                onChange={(e) => setTopicTag(e.target.value)}
                placeholder="e.g. MapReduce, Logistic Regression"
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-violet"
              />
            </div>

            {/* ── Difficulty + Semester row ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Difficulty
                </label>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition",
                        difficulty === d
                          ? d === "easy"
                            ? "border-green-300 bg-success/5 text-success"
                            : d === "medium"
                            ? "border-amber-300 bg-gold/5 text-gold"
                            : "border-red-300 bg-danger/5 text-danger"
                          : "border-border text-muted-foreground hover:border-slate-300"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Semester
                </label>
                <input
                  type="number"
                  min={1} max={8}
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-violet"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-hover transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Uploading & Queuing Document...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Submit Document for Review</span>
                </>
              )}
            </button>
          </form>
        </Card>

        {/* ── Info sidebar ── */}
        <div className="hidden lg:col-span-2 lg:block space-y-4">
          <Card title="Processing pipeline">
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                { step: "1", text: "File type detected (PDF / PPTX / DOCX)" },
                { step: "2", text: "Text extraction — slides/notes for PPTX, paragraphs for DOCX" },
                { step: "3", text: "Boilerplate stripped — headers, footers, slide numbers removed" },
                { step: "4", text: "Chunked into ~300-token passages" },
                { step: "5", text: "Embedded and indexed into the vector store" },
                { step: "6", text: "Metadata tagged: subject, module, topic, difficulty, semester" },
              ].map(({ step, text }) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-brand/10 text-[11px] font-bold text-violet">{step}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Accepted formats">
            <div className="space-y-2">
              {(["pdf", "pptx", "docx"] as FileType[]).map((t) => {
                const Icon = FILE_ICONS[t];
                return (
                  <div key={t} className="flex items-center gap-2.5 rounded-lg p-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", FILE_COLORS[t])}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="text-sm">
                      <div className="font-semibold text-foreground">.{t.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">
                        {t === "pdf" ? "Direct text extraction" : t === "pptx" ? "Slide text + speaker notes" : "Paragraphs + headings"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
