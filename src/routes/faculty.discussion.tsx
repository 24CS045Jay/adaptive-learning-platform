import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare, ThumbsUp, Plus, Tag, Search,
  ShieldCheck, Send, CheckCircle2,
} from "lucide-react";
import { PageHeader, Card, Pill, PrimaryButton, EmptyState } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/discussion")({
  head: () => ({
    meta: [
      { title: "Discussion Forums · Faculty Portal" },
      { name: "description", content: "Faculty view and verified answers for student peer discussion forums." },
    ],
  }),
  component: FacultyDiscussionPage,
});

function FacultyDiscussionPage() {
  const { discussions, subjects, addDiscussionPost, addDiscussionAnswer, upvotePost } = useAppData();
  const { user } = useAuth();

  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showNewPostModal, setShowNewPostModal] = useState<boolean>(false);

  // New Post Form state
  const [postTitle, setPostTitle] = useState("");
  const [postSubject, setPostSubject] = useState(subjects[0]?.name ?? "Big Data Analytics");
  const [postContent, setPostContent] = useState("");
  const [postTags, setPostTags] = useState("Faculty Guidance, Exam Prep");

  // Active answer input per post
  const [answerInput, setAnswerInput] = useState<Record<string, string>>({});

  const currentUserName = user?.name ?? "Faculty Member";

  const filteredDiscussions = discussions.filter((p) => {
    if (selectedSubject !== "all" && p.subjectName !== selectedSubject) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    addDiscussionPost({
      title: postTitle.trim(),
      content: postContent.trim(),
      author: currentUserName,
      authorRole: "Faculty",
      subjectName: postSubject,
      tags: postTags.split(",").map((t) => t.trim()).filter(Boolean),
    });

    setPostTitle("");
    setPostContent("");
    setShowNewPostModal(false);
  };

  const handleAddAnswer = (postId: string) => {
    const text = answerInput[postId]?.trim();
    if (!text) return;

    addDiscussionAnswer(postId, text, currentUserName, "Faculty");
    setAnswerInput((prev) => ({ ...prev, [postId]: "" }));
  };

  return (
    <div>
      <PageHeader
        title="Faculty Discussion Forums"
        subtitle="Review student questions, post verified official answers, and provide academic guidance."
        action={
          <PrimaryButton icon={Plus} onClick={() => setShowNewPostModal(true)}>
            Start Discussion / Post Guide
          </PrimaryButton>
        }
      />

      {/* Filter & Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discussion topics, student questions, or tags..."
            className="w-full text-sm outline-none placeholder:text-muted-foreground bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-violet"
          >
            <option value="all">All Subjects ({subjects.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Discussions Thread List */}
      <div className="space-y-6">
        {filteredDiscussions.length === 0 ? (
          <Card>
            <EmptyState
              icon={MessageSquare}
              title="No discussion posts found"
              description={searchTerm ? "Try adjusting your search criteria." : "Student discussion threads will appear here."}
            />
          </Card>
        ) : (
          filteredDiscussions.map((p) => (
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
                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Answer List */}
                  {p.answers && p.answers.length > 0 && (
                    <div className="mt-4 space-y-3 border-t border-border/80 pt-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Replies ({p.answers.length})
                      </div>
                      {p.answers.map((ans) => (
                        <div
                          key={ans.id}
                          className={cn(
                            "rounded-xl p-3.5 text-xs space-y-1.5",
                            ans.isFacultyVerified
                              ? "border border-green-200 bg-success/5 text-foreground"
                              : "border border-border bg-accent/30 text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              {ans.isFacultyVerified && (
                                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                              )}
                              <span>{ans.author}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({ans.authorRole}) · {ans.createdAt}
                              </span>
                            </div>
                            {ans.isFacultyVerified && (
                              <Pill tone="green">Verified Faculty Answer ✓</Pill>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed font-sans">{ans.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Post Faculty Answer Input */}
                  <div className="mt-4 flex gap-2 border-t border-border/60 pt-3">
                    <input
                      value={answerInput[p.id] ?? ""}
                      onChange={(e) =>
                        setAnswerInput((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleAddAnswer(p.id)}
                      placeholder="Write official verified faculty answer..."
                      className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs outline-none focus:border-violet font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAnswer(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-hover transition shadow-xs"
                    >
                      <Send className="h-3.5 w-3.5" /> Reply as Faculty
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* New Post Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-foreground">
              Create New Forum Topic / Faculty Guide
            </h3>

            <form onSubmit={handleCreatePost} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Subject
                </label>
                <select
                  value={postSubject}
                  onChange={(e) => setPostSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-violet"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Topic Title
                </label>
                <input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g., Guidance on Unit 4 MapReduce Optimization"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-violet"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Details & Instructions
                </label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Provide detailed instructions, study tips, or prompt questions for students..."
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-normal outline-none focus:border-violet font-sans"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  placeholder="e.g., ExamPrep, MapReduce, Unit4"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-violet"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet-hover shadow-xs"
                >
                  Publish Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
