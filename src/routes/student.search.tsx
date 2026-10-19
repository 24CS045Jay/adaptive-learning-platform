import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, FileText, Presentation, FileType2, Eye, BookOpen, Layers, Lock } from "lucide-react";
import { useState } from "react";
import { PageHeader, Card, Pill, EmptyState } from "@/components/app-shell";
import { useAppData, type AppDocument } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { DocumentViewerModal } from "@/components/document-viewer-modal";
import type { FileType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/search")({
  head: () => ({
    meta: [
      { title: "Search Course Notes & Slides · AI Tutor Student" },
      { name: "description", content: "Semantic and keyword search across approved lecture materials and documents." },
    ],
  }),
  component: SearchNotes,
});

const FILE_ICONS: Record<FileType, React.ElementType> = {
  pdf: FileText,
  pptx: Presentation,
  docx: FileType2,
};

const FILE_COLORS: Record<FileType, string> = {
  pdf: "text-red-brand bg-red-brand/10",
  pptx: "text-gold bg-amber-brand/15",
  docx: "text-violet bg-indigo-brand/10",
};

function SearchNotes() {
  const { documents, subjects } = useAppData();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [viewPdfDoc, setViewPdfDoc] = useState<AppDocument | null>(null);

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = user?.studentId ? String(user.studentId).toLowerCase() : "";

  const isEnrolled = (s: any) => {
    const list: string[] = Array.isArray(s.enrolledStudentIds)
      ? s.enrolledStudentIds
      : typeof s.enrolledStudentIds === "string"
      ? JSON.parse(s.enrolledStudentIds || "[]")
      : [];
    return list.some((item) => {
      const clean = String(item).toLowerCase();
      return clean === myId.toLowerCase() || clean === myEmail || (myStudentId && clean === myStudentId);
    });
  };

  const enrolledSubjects = subjects.filter(isEnrolled);
  const enrolledSubjectIds = new Set(enrolledSubjects.map((s) => s.id));

  // Only allow notes from subjects the student has enrolled in
  const approvedDocs = documents.filter(
    (d) => d.status === "approved" && enrolledSubjectIds.has(d.subjectId)
  );

  const results = approvedDocs.filter((d) => {
    if (selectedSubject !== "all" && d.subjectId !== selectedSubject) return false;
    if (q.trim()) {
      const term = q.toLowerCase();
      const subj = enrolledSubjects.find((s) => s.id === d.subjectId);
      return (
        d.name.toLowerCase().includes(term) ||
        (d.topicTag && d.topicTag.toLowerCase().includes(term)) ||
        (subj && subj.name.toLowerCase().includes(term)) ||
        (subj && subj.code.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Search Indexed Notes & Course Slides"
        subtitle="Search across approved course materials and lecture slides for your enrolled subjects."
      />

      {enrolledSubjects.length === 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-8 text-center max-w-xl mx-auto my-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground">
            Course Notes Locked — 0 Subjects Enrolled
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            You are not currently enrolled in any subjects. To search and view approved lecture slides, syllabus materials, and course documents, please enroll in your subjects from the Course Catalog.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/student"
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-hover transition"
            >
              Browse Course Catalog & Enroll →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Search Input Bar */}
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by keyword, topic (#MapReduce), document title, or course..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Subject Filter Pills */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium mr-1">Subject Filter:</span>
            <button
              type="button"
              onClick={() => setSelectedSubject("all")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                selectedSubject === "all"
                  ? "bg-violet text-white shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All Enrolled Subjects ({approvedDocs.length})
            </button>
            {enrolledSubjects.map((s) => {
              const count = approvedDocs.filter((d) => d.subjectId === s.id).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSubject(s.id)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                    selectedSubject === s.id
                      ? "bg-violet text-white shadow-xs"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Results List */}
      <Card>
        {results.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No course materials found"
            description={
              q
                ? `No documents matching "${q}". Try searching for concepts like "MapReduce", "HDFS", or "Architecture".`
                : "Approved course materials and slides uploaded by faculty will appear here."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {results.map((d) => {
              const subj = subjects.find((s) => s.id === d.subjectId);
              const FileIcon = FILE_ICONS[d.fileType] || FileText;
              const colorClass = FILE_COLORS[d.fileType] || "text-violet bg-violet/10";
              const topic = d.topicTag || "Core Lecture Notes";

              return (
                <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold",
                          colorClass
                        )}
                      >
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm flex items-center gap-2 flex-wrap">
                          <span>{d.name}</span>
                          <Pill tone="indigo">{subj?.name || "Course Material"}</Pill>
                          <Pill tone={d.difficulty === "hard" ? "red" : d.difficulty === "medium" ? "amber" : "green"}>
                            {d.difficulty}
                          </Pill>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                          Covers <strong className="text-foreground">{topic}</strong> with {d.chunks || 12} vector-indexed chunk passages for grounded AI tutoring and quiz retrieval.
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>Uploaded by: <strong className="text-foreground">{d.uploadedByName || "Faculty"}</strong></span>
                          <span>·</span>
                          <span>Semester {d.semester || 5}</span>
                          <span>·</span>
                          <span>Indexed on: {d.uploadDate}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewPdfDoc(d)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/40 shadow-xs shrink-0 transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-violet" /> View Material
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Document Viewer Modal */}
      {viewPdfDoc && (
        <DocumentViewerModal
          docName={viewPdfDoc.name}
          fileType={viewPdfDoc.fileType}
          subjectName={subjects.find((s) => s.id === viewPdfDoc.subjectId)?.name || "Course Material"}
          uploadedBy={viewPdfDoc.uploadedByName || "Faculty"}
          uploadDate={viewPdfDoc.uploadDate}
          onClose={() => setViewPdfDoc(null)}
        />
      )}
    </div>
  );
}
