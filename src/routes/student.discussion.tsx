import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare, ThumbsUp, Plus, CheckCircle2, Tag, Search,
  CornerDownRight, User, ShieldCheck, Send, Lock,
} from "lucide-react";
import { PageHeader, Card, Pill, PrimaryButton } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/discussion")({
  component: StudentDiscussionPage,
});

function StudentDiscussionPage() {
  const { discussions, subjects, addDiscussionPost, addDiscussionAnswer, upvotePost } = useAppData();
  const { user } = useAuth();

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = (user as any)?.studentId ? String((user as any).studentId).toLowerCase() : "";

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
  const enrolledSubjectNames = new Set(enrolledSubjects.map((s) => s.name.toLowerCase()));
  const enrolledSubjectCodes = new Set(enrolledSubjects.map((s) => (s.code || "").toLowerCase()));

  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchTerm, setSearchTerm]           = useState<string>("");
  const [showNewPostModal, setShowNewPostModal] = useState<boolean>(false);

  // New Post Form state
  const [postTitle, setPostTitle]     = useState("");
  const [postSubject, setPostSubject] = useState(enrolledSubjects[0]?.name ?? "");
  const [postContent, setPostContent] = useState("");
  const [postTags, setPostTags]       = useState("General, Doubts");

  // Active answer input per post
  const [answerInput, setAnswerInput] = useState<Record<string, string>>({});

  const currentUserRole = user?.role === "faculty" ? "Faculty" : "Student";
  const currentUserName = user?.name ?? "Student";

  const filteredDiscussions = discussions.filter((p) => {
    const pSubj = (p.subjectName || "").toLowerCase();
    // Only show posts belonging to enrolled subjects
    if (!enrolledSubjectNames.has(pSubj) && !enrolledSubjectCodes.has(pSubj)) {
      return false;
    }
    if (selectedSubject !== "all" && p.subjectName !== selectedSubject) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    const subjectToUse = postSubject || enrolledSubjects[0]?.name || "General";

    addDiscussionPost({
      title: postTitle.trim(),
      content: postContent.trim(),
      author: currentUserName,
      authorRole: currentUserRole,
      subjectName: subjectToUse,
      tags: postTags.split(",").map((t) => t.trim()).filter(Boolean),
    });

    setPostTitle("");
    setPostContent("");
    setShowNewPostModal(false);
  };

  const handleAddAnswer = (postId: string) => {
    const text = answerInput[postId]?.trim();
    if (!text) return;

    addDiscussionAnswer(postId, text, currentUserName, currentUserRole);
    setAnswerInput((prev) => ({ ...prev, [postId]: "" }));
  };

  if (enrolledSubjects.length === 0) {
    return (
      <div>
        <PageHeader
          title="Peer-to-Peer Discussion Forums"
          subtitle="Ask questions, share insights, upvote answers, and get verified faculty responses."
        />
        <Card className="border-amber-500/30 bg-amber-500/5 p-8 text-center max-w-xl mx-auto my-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground">
            Discussions Locked — 0 Subjects Enrolled
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            You are not currently enrolled in any subjects. Discussion forums are organized by enrolled course cohorts. Please enroll in a subject to join classroom discussions and peer study groups.
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
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Peer-to-Peer Discussion Forums"
        subtitle="Ask questions, share insights, upvote answers, and get verified faculty responses."
        action={
          <PrimaryButton icon={Plus} onClick={() => setShowNewPostModal(true)}>
            Ask Question in Forum
          </PrimaryButton>
        }
      />

      {/* Filter & Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discussions by topic tag (#MapReduce), title, or question..."
            className="w-full text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-violet"
          >
            <option value="all">All Enrolled Subjects</option>
            {enrolledSubjects.map((s) => (
              <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Discussions Thread List */}
      <div className="space-y-6">
        {filteredDiscussions.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start gap-4">
              {/* Upvote Column */}
              <button
                type="button"
                onClick={() => upvotePost(p.id)}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-accent/40 px-3 py-2 text-muted-foreground hover:border-violet hover:bg-indigo-brand/5 hover:text-violet transition shrink-0"
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="mt-1 text-xs font-bold">{p.upvotes}</span>
              </button>

              {/* Main Content */}
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill tone="indigo">{p.subjectName}</Pill>
                    <span className="text-xs text-muted-foreground">
                      Posted by <strong className="text-foreground">{p.author}</strong> ({p.authorRole}) · {p.createdAt}
                    </span>
                  </div>
                </div>

                <div className="font-serif text-lg font-bold text-foreground leading-snug">
                  {p.title}
                </div>

                <p className="text-sm leading-relaxed text-foreground font-sans">
                  {p.content}
                </p>

                {/* Topic Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Answers Thread */}
                {p.answers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-violet" /> Answers ({p.answers.length})
                    </div>
                    {p.answers.map((ans) => (
                      <div
                        key={ans.id}
                        className={cn(
                          "rounded-xl border p-3.5 text-xs space-y-1.5 transition",
                          ans.isFacultyVerified
                            ? "border-green-200 bg-success/5/50"
                            : "border-border bg-accent/40"
                        )}
                      >
                        <div className="flex items-center justify-between font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{ans.author}</span>
                            {ans.isFacultyVerified && (
                              <span className="flex items-center gap-1 rounded bg-green-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                                <ShieldCheck className="h-3 w-3" /> Faculty Verified Answer
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-normal">{ans.createdAt}</span>
                        </div>
                        <p className="text-foreground leading-relaxed font-sans">{ans.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Bar */}
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-border">
                  <input
                    value={answerInput[p.id] ?? ""}
                    onChange={(e) => setAnswerInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddAnswer(p.id)}
                    placeholder="Write an answer or insight to help your peers..."
                    className="flex-1 rounded-xl border border-border bg-accent/40 px-3.5 py-2 text-xs outline-none focus:border-violet focus:bg-card"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddAnswer(p.id)}
                    disabled={!answerInput[p.id]?.trim()}
                    className="flex items-center gap-1 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet-hover disabled:opacity-50 transition"
                  >
                    <Send className="h-3.5 w-3.5" /> Post Answer
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── New Post Modal ── */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <MessageSquare className="h-5 w-5 text-violet" /> Ask a Question in Forum
              </div>
              <button
                type="button"
                onClick={() => setShowNewPostModal(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Subject
                </label>
                <select
                  value={postSubject || enrolledSubjects[0]?.name || ""}
                  onChange={(e) => setPostSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-violet font-medium"
                >
                  {enrolledSubjects.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. Difference between Spark RDD and DataFrame execution?"
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Topic Tags (Comma-separated)
                </label>
                <input
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  placeholder="MapReduce, HDFS, Spark"
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question Details / Context <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Explain what you are trying to understand..."
                  rows={4}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet px-5 py-2 text-sm font-semibold text-white hover:bg-violet-hover shadow-sm"
                >
                  Post Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
