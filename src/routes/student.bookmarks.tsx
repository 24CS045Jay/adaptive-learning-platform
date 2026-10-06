import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Download, FileText, Plus, Trash2, CheckCircle2, Edit3, Sparkles } from "lucide-react";
import { PageHeader, Card, Pill, PrimaryButton, EmptyState } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/bookmarks")({
  head: () => ({
    meta: [
      { title: "Study Notebook & Saved Bookmarks · AI Tutor Student" },
      { name: "description", content: "Personal study notebook with saved AI tutor answers, formulas, and revision notes." },
    ],
  }),
  component: Bookmarks,
});

interface BookmarkItem {
  id: string;
  question: string;
  answer: string;
  subject: string;
  date: string;
  notes?: string;
}

const DEFAULT_INITIAL_BOOKMARKS: BookmarkItem[] = [
  {
    id: "bm_1",
    question: "Explain the Shuffle and Sort phase in Hadoop MapReduce with partition hash modulo.",
    answer: "In Hadoop MapReduce, intermediate mapper outputs are partitioned using hash(key) % numReducers and sorted locally in memory before being transferred across worker nodes to designated reducers.",
    subject: "Big Data Analytics",
    date: "2026-10-04",
    notes: "Crucial for exam Unit 2. Remember that Combiners run locally on mappers to reduce network traffic.",
  },
  {
    id: "bm_2",
    question: "Difference between L1 (Lasso) and L2 (Ridge) Regularization formulas.",
    answer: "L1 adds the sum of absolute weights penalty (Loss = MSE + λ ∑|w|), driving irrelevant feature weights to exact zero (sparsity). L2 adds squared weights (Loss = MSE + λ ∑w²), shrinking weights smoothly without zeroing them out.",
    subject: "Machine Learning",
    date: "2026-10-05",
    notes: "L1 for feature selection, L2 for preventing large exploding weights.",
  },
];

function Bookmarks() {
  const { subjects, bookmarks: contextBookmarks, addBookmark, updateBookmarkNote, removeBookmark } = useAppData();

  const items: BookmarkItem[] =
    contextBookmarks && contextBookmarks.length > 0 ? contextBookmarks : DEFAULT_INITIAL_BOOKMARKS;

  const [selectedSubject, setSelectedSubject] = useState("all");
  const [editingItem, setEditingItem]         = useState<BookmarkItem | null>(null);
  const [noteText, setNoteText]               = useState("");
  const [showAddModal, setShowAddModal]       = useState(false);
  const [newQuestion, setNewQuestion]         = useState("");
  const [newAnswer, setNewAnswer]             = useState("");
  const [newSubject, setNewSubject]           = useState(subjects[0]?.name ?? "Big Data Analytics");
  const [newNote, setNewNote]                 = useState("");
  const [exportBanner, setExportBanner]       = useState(false);

  const filtered = selectedSubject === "all"
    ? items
    : items.filter((b) => b.subject === selectedSubject);

  const handleSaveNote = () => {
    if (!editingItem) return;
    updateBookmarkNote(editingItem.id, noteText);
    setEditingItem(null);
    setNoteText("");
  };

  const handleCreateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    addBookmark({
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      subject: newSubject,
      notes: newNote.trim() || undefined,
    });

    setShowAddModal(false);
    setNewQuestion("");
    setNewAnswer("");
    setNewNote("");
  };

  const handleExportNotebook = () => {
    const markdownContent = [
      "# My AI Tutor Personal Study Notebook",
      `Exported: ${new Date().toLocaleDateString()}`,
      "---",
      "",
    ];

    filtered.forEach((b, i) => {
      markdownContent.push(`## ${i + 1}. [${b.subject}] ${b.question}`);
      markdownContent.push(`**Saved Date:** ${b.date}`);
      markdownContent.push(`**Answer:** ${b.answer}`);
      if (b.notes) markdownContent.push(`**Personal Note:** ${b.notes}`);
      markdownContent.push("");
    });

    const blob = new Blob([markdownContent.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study_notebook_${new Date().toISOString().split("T")[0]}.md`;
    a.click();

    setExportBanner(true);
    setTimeout(() => setExportBanner(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Personal Study Notebook & Bookmarks"
        subtitle={`Saved AI Tutor answers, formula citations, and personal notes for quick exam revision (${filtered.length} saved).`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent/50 shadow-xs transition"
            >
              <Plus className="h-4 w-4 text-muted-foreground" /> Add Study Note
            </button>
            <button
              type="button"
              onClick={handleExportNotebook}
              className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-hover shadow-xs transition"
            >
              <Download className="h-4 w-4" /> Export Notebook (.md)
            </button>
          </div>
        }
      />

      {exportBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-success/5 px-6 py-4 text-sm text-success font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Study Notebook exported as Markdown! File saved to your downloads folder.
        </div>
      )}

      {/* Filter Chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium mr-1">Filter Subject:</span>
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
          All Subjects ({items.length})
        </button>
        {subjects.map((s) => {
          const count = items.filter((b) => b.subject === s.name).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSubject(s.name)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                selectedSubject === s.name
                  ? "bg-violet text-white shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Bookmarks List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Bookmark}
              title="No bookmarks in this subject"
              description="Click 'Add Study Note' or bookmark answers directly from the Ask Tutor chat."
            />
          </Card>
        ) : (
          filtered.map((b) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet">
                    <Bookmark className="h-4 w-4 fill-violet/20" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{b.question}</span>
                      <Pill tone="indigo">{b.subject}</Pill>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-line bg-muted/20 p-3 rounded-xl border border-border/50">
                      {b.answer}
                    </p>

                    {b.notes && (
                      <div className="mt-2.5 flex items-start gap-2 text-xs text-violet font-medium bg-violet/5 p-2.5 rounded-xl border border-violet/15">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span><strong>Revision Note:</strong> {b.notes}</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Saved on: {b.date}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(b);
                          setNoteText(b.notes || "");
                        }}
                        className="text-violet hover:underline flex items-center gap-1 font-medium"
                      >
                        <Edit3 className="h-3 w-3" /> {b.notes ? "Edit Note" : "Add Note"}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeBookmark(b.id)}
                  className="text-muted-foreground hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-500/10 shrink-0"
                  title="Remove bookmark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit Note Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-serif text-lg font-bold text-foreground">Personal Revision Note</div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Exam Key Takeaway / Mnemonic
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write key reminders, formulas, or tricky exam tips..."
                rows={4}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-violet"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent/40"
              >
                Cancel
              </button>
              <PrimaryButton onClick={handleSaveNote}>
                Save Note
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add New Bookmark Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Bookmark className="h-5 w-5 text-violet" /> Save Study Note
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBookmark} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question / Concept
                </label>
                <input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. MapReduce Partitioning Formula"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Answer / Explanation Content
                </label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Paste or write explanation here..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Personal Revision Note (Optional)
                </label>
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Remember hash(key) % numReducers"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <PrimaryButton type="submit">
                  Save to Notebook
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
