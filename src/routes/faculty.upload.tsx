import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
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
  const { subjects, modules: learningModules, uploadDocument, refreshSubjects } = useAppData();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    refreshSubjects();
  }, [refreshSubjects]);

  const myId = user?.id ? String(user.id).trim().toLowerCase() : "";
  const myEmail = user?.email ? String(user.email).trim().toLowerCase() : "";
  const myName = user?.name ? String(user.name).trim().toLowerCase() : "";

  const facultySubjects = useMemo(() => {
    if (user?.role === "admin") return subjects;
    return subjects.filter((s) => {
      const sFacId = s.facultyId ? String(s.facultyId).trim().toLowerCase() : "";
      const sFacEmail = s.facultyEmail ? String(s.facultyEmail).trim().toLowerCase() : "";
      const sFacName = s.faculty ? String(s.faculty).trim().toLowerCase() : "";

      if (sFacId && myId && sFacId === myId) return true;
      if (sFacEmail && myEmail && sFacEmail === myEmail) return true;
      if (sFacName && myName && (sFacName === myName || sFacName.includes(myName) || myName.includes(sFacName))) {
        return true;
      }
      return false;
    });
  }, [subjects, user, myId, myEmail, myName]);

  // Metadata form
  const [subjectId, setSubjectId] = useState(facultySubjects[0]?.id || "");
  const [moduleId, setModuleId]   = useState("");
  const [topicTag, setTopicTag]   = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [semester, setSemester]   = useState(String(facultySubjects[0]?.semester || "1"));

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [uploadStage, setUploadStage] = useState<"idle" | "validating" | "uploading" | "extracting" | "queued">("idle");
  const [submittedDocName, setSubmittedDocName] = useState<string>("");

  useEffect(() => {
    if (facultySubjects.length > 0) {
      if (!subjectId || !facultySubjects.some((s) => s.id === subjectId)) {
        setSubjectId(facultySubjects[0].id);
        setSemester(String(facultySubjects[0].semester || "1"));
      }
    } else {
      setSubjectId("");
    }
  }, [facultySubjects, subjectId]);

  const availableModules = learningModules.filter((m) => m.subjectId === subjectId);

  const handleFile = (file: File) => {
    setFileError(null);
    setSubmitted(false);
    setUploadStage("idle");
    
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
    setUploadStage("validating");

    const docFileName = selected.file.name;
    const formData = new FormData();
    formData.append("file", selected.file);
    formData.append("subjectId", subjectId || subjects[0]?.id || "");
    if (moduleId) formData.append("unit", moduleId);
    if (topicTag) formData.append("topicTag", topicTag);

    // Multi-stage progression feedback
    setTimeout(() => setUploadStage("uploading"), 300);
    setTimeout(() => setUploadStage("extracting"), 1500);

    const success = await uploadDocument(formData);
    setLoading(false);

    if (!success) {
      setFileError("Upload failed. Please check network connection and try again.");
      setUploadStage("idle");
      return;
    }

    setSubmittedDocName(docFileName);
    setUploadStage("queued");
    setSubmitted(true);
    setSelected(null);
    setTopicTag("");
    setModuleId("");
  };

  const FileIcon = selected ? FILE_ICONS[selected.fileType] : null;

  return (
    <div>
      <PageHeader
        title="Course Material Ingestion"
        subtitle="Upload syllabus resources (PDF, PPTX, or DOCX) for institutional moderation and AI tutor vectorization."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Main upload form ── */}
        <Card className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Multi-stage upload tracker during active ingestion */}
            {loading && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span>Ingesting Document: {selected?.file.name}</span>
                  </span>
                  <span className="text-[11px] font-mono">
                    {uploadStage === "validating" ? "Step 1 of 3" : uploadStage === "uploading" ? "Step 2 of 3" : "Step 3 of 3"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className={cn(
                    "rounded-lg p-2 border transition",
                    uploadStage === "validating" ? "border-primary bg-primary/10 font-bold text-primary" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  )}>
                    1. File Validation
                  </div>
                  <div className={cn(
                    "rounded-lg p-2 border transition",
                    uploadStage === "uploading" ? "border-primary bg-primary/10 font-bold text-primary" : uploadStage === "extracting" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-border text-muted-foreground opacity-60"
                  )}>
                    2. Cloud Vault
                  </div>
                  <div className={cn(
                    "rounded-lg p-2 border transition",
                    uploadStage === "extracting" ? "border-primary bg-primary/10 font-bold text-primary" : "border-border text-muted-foreground opacity-60"
                  )}>
                    3. Passage Extraction
                  </div>
                </div>
              </div>
            )}

            {/* Success banner with pipeline recap */}
            {submitted && !loading && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Document Queued for Admin Approval</span>
                </div>
                <p className="text-muted-foreground text-xs pl-7">
                  <strong className="text-foreground">{submittedDocName}</strong> has been extracted and chunked. Once approved by the department administrator, passages will become queryable in the AI Tutor.
                </p>
              </div>
            )}

            {/* ── Drop zone ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Document File <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-xl border-2 border-dashed px-6 py-9 text-center transition",
                  dragging
                    ? "border-primary bg-blue-50/40 dark:bg-blue-950/20"
                    : selected
                    ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20"
                    : "border-border bg-background hover:border-slate-400 hover:bg-accent/30"
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
                  <div className="flex flex-col items-center gap-2.5">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-xl", FILE_COLORS[selected.fileType])}>
                      {FileIcon && <FileIcon className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{selected.file.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {FILE_LABELS[selected.fileType]} Format · {(selected.file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelected(null); setFileError(null); }}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:underline pt-1"
                    >
                      <X className="h-3.5 w-3.5" /> Remove & Replace
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
                    <div className="mt-2.5 text-sm font-semibold text-foreground">
                      Drag & drop course document here, or <span className="text-primary underline">browse</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      {(["pdf", "pptx", "docx"] as FileType[]).map((t) => {
                        const Icon = FILE_ICONS[t];
                        return (
                          <span key={t} className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border border-current/20", FILE_COLORS[t])}>
                            <Icon className="h-3 w-3" /> {FILE_LABELS[t]}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Maximum file size: 50 MB</div>
                  </div>
                )}
              </div>

              {fileError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {fileError}
                </div>
              )}
            </div>

            {/* ── Subject ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
              <select
                value={subjectId}
                disabled={facultySubjects.length === 0}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setModuleId("");
                  const subj = facultySubjects.find((s) => s.id === e.target.value);
                  if (subj) setSemester(String(subj.semester));
                }}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {facultySubjects.length > 0 ? (
                  facultySubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))
                ) : (
                  <option value="">No assigned subjects available</option>
                )}
              </select>
              {facultySubjects.length === 0 && (
                <div className="mt-2 text-xs text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>You cannot upload materials because you have no assigned subjects yet. Please contact an admin.</span>
                </div>
              )}
            </div>

            {/* ── Module ── */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Module / Unit <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* ── Difficulty + Semester row ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Difficulty Level
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
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold"
                            : d === "medium"
                            ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold"
                            : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold"
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
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selected || !subjectId}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing & Ingesting Material...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Submit Syllabus Document for Review</span>
                </>
              )}
            </button>
          </form>
        </Card>

        {/* ── Info sidebar ── */}
        <div className="hidden lg:col-span-2 lg:block space-y-4">
          <Card title="Ingestion Pipeline">
            <ul className="space-y-3 text-xs text-muted-foreground">
              {[
                { step: "1", text: "File type validated (PDF / PPTX / DOCX)" },
                { step: "2", text: "Text extraction — slides/notes for PPTX, structured paragraphs for DOCX" },
                { step: "3", text: "Boilerplate stripped — running headers, footers, slide numbers removed" },
                { step: "4", text: "Chunked into ~300-token semantic passages" },
                { step: "5", text: "Embedded and indexed into ChromaDB vector database" },
                { step: "6", text: "Metadata tagged: subject, module, topic, difficulty, semester" },
              ].map(({ step, text }) => (
                <li key={step} className="flex gap-2.5 items-start">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-bold border border-blue-200">{step}</span>
                  <span className="leading-tight pt-0.5">{text}</span>
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
