import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Target, Check, Trophy, Plus, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, Card, Pill, PrimaryButton } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/planner")({
  head: () => ({
    meta: [
      { title: "AI Study Planner & Remediation · AI Tutor Student" },
      { name: "description", content: "Targeted revision plan tailored to weak topics and exam prep." },
    ],
  }),
  component: Planner,
});

interface TopicRemediation {
  topic: string;
  subject: string;
  reason: string;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low";
  estMinutes: number;
  summary: {
    keyConcept: string;
    formulasOrCode: string;
    commonPitfall: string;
  };
}

const INITIAL_REMEDIATIONS: TopicRemediation[] = [
  {
    topic: "MapReduce Shuffle & Sort",
    subject: "Big Data Analytics",
    reason: "Low accuracy on Unit 1 assessment",
    status: "pending",
    priority: "high",
    estMinutes: 20,
    summary: {
      keyConcept: "Shuffle phase transfers intermediate map outputs over the network to reducers. Map output is partitioned by key hash modulo reducer count.",
      formulasOrCode: "partition = hash(key) % numReducers\nSort: Key-Value pairs sorted in memory buffer before disk spill.",
      commonPitfall: "Forgetting that Combiners run locally on Mappers, not on Reducers. Combiners must be commutative and associative.",
    },
  },
  {
    topic: "L1 vs L2 Regularization",
    subject: "Machine Learning",
    reason: "Struggled on question 2 in Supervised Learning assessment",
    status: "pending",
    priority: "high",
    estMinutes: 15,
    summary: {
      keyConcept: "L1 (Lasso) adds absolute weight penalty |w| inducing sparsity. L2 (Ridge) adds squared weight penalty w^2 shrinking weights smoothly.",
      formulasOrCode: "Loss_L1 = MSE + λ ∑ |w_i|\nLoss_L2 = MSE + λ ∑ (w_i)^2",
      commonPitfall: "Confusing L1 (feature selection) with L2 (prevents large weights without zeroing them out).",
    },
  },
  {
    topic: "Speculative Execution",
    subject: "Big Data Analytics",
    reason: "Missed speculative execution trigger condition",
    status: "completed",
    priority: "medium",
    estMinutes: 10,
    summary: {
      keyConcept: "Hadoop launches duplicate tasks for slow worker nodes ('stragglers'). The first copy to complete is accepted; the redundant one is killed.",
      formulasOrCode: "Trigger condition: Task execution progress < 0.2 * cluster average progress rate.",
      commonPitfall: "Assuming speculative execution handles node crashes. It handles stragglers; Heartbeat timeouts handle crashes.",
    },
  },
];

/* ── Enhanced Confetti Burst (20 particles) ── */
function ConfettiBurst() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    angle: (i / 20) * 360,
    color: i % 4 === 0 ? "#8b5cf6" : i % 4 === 1 ? "#f5c451" : i % 4 === 2 ? "#34d399" : "#fb7185",
    size: 4 + (i % 3) * 2,
    speed: 24 + (i % 5) * 6,
    rotSpeed: 120 + (i % 3) * 60,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {particles.map((d, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            scale: [0, 1, 0.6, 0],
            x: Math.cos((d.angle * Math.PI) / 180) * d.speed,
            y: Math.sin((d.angle * Math.PI) / 180) * d.speed,
            opacity: [1, 1, 0.5, 0],
            rotate: d.rotSpeed,
          }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="absolute rounded-sm"
          style={{ width: d.size, height: d.size, background: d.color }}
        />
      ))}
    </div>
  );
}

/* ── Priority Badge ── */
function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-500/10 text-red-500 border border-red-500/20",
    medium: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    low: "bg-green-500/10 text-green-500 border border-green-500/20",
  };
  const labels = { high: "High Priority", medium: "Medium", low: "Low" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", styles[priority])}>
      {labels[priority]}
    </span>
  );
}

function Planner() {
  const { subjects } = useAppData();
  const [items, setItems] = useState<TopicRemediation[]>(() => {
    try {
      const saved = localStorage.getItem("ai_tutor_study_planner_tasks");
      return saved ? JSON.parse(saved) : INITIAL_REMEDIATIONS;
    } catch {
      return INITIAL_REMEDIATIONS;
    }
  });

  const [inspectItem, setInspectItem] = useState<TopicRemediation | null>(null);
  const [burstId, setBurstId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Target Modal State
  const [newTopic, setNewTopic] = useState("");
  const [newSubject, setNewSubject] = useState(subjects[0]?.name ?? "Big Data Analytics");
  const [newReason, setNewReason] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("high");
  const [newEst, setNewEst] = useState(15);

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const totalCount = Math.max(items.length, 1);
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const isAllDone = completedCount === items.length && items.length > 0;

  const saveItems = (updated: TopicRemediation[]) => {
    setItems(updated);
    try {
      localStorage.setItem("ai_tutor_study_planner_tasks", JSON.stringify(updated));
    } catch {}
  };

  const toggleStatus = (topicName: string) => {
    const updated = items.map((i) => {
      if (i.topic !== topicName) return i;
      const next = i.status === "pending" ? ("completed" as const) : ("pending" as const);
      if (next === "completed") setBurstId(topicName);
      return { ...i, status: next };
    });
    saveItems(updated);
    setTimeout(() => setBurstId(null), 700);
  };

  const handleAddTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    const newTask: TopicRemediation = {
      topic: newTopic.trim(),
      subject: newSubject,
      reason: newReason.trim() || "Targeted for midterm revision",
      status: "pending",
      priority: newPriority,
      estMinutes: Number(newEst) || 15,
      summary: {
        keyConcept: `Core principles and architecture of ${newTopic.trim()} for ${newSubject}.`,
        formulasOrCode: "Key algorithmic rules and execution conditions defined in lecture slides.",
        commonPitfall: "Review previous quiz misconceptions and unit learning outcomes.",
      },
    };

    saveItems([newTask, ...items]);
    setShowAddModal(false);
    setNewTopic("");
    setNewReason("");
  };

  return (
    <div>
      <PageHeader
        title="AI Personal Study Planner & Remediation"
        subtitle="Dynamic revision schedule generated from your quiz weak points — prioritize these before your end-semester exam."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent/50 shadow-xs transition"
            >
              <Plus className="h-4 w-4 text-muted-foreground" /> Add Study Target
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-violet/20 bg-violet/5 px-4 py-2 text-xs font-bold text-violet">
              <Target className="h-4 w-4" /> Exam In: 12 Days
            </div>
          </div>
        }
      />

      {/* Progress Card */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground flex items-center gap-2">
            {isAllDone && <Trophy className="h-4 w-4 text-amber-500" />}
            {isAllDone ? "🎉 All scheduled topics mastered!" : `${completedCount} of ${items.length} topics mastered`}
          </span>
          <span className={cn("font-bold text-base tabular-nums", isAllDone ? "text-success" : "text-violet")}>
            {progressPct}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={cn("h-full rounded-full bg-gradient-to-r from-violet to-emerald-500")}
          />
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
          <span>{completedCount} completed</span>
          <span>·</span>
          <span>{pendingCount} remaining</span>
          <span>·</span>
          <span>~{items.filter((i) => i.status === "pending").reduce((a, i) => a + i.estMinutes, 0)} min to go</span>
        </div>
      </div>

      {/* Stat mini-cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Needs Revision</div>
          <div className="mt-2 text-2xl font-bold text-amber-500 tabular-nums">{pendingCount} Topics</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revised & Mastered</div>
          <div className="mt-2 text-2xl font-bold text-green-500 tabular-nums">{completedCount} Topics</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remediation Mastery</div>
          <div className="mt-2 text-2xl font-bold text-violet tabular-nums">{progressPct}%</div>
        </div>
      </div>

      <Card>
        <div className="space-y-3">
          {items.map((item) => (
            <motion.div
              key={item.topic}
              layout
              className={cn(
                "relative flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all",
                item.status === "completed"
                  ? "border-green-500/20 bg-green-500/5 opacity-75"
                  : "border-border bg-background hover:border-violet/25"
              )}
            >
              {burstId === item.topic && <ConfettiBurst />}

              <div className="flex items-start gap-3.5 min-w-0">
                <motion.button
                  type="button"
                  onClick={() => toggleStatus(item.topic)}
                  whileTap={{ scale: 0.8 }}
                  className={cn(
                    "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                    item.status === "completed"
                      ? "bg-green-600 text-white shadow-sm"
                      : "border-2 border-border text-transparent hover:border-green-500"
                  )}
                  title="Toggle complete"
                >
                  <AnimatePresence mode="wait">
                    {item.status === "completed" && (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <Check className="h-4 w-4" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <div className="min-w-0">
                  <div
                    className={cn(
                      "font-semibold text-foreground transition-all text-sm",
                      item.status === "completed" && "line-through text-muted-foreground"
                    )}
                  >
                    {item.topic}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Pill tone="indigo">{item.subject}</Pill>
                    <PriorityBadge priority={item.priority} />
                    <span>Est. {item.estMinutes} min</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Reason: {item.reason}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/student/ask"
                  className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                  title="Ask AI Tutor about this topic"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Practice
                </Link>
                <button
                  type="button"
                  onClick={() => setInspectItem(item)}
                  className="flex items-center gap-1.5 rounded-xl border border-violet/25 bg-violet/5 px-3.5 py-1.5 text-xs font-semibold text-violet transition hover:bg-violet/15"
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI Summary
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* AI Summary Modal */}
      <AnimatePresence>
        {inspectItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 14 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                    <Sparkles className="h-5 w-5 text-violet" /> {inspectItem.topic}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {inspectItem.subject} · AI Remediation Guide
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectItem(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="rounded-xl border border-violet/20 bg-violet/5 p-3.5 space-y-1">
                  <div className="font-bold text-violet uppercase text-[10px] tracking-wider">
                    Core Concept Breakdown
                  </div>
                  <p className="text-foreground font-sans">{inspectItem.summary.keyConcept}</p>
                </div>

                <div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
                  <div className="font-bold text-violet uppercase text-[10px] tracking-wider">
                    Key Formula / Execution Rule
                  </div>
                  <pre className="text-foreground font-mono text-[11px] whitespace-pre-wrap opacity-90">
                    {inspectItem.summary.formulasOrCode}
                  </pre>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1">
                  <div className="font-bold text-amber-600 uppercase text-[10px] tracking-wider flex items-center gap-1">
                    ⚠ Common Exam Pitfall to Avoid
                  </div>
                  <p className="text-foreground font-sans">{inspectItem.summary.commonPitfall}</p>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => {
                    toggleStatus(inspectItem.topic);
                    setInspectItem(null);
                  }}
                  className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-green-700 shadow-sm"
                >
                  Mark as Mastered ✓
                </button>
                <button
                  type="button"
                  onClick={() => setInspectItem(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Plus className="h-5 w-5 text-violet" /> Add Remediation Target
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTarget} className="space-y-3">
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
                  Weak Topic / Concept
                </label>
                <input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Backpropagation Math"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why this topic needs revision?
                </label>
                <input
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Scored 50% on Unit 3 Quiz"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-violet"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    value={newEst}
                    onChange={(e) => setNewEst(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none"
                    min={5}
                    max={120}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <PrimaryButton type="submit">Add to Study Schedule</PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
