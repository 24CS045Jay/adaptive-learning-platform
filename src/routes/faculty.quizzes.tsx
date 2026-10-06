import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  ListChecks,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { PageHeader, Card, Pill, PrimaryButton, EmptyState } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { generateQuizFromDoc, INITIAL_QUIZZES } from "@/lib/quiz-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/quizzes")({
  head: () => ({
    meta: [
      { title: "Quiz Manager & Assessment Studio · AI Tutor Faculty" },
      { name: "description", content: "Auto-generate adaptive quizzes from vector documents or manage course assessments." },
    ],
  }),
  component: QuizManager,
});

function QuizManager() {
  const { documents, subjects, quizzes: backendQuizzes, addQuiz, deleteQuiz } = useAppData();
  const { user } = useAuth();

  const approvedDocs = documents.filter((d) => d.status === "approved");

  // Fallback to initial quizzes if database has no quizzes yet
  const displayQuizzes =
    backendQuizzes && backendQuizzes.length > 0 ? backendQuizzes : INITIAL_QUIZZES;

  // Auto-generate Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(approvedDocs[0]?.id ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBanner, setGeneratedBanner] = useState(false);

  // Manual Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id ?? "");
  const [newTopicTag, setNewTopicTag] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [correctOpt, setCorrectOpt] = useState(0);

  // Expand quiz state
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);

  const handleGenerate = async () => {
    const doc = approvedDocs.find((d) => d.id === selectedDocId) ?? approvedDocs[0];
    if (!doc) return;

    const subj = subjects.find((s) => s.id === doc.subjectId);
    const facultyName = user?.name || doc.uploadedByName || "Dr. Nisha Shah";

    setIsGenerating(true);

    const generated = generateQuizFromDoc(
      doc.name,
      subj?.name ?? "Big Data Analytics",
      facultyName
    );

    // Map questions to backend schema
    const formattedQuestions = generated.questions.map((q) => ({
      text: q.prompt,
      type: q.type,
      options: q.options || [],
      correctOption: q.correctAnswer ?? 0,
      explanation: q.explanation || "",
      topicTag: doc.topicTag || subj?.name || "General",
      difficulty: q.difficulty || "medium",
    }));

    await addQuiz({
      subjectId: doc.subjectId,
      title: generated.title,
      isAiGenerated: true,
      questions: formattedQuestions,
    });

    setIsGenerating(false);
    setShowGenModal(false);
    setGeneratedBanner(true);
    setTimeout(() => setGeneratedBanner(false), 4000);
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !customQuestion.trim() || !opt0.trim() || !opt1.trim()) return;

    const questions = [
      {
        text: customQuestion.trim(),
        type: "mcq",
        options: [opt0.trim(), opt1.trim(), opt2.trim() || "N/A", opt3.trim() || "N/A"],
        correctOption: Number(correctOpt),
        explanation: "Configured by faculty instructor.",
        topicTag: newTopicTag.trim() || "Course Concept",
        difficulty: "medium",
      },
    ];

    await addQuiz({
      subjectId: newSubjectId || subjects[0]?.id || "",
      title: newTitle.trim(),
      isAiGenerated: false,
      questions,
    });

    setShowCreateModal(false);
    setNewTitle("");
    setCustomQuestion("");
    setOpt0("");
    setOpt1("");
    setOpt2("");
    setOpt3("");
    setGeneratedBanner(true);
    setTimeout(() => setGeneratedBanner(false), 4000);
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("Are you sure you want to delete this quiz assessment?")) {
      await deleteQuiz(id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Quiz Manager & Assessment Studio"
        subtitle="Auto-generate adaptive quizzes from vector document chunks or manually author subject assessments."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent/50 shadow-xs transition"
            >
              <Plus className="h-4 w-4 text-muted-foreground" /> Create Custom Quiz
            </button>
            <PrimaryButton icon={Sparkles} onClick={() => setShowGenModal(true)}>
              Auto-generate Quiz from Doc
            </PrimaryButton>
          </div>
        }
      />

      {generatedBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-success/5 px-6 py-4 text-sm text-success font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Quiz assessment published successfully! It is now live on the Student Portal.
        </div>
      )}

      {/* ── Quizzes List ── */}
      <div className="space-y-4">
        {displayQuizzes.length === 0 ? (
          <Card>
            <EmptyState
              icon={ListChecks}
              title="No quizzes available"
              description="Click 'Auto-generate Quiz from Doc' to generate questions from approved documents."
            />
          </Card>
        ) : (
          displayQuizzes.map((q: any) => {
            const isExpanded = expandedQuizId === q.id;
            const qCount = q.questions?.length || q.totalQuestions || 0;
            return (
              <Card key={q.id}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-brand/15 text-gold">
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-serif text-lg font-bold text-foreground truncate">{q.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {q.subjectName || "General"} · {qCount} Questions · Created by {q.createdBy || "Faculty"}
                        {q.isAiGenerated && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-violet">
                            <Sparkles className="h-3 w-3" /> AI-Generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Pill tone="green">Published</Pill>
                    <button
                      type="button"
                      onClick={() => setExpandedQuizId(isExpanded ? null : q.id)}
                      className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/40"
                    >
                      {isExpanded ? "Hide Questions" : "Inspect Questions"}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuiz(q.id)}
                      className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-500/10"
                      title="Delete quiz"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Questions List */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Assessment Questions ({q.questions?.length || 0})
                    </div>
                    {(q.questions || []).map((qn: any, idx: number) => {
                      const prompt = qn.text || qn.prompt;
                      const options = qn.options || [];
                      const correctIdx = qn.correctOption ?? qn.correctAnswer ?? 0;
                      return (
                        <div key={qn.id || idx} className="rounded-xl border border-border bg-accent/30 p-3.5 text-xs space-y-2">
                          <div className="flex items-center justify-between font-bold text-foreground">
                            <span>
                              Q{idx + 1}. {prompt}
                            </span>
                            <span className="rounded bg-violet/10 px-2 py-0.5 text-[10px] text-violet uppercase font-semibold">
                              {qn.type || "mcq"} · {qn.difficulty || "medium"}
                            </span>
                          </div>
                          {qn.codeSnippet && (
                            <pre className="rounded-lg bg-slate-900 p-2 text-[11px] text-indigo-300 font-mono overflow-x-auto">
                              {qn.codeSnippet}
                            </pre>
                          )}
                          {options.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-2">
                              {options.map((opt: string, optI: number) => (
                                <div
                                  key={optI}
                                  className={cn(
                                    "rounded-lg px-2.5 py-1 text-xs border",
                                    optI === correctIdx
                                      ? "border-green-500 bg-green-500/10 text-success font-semibold"
                                      : "border-border bg-background text-muted-foreground"
                                  )}
                                >
                                  {String.fromCharCode(65 + optI)}. {opt} {optI === correctIdx && "✓ (Correct)"}
                                </div>
                              ))}
                            </div>
                          )}
                          {qn.explanation && (
                            <div className="text-muted-foreground text-[11px] pt-1">
                              <span className="font-semibold text-foreground">Explanation:</span> {qn.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* ── Auto Generate Quiz Modal ── */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Sparkles className="h-5 w-5 text-violet" /> Auto-Generate Quiz
              </div>
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Source Document (Vector Store)
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-violet font-medium"
                >
                  {approvedDocs.length === 0 ? (
                    <option value="">No approved documents yet (Upload first)</option>
                  ) : (
                    approvedDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.fileType.toUpperCase()})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="rounded-xl border border-violet/20 bg-violet/5 p-3.5 text-xs text-violet leading-relaxed">
                The RAG pipeline will parse extracted passages and multi-modal chunks from this document to synthesize 5 adaptive questions. Once published, it instantly syncs to the student portal.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || approvedDocs.length === 0}
                className="flex items-center gap-2 rounded-xl bg-violet px-5 py-2 text-sm font-semibold text-white hover:bg-violet-hover shadow-sm disabled:opacity-50"
              >
                {isGenerating ? <Sparkles className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? "Generating Quiz…" : "Generate & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Create Quiz Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl space-y-4 border border-border my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Plus className="h-5 w-5 text-violet" /> Create Custom Quiz
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quiz Title
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Unit 2 Mid-Module Assessment"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-violet"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Topic Tag
                  </label>
                  <input
                    value={newTopicTag}
                    onChange={(e) => setNewTopicTag(e.target.value)}
                    placeholder="e.g. MapReduce"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-violet"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question Prompt
                </label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Enter question text here..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-violet"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Options & Correct Answer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={opt0}
                    onChange={(e) => setOpt0(e.target.value)}
                    placeholder="Option A"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none"
                    required
                  />
                  <input
                    value={opt1}
                    onChange={(e) => setOpt1(e.target.value)}
                    placeholder="Option B"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none"
                    required
                  />
                  <input
                    value={opt2}
                    onChange={(e) => setOpt2(e.target.value)}
                    placeholder="Option C"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none"
                  />
                  <input
                    value={opt3}
                    onChange={(e) => setOpt3(e.target.value)}
                    placeholder="Option D"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="text-muted-foreground font-medium">Correct Option:</span>
                  <select
                    value={correctOpt}
                    onChange={(e) => setCorrectOpt(Number(e.target.value))}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold"
                  >
                    <option value={0}>Option A</option>
                    <option value={1}>Option B</option>
                    <option value={2}>Option C</option>
                    <option value={3}>Option D</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <PrimaryButton type="submit">
                  Publish Quiz
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
