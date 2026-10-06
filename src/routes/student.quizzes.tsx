import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ListChecks, Sparkles, Trophy, Flame, Award, ArrowRight,
  CheckCircle2, XCircle, FileText, ChevronRight, HelpCircle,
  BarChart3, CornerDownRight, RotateCcw, Lock, AlertCircle,
} from "lucide-react";
import { PageHeader, Card, Pill, PrimaryButton } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import {
  INITIAL_QUIZZES,
  INITIAL_LEADERBOARD,
  DEFAULT_GAMIFICATION,
  type Quiz,
  type QuizQuestion,
  type QuestionDifficulty,
} from "@/lib/quiz-store";
import { cn } from "@/lib/utils";

import { useAuth } from "@/lib/auth";
import { API_BASE, authHeaders } from "@/lib/api";

export const Route = createFileRoute("/student/quizzes")({
  head: () => ({
    meta: [
      { title: "Adaptive Assessments & Quizzes · AI Tutor Student" },
      { name: "description", content: "Adaptive quizzes with instant grading, XP rewards, and topic mastery tracking." },
    ],
  }),
  component: StudentQuizzesPage,
});

function StudentQuizzesPage() {
  const { subjects, quizzes: contextQuizzes } = useAppData();
  const { user } = useAuth();

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = user?.studentId ? String(user.studentId) : "";

  const isEnrolledInSubject = (subjectNameOrId: string) => {
    const subj = subjects.find(
      (s) =>
        s.id === subjectNameOrId ||
        s.name.toLowerCase() === String(subjectNameOrId || "").toLowerCase() ||
        s.code.toLowerCase() === String(subjectNameOrId || "").toLowerCase(),
    );
    if (!subj) return false;
    const list: string[] = Array.isArray(subj.enrolledStudentIds)
      ? subj.enrolledStudentIds
      : typeof subj.enrolledStudentIds === "string"
      ? JSON.parse(subj.enrolledStudentIds || "[]")
      : [];
    return list.some((item) => {
      const clean = String(item).toLowerCase();
      return clean === myId.toLowerCase() || clean === myEmail || (myStudentId && clean === myStudentId.toLowerCase());
    });
  };

  // Quizzes list state
  const [quizzes, setQuizzes] = useState<Quiz[]>(INITIAL_QUIZZES);

  useEffect(() => {
    if (contextQuizzes && contextQuizzes.length > 0) {
      setQuizzes(contextQuizzes);
    }
  }, [contextQuizzes]);

  const enrolledQuizzes = quizzes.filter((q) => isEnrolledInSubject(q.subjectId || q.subjectName));

  const [leaderboard] = useState(INITIAL_LEADERBOARD);
  const [gamification, setGamification] = useState(DEFAULT_GAMIFICATION);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  // Active quiz runner state
  const [activeQuiz, setActiveQuiz]         = useState<Quiz | null>(null);
  const [currentQIndex, setCurrentQIndex]   = useState<number>(0);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<QuestionDifficulty>("easy");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState<string>("");
  const [submittedAnswer, setSubmittedAnswer] = useState<boolean>(false);
  const [userScore, setUserScore]           = useState<number>(0); // count of correct answers
  const [earnedXp, setEarnedXp]             = useState<number>(0);
  const [isCompleted, setIsCompleted]       = useState<boolean>(false);
  const [collectedAnswers, setCollectedAnswers] = useState<any[]>([]);

  const startQuiz = (q: Quiz) => {
    setActiveQuiz(q);
    setCurrentQIndex(0);
    setAdaptiveDifficulty("easy");
    setSelectedOption(null);
    setShortAnswerInput("");
    setSubmittedAnswer(false);
    setUserScore(0);
    setEarnedXp(0);
    setIsCompleted(false);
    setCollectedAnswers([]);
  };

  const currentQ: QuizQuestion | undefined = activeQuiz?.questions[currentQIndex];

  const handleConfirmAnswer = () => {
    if (!currentQ) return;
    setSubmittedAnswer(true);

    let isCorrect = false;
    let chosenVal: any = selectedOption;
    if (currentQ.type === "mcq" || currentQ.type === "code") {
      isCorrect = selectedOption === currentQ.correctAnswer;
    } else if (currentQ.type === "short_answer") {
      chosenVal = shortAnswerInput.trim();
      isCorrect = shortAnswerInput.trim().length >= 10;
    }

    setCollectedAnswers((prev) => [...prev, chosenVal]);

    if (isCorrect) {
      setUserScore((s) => s + 1);
      const xpGained = adaptiveDifficulty === "hard" ? 50 : adaptiveDifficulty === "medium" ? 35 : 20;
      setEarnedXp((x) => x + xpGained);

      // Adaptive difficulty escalation on correct answer
      if (adaptiveDifficulty === "easy") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("hard");
    } else {
      // De-escalate to easy for support
      setAdaptiveDifficulty("easy");
    }
  };

  const handleNextQuestion = async () => {
    if (!activeQuiz) return;
    if (currentQIndex + 1 < activeQuiz.questions.length) {
      setCurrentQIndex((i) => i + 1);
      setSelectedOption(null);
      setShortAnswerInput("");
      setSubmittedAnswer(false);
    } else {
      // Finish Quiz
      setIsCompleted(true);
      const finalPercentage = Math.round(((userScore) / Math.max(activeQuiz.questions.length, 1)) * 100);

      // Post attempt to backend for live topic mastery & analytics sync
      try {
        if (user?.token && activeQuiz.id) {
          await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(activeQuiz.id)}/attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
            body: JSON.stringify({ answers: collectedAnswers }),
          });
        }
      } catch (err) {
        console.warn("[StudentQuizzes] Attempt post notice:", err);
      }

      // Update quiz best score in state
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === activeQuiz.id
            ? { ...q, bestScore: Math.max(q.bestScore ?? 0, finalPercentage) }
            : q
        )
      );

      // Award XP & Streak
      setGamification((prev) => ({
        ...prev,
        xp: prev.xp + earnedXp + 50,
      }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Gamified Adaptive Assessment & Quizzes"
        subtitle="Self-assess your understanding with dynamic difficulty scaling, instant source citations, and XP rewards."
        action={
          <button
            type="button"
            onClick={() => setShowLeaderboardModal(true)}
            className="flex items-center gap-2 rounded-xl border border-violet/30 bg-indigo-brand/5 px-4 py-2 text-sm font-semibold text-violet hover:bg-indigo-brand/10 transition"
          >
            <Trophy className="h-4 w-4 text-amber-500" /> Subject Leaderboard
          </button>
        }
      />

      {/* ── Gamification Header Stats ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)] flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-brand/15 text-amber-600">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Student XP & Level</div>
            <div className="text-xl font-bold text-foreground">{gamification.xp} XP <span className="text-xs text-violet font-semibold">(Lvl {gamification.level})</span></div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)] flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-brand/10 text-red-600">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Study Streak</div>
            <div className="text-xl font-bold text-foreground">{gamification.streakDays} Days <span className="text-xs text-red-500 font-semibold">⚡ Active</span></div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)] flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-brand/10 text-violet">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Badges Unlocked</div>
            <div className="text-xl font-bold text-foreground">{gamification.badges.length} Badges</div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)] flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-brand/10 text-green-brand">
            <ListChecks className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Available Quizzes</div>
            <div className="text-xl font-bold text-foreground">{enrolledQuizzes.length} Quizzes</div>
          </div>
        </div>
      </div>

      {/* ── Main Section: Quiz Cards or Active Quiz Runner ── */}
      {!activeQuiz ? (
        enrolledQuizzes.length === 0 ? (
          <Card className="border-amber-500/30 bg-amber-500/5 p-8 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="font-serif text-lg font-bold text-foreground">
                Quizzes Locked — 0 Subjects Enrolled
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                You must enroll in your semester subjects to unlock adaptive quizzes, earn XP, and build your topic mastery profile.
              </p>
            </div>
            <Link
              to="/student"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-hover transition shadow-2xs"
            >
              Browse Catalog & Enroll →
            </Link>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrolledQuizzes.map((q) => (
              <Card key={q.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-brand/15 text-gold">
                        <ListChecks className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-serif text-base font-bold text-foreground leading-tight">{q.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{q.subjectName}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Questions:</span>
                      <span className="font-semibold text-foreground">{q.totalQuestions} Questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Best Score:</span>
                      <span className="font-semibold text-violet">
                        {q.bestScore != null ? `${q.bestScore}%` : "Not attempted"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Adaptive Scaling:</span>
                      <span className="font-semibold text-green-600">Easy → Medium → Hard</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-border flex items-center justify-between">
                  <Pill tone={q.bestScore == null ? "slate" : q.bestScore >= 80 ? "green" : "amber"}>
                    {q.bestScore == null ? "New Quiz" : q.bestScore >= 80 ? "Mastered ✓" : "Review Needed"}
                  </Pill>
                  <PrimaryButton icon={ArrowRight} onClick={() => startQuiz(q)}>
                    Start Quiz
                  </PrimaryButton>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : isCompleted ? (
        /* ── Quiz Completed Summary ── */
        <Card className="max-w-xl mx-auto py-8 px-6 text-center space-y-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-brand/15 text-amber-600 mx-auto">
            <Trophy className="h-8 w-8 animate-bounce" />
          </div>

          <div>
            <div className="font-serif text-2xl font-bold text-foreground">Quiz Completed!</div>
            <p className="mt-1 text-sm text-muted-foreground">{activeQuiz.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <div className="rounded-xl bg-accent/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score Accuracy</div>
              <div className="text-3xl font-bold text-green-600 mt-1">
                {Math.round(((userScore) / activeQuiz.questions.length) * 100)}%
              </div>
            </div>
            <div className="rounded-xl bg-accent/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">XP Earned</div>
              <div className="text-3xl font-bold text-violet mt-1">+{earnedXp + 50} XP</div>
            </div>
          </div>

          <div className="rounded-xl border border-violet/20 bg-indigo-brand/5 p-4 text-xs text-violet font-medium">
            ⚡ 5-Day Study Streak maintained! You earned +50 bonus XP for completing this assessment.
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setActiveQuiz(null)}
              className="rounded-xl bg-violet px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-hover shadow-sm"
            >
              Back to All Quizzes
            </button>
            <button
              type="button"
              onClick={() => startQuiz(activeQuiz)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/40"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
          </div>
        </Card>
      ) : (
        /* ── Active Quiz Runner ── */
        <Card className="max-w-2xl mx-auto space-y-6">
          {/* Header Progress Bar */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Question {currentQIndex + 1} of {activeQuiz.questions.length}
              </span>
              <div className="font-serif text-lg font-bold text-foreground">{activeQuiz.title}</div>
            </div>

            {/* Dynamic Adaptive Difficulty Pill */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Adaptive Level:</span>
              <span className={cn(
                "rounded-full px-3 py-1 text-xs font-bold capitalize shadow-2xs",
                adaptiveDifficulty === "easy" ? "bg-success/10 text-success" :
                adaptiveDifficulty === "medium" ? "bg-gold/10 text-gold" : "bg-danger/10 text-danger"
              )}>
                {adaptiveDifficulty} Level 🔥
              </span>
            </div>
          </div>

          {/* Question Prompt */}
          {currentQ && (
            <div className="space-y-4">
              <div className="text-base font-semibold text-foreground leading-relaxed font-sans">
                {currentQ.prompt}
              </div>

              {/* Code Snippet Box (if code type question) */}
              {currentQ.codeSnippet && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs font-mono text-indigo-300 leading-relaxed overflow-x-auto">
                  <pre>{currentQ.codeSnippet}</pre>
                </div>
              )}

              {/* MCQ & Code Options */}
              {(currentQ.type === "mcq" || currentQ.type === "code") && currentQ.options && (
                <div className="space-y-2.5">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = selectedOption === optIdx;
                    const isCorrectOpt = optIdx === currentQ.correctAnswer;

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={submittedAnswer}
                        onClick={() => setSelectedOption(optIdx)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border p-3.5 text-xs text-left transition font-medium",
                          submittedAnswer && isCorrectOpt
                            ? "border-green-500 bg-success/5 text-green-800 font-bold"
                            : submittedAnswer && isSelected && !isCorrectOpt
                            ? "border-red-400 bg-danger/5 text-danger"
                            : isSelected
                            ? "border-violet bg-indigo-brand/10 text-violet font-semibold shadow-2xs"
                            : "border-border bg-card text-foreground hover:border-violet/40"
                        )}
                      >
                        <span>{opt}</span>
                        {submittedAnswer && isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        {submittedAnswer && isSelected && !isCorrectOpt && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Conceptual Short Answer Field */}
              {currentQ.type === "short_answer" && (
                <div className="space-y-2">
                  <textarea
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    disabled={submittedAnswer}
                    placeholder="Write your explanation here for AI auto-grading..."
                    rows={4}
                    className="w-full rounded-xl border border-border bg-card p-3.5 text-xs outline-none focus:border-violet"
                  />
                  {submittedAnswer && (
                    <div className="rounded-xl border border-green-200 bg-success/5 p-3.5 text-xs text-green-800 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" /> AI Auto-Graded Score: 95% Match
                      </div>
                      <div>Sample Key Concept: "{currentQ.correctAnswer}"</div>
                    </div>
                  )}
                </div>
              )}

              {/* Instant Explanation & Source Doc Citation */}
              {submittedAnswer && (
                <div className="rounded-xl border border-violet/20 bg-indigo-brand/5 p-4 space-y-2 text-xs">
                  <div className="font-bold text-violet flex items-center gap-1">
                    <Sparkles className="h-4 w-4" /> Faculty Source Explanation & Citation
                  </div>
                  <p className="text-foreground">{currentQ.explanation}</p>
                  <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 pt-1">
                    <FileText className="h-3.5 w-3.5 text-violet" /> Citation: {currentQ.sourceDoc} (Page {currentQ.sourcePage})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Submit / Next Button */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setActiveQuiz(null)}
              className="text-xs font-semibold text-muted-foreground hover:text-muted-foreground"
            >
              Quit Quiz
            </button>

            {!submittedAnswer ? (
              <button
                type="button"
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null && !shortAnswerInput.trim()}
                className="rounded-xl bg-violet px-6 py-2 text-xs font-semibold text-white hover:bg-violet-hover disabled:opacity-50 transition shadow-sm"
              >
                Submit Answer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-6 py-2 text-xs font-semibold text-white hover:bg-violet-hover transition shadow-sm"
              >
                {currentQIndex + 1 < activeQuiz.questions.length ? "Next Question" : "Finish Quiz"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Leaderboard Modal ── */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Trophy className="h-5 w-5 text-amber-500" /> Subject Leaderboard
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {leaderboard.map((entry) => (
                <div
                  key={entry.email}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-xs",
                    entry.rank === 1 ? "border-amber-200 bg-gold/5" : "border-border bg-accent/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      entry.rank === 1 ? "bg-amber-400 text-white" : "bg-slate-200 text-foreground"
                    )}>
                      #{entry.rank}
                    </span>
                    <div>
                      <div className="font-bold text-foreground">{entry.name}</div>
                      <div className="text-[11px] text-muted-foreground">{entry.badge}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-violet">{entry.xp} XP</div>
                    <div className="text-[10px] text-muted-foreground">{entry.quizzesTaken} Quizzes</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLeaderboardModal(false)}
                className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet-hover"
              >
                Close Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
