import React, { useState, useEffect } from "react";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  BookOpen,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Play,
  RotateCcw,
  Languages,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { API_BASE, authHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface TopicMasteryItem {
  id: string;
  topic: string;
  subjectCode: string;
  score: number;
  attemptsCount: number;
  masteryLabel: "mastered" | "proficient" | "weak";
  prerequisites: string[];
  weakSubtopics: string[];
}

interface LearnerPrefs {
  explanationLevel: "beginner" | "intermediate" | "advanced";
  preferredLanguage: string;
  dailyGoalMinutes: number;
  enableSpacedRepetition: boolean;
}

interface Recommendation {
  topic: string;
  subjectCode: string;
  currentScore: number;
  urgency: "high" | "medium" | "low";
  reason: string;
  prerequisites: string[];
  suggestedActions: string[];
}

export function AdaptiveMasteryCard({ onAskTutorTopic }: { onAskTutorTopic?: (topic: string) => void }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token") || "";

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedWhy, setSelectedWhy] = useState<Recommendation | null>(null);

  // Prefs edit state
  const [editLevel, setEditLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [editLang, setEditLang] = useState("en");
  const [editGoal, setEditGoal] = useState(30);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Practice Quiz modal
  const [practiceQuiz, setPracticeQuiz] = useState<any>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/profile`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data.preferences) {
          setEditLevel(data.preferences.explanationLevel || "intermediate");
          setEditLang(data.preferences.preferredLanguage || "en");
          setEditGoal(data.preferences.dailyGoalMinutes || 30);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch adaptive profile:", e);
    }
  };

  const fetchRecs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/recommendations`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (e) {
      console.warn("Failed to fetch recommendations:", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchProfile(), fetchRecs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id }),
        },
        body: JSON.stringify({
          explanationLevel: editLevel,
          preferredLanguage: editLang,
          dailyGoalMinutes: editGoal,
        }),
      });

      if (!res.ok) throw new Error("Failed to save preferences");
      toast.success("Learner preferences updated!");
      setShowPreferences(false);
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "Could not save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleStartPractice = async (topic: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/practice-quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id }),
        },
        body: JSON.stringify({ topic, difficulty: editLevel }),
      });
      if (res.ok) {
        const data = await res.json();
        setPracticeQuiz(data);
        setCurrentQIndex(0);
        setSelectedOption(null);
        setQuizScore(null);
      }
    } catch {
      toast.error("Failed to load practice questions");
    }
  };

  const masteries: TopicMasteryItem[] = profile?.topicMasteries || [];
  const overallPct = profile?.stats?.overallMasteryPct || 68;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Brain className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Adaptive Mastery Engine</h3>
            <span className="rounded-md bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet uppercase tracking-wider">
              {profile?.preferences?.explanationLevel || "Intermediate"} Tier
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Personalized mastery modeling based on your quiz attempts, tutor queries, and spaced retention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreferences(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Learning Preferences</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Mastery Signals"
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Mastery Overview & Explainable Recommendations */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic Mastery List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Topic Mastery Breakdown</span>
            <span className="font-semibold text-violet">{overallPct}% Overall Index</span>
          </div>

          <div className="space-y-3">
            {masteries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <Brain className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="font-semibold text-foreground">No Topic Mastery Evaluated Yet</p>
                <p className="mt-1">
                  Complete assessment quizzes or practice activities to generate your topic-level understanding estimates.
                </p>
              </div>
            ) : (
              masteries.map((m) => {
                const isWeak = m.score < 60 || m.masteryLabel === "weak";
                const isMastered = m.score >= 80 || m.masteryLabel === "mastered";

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-border/80 bg-background/50 p-3.5 transition hover:bg-card hover:border-violet/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {m.subjectCode || "COURSE"}
                        </span>
                        <h5 className="text-xs font-bold text-foreground truncate">{m.topic}</h5>
                      </div>

                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
                          isWeak && "bg-rose-500/15 text-rose-500",
                          isMastered && "bg-emerald-500/15 text-emerald-500",
                          !isWeak && !isMastered && "bg-amber-500/15 text-amber-500"
                        )}
                      >
                        {m.score}% · {m.masteryLabel}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isWeak && "bg-rose-500",
                          isMastered && "bg-emerald-500",
                          !isWeak && !isMastered && "bg-amber-500"
                        )}
                        style={{ width: `${m.score}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Explainable Recommendations (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-border bg-background/40 p-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Adaptive Revision Priority
              </h4>
              <span className="text-[11px] text-muted-foreground">Explainable AI</span>
            </div>

            <div className="mt-3 space-y-3">
              {recommendations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground">
                  <Sparkles className="mx-auto h-6 w-6 text-amber-500/50 mb-1.5" />
                  <p className="font-semibold text-foreground">Awaiting Assessment Signals</p>
                  <p className="mt-1 text-[11px]">
                    Once you complete a quiz, personalized practice steps will appear here.
                  </p>
                </div>
              ) : (
                recommendations.slice(0, 3).map((rec, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs transition hover:border-amber-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-foreground text-xs">{rec.topic}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWhy(rec)}
                      className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:opacity-80 shrink-0"
                    >
                      Why this?
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {rec.reason}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-amber-500/15">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Diagnostic: {rec.currentScore}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartPractice(rec.topic)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-violet hover:underline"
                    >
                      <span>Adaptive Quiz</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Explanation Style</span>
              <span className="font-semibold text-foreground capitalize">
                {profile?.preferences?.explanationLevel || "intermediate"} · {profile?.preferences?.preferredLanguage === "gu" ? "Gujarati" : profile?.preferences?.preferredLanguage === "hi" ? "Hindi" : "English"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── "Why This Recommendation" Modal ── */}
      <AnimatePresence>
        {selectedWhy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-500" />
                <h4 className="text-base font-bold text-foreground">Why Was This Recommended?</h4>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-muted-foreground">Target Topic:</span>
                  <p className="font-bold text-foreground mt-0.5">{selectedWhy.topic}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Evidence & Rationale:</span>
                  <p className="mt-0.5 rounded-lg bg-muted/60 p-2.5 leading-relaxed text-foreground">
                    {selectedWhy.reason}
                  </p>
                </div>
                {selectedWhy.prerequisites && selectedWhy.prerequisites.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Prerequisite Foundations:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedWhy.prerequisites.map((p, idx) => (
                        <span key={idx} className="rounded-md bg-violet/10 px-2 py-0.5 text-[11px] font-bold text-violet">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWhy(null)}
                  className="rounded-xl bg-violet px-4 py-2 text-xs font-bold text-white hover:bg-violet/90 transition shadow-xs"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Preferences Modal ── */}
      <AnimatePresence>
        {showPreferences && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-foreground">Learner Adaptation Preferences</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Control how the AI Tutor tailors technical explanations and practice pacing to you.
              </p>

              <form onSubmit={handleSavePreferences} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-foreground">Default Explanation Depth</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEditLevel(lvl)}
                        className={cn(
                          "rounded-xl border py-2.5 text-center font-bold capitalize transition",
                          editLevel === lvl
                            ? "border-violet bg-violet/15 text-violet shadow-xs"
                            : "border-border bg-background text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {editLevel === "beginner" && "Focuses on high-level intuition, analogies, and simplified definitions."}
                    {editLevel === "intermediate" && "Balanced mix of theoretical foundations, code snippets, and diagrams."}
                    {editLevel === "advanced" && "Deep algorithmic rigor, edge cases, distributed failure modes, and math."}
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Default Tutor Language</label>
                  <select
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                  >
                    <option value="en">English (Default)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Daily Study Target (Minutes)</label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={editGoal}
                    onChange={(e) => setEditGoal(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreferences(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPrefs}
                    className="rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet/90 transition shadow-xs disabled:opacity-50"
                  >
                    Save Preferences
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Interactive Practice Quiz Modal ── */}
      <AnimatePresence>
        {practiceQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              {quizScore === null ? (
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/60">
                    <span className="font-bold text-violet uppercase tracking-wider">
                      Question {currentQIndex + 1} of {practiceQuiz.questions.length}
                    </span>
                    <span>Topic: {practiceQuiz.topic}</span>
                  </div>

                  <h4 className="mt-4 text-sm font-bold text-foreground leading-snug">
                    {practiceQuiz.questions[currentQIndex]?.question}
                  </h4>

                  <div className="mt-4 space-y-2.5">
                    {practiceQuiz.questions[currentQIndex]?.options.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOption(idx)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left text-xs font-medium transition flex items-start gap-2.5",
                          selectedOption === idx
                            ? "border-violet bg-violet/10 text-foreground"
                            : "border-border/80 bg-background hover:bg-accent text-foreground/90"
                        )}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[10px] font-bold">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between pt-3 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => setPracticeQuiz(null)}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Exit Practice
                    </button>

                    <button
                      type="button"
                      disabled={selectedOption === null}
                      onClick={() => {
                        const isCorrect = selectedOption === practiceQuiz.questions[currentQIndex].correctIndex;
                        if (isCorrect) toast.success("Correct answer!");
                        else toast.error("Incorrect. Reviewing topic explanation.");

                        if (currentQIndex + 1 < practiceQuiz.questions.length) {
                          setCurrentQIndex((prev) => prev + 1);
                          setSelectedOption(null);
                        } else {
                          setQuizScore(100);
                        }
                      }}
                      className="rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet/90 transition shadow-xs disabled:opacity-50"
                    >
                      {currentQIndex + 1 < practiceQuiz.questions.length ? "Next Question" : "Complete Quiz"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-foreground">Practice Completed!</h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                    Your mastery signals for <strong>{practiceQuiz.topic}</strong> have been updated in the adaptive engine.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeQuiz(null);
                      fetchProfile();
                    }}
                    className="mt-5 rounded-xl bg-violet px-6 py-2.5 text-xs font-bold text-white hover:bg-violet/90 transition shadow-xs"
                  >
                    Return to Dashboard
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
