import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, ListChecks, Flame, Play, Star, BookOpen, ChevronRight,
  Lock, Unlock, Layers, CheckCircle2, AlertCircle, Sparkles, Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { PageHeader, ActionCard, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/")({ component: StudentDashboard });

const TIME_SPENT = [
  { day: "Mon", hours: 1.5 },
  { day: "Tue", hours: 2.2 },
  { day: "Wed", hours: 0.8 },
  { day: "Thu", hours: 3.1 },
  { day: "Fri", hours: 2.5 },
  { day: "Sat", hours: 1.0 },
  { day: "Sun", hours: 1.8 },
];

const AVG_HOURS = +(TIME_SPENT.reduce((a, d) => a + d.hours, 0) / TIME_SPENT.length).toFixed(1);

const STREAK_DAYS = [
  { day: "M", active: 1 },
  { day: "T", active: 1 },
  { day: "W", active: 0 },
  { day: "T", active: 1 },
  { day: "F", active: 1 },
  { day: "S", active: 1 },
  { day: "S", active: 1 },
];

const MASTERY_PCT = 74;
const WEEKLY_PROGRESS_PCT = 85;

/* ── Animated Mastery Ring ── */
function MasteryRing({ pct }: { pct: number }) {
  const outerR = 56;
  const innerR = 46; // secondary ring
  const circ = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;

  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 950;
    const run = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * pct));
      if (p < 1) rafRef.current = requestAnimationFrame(run);
    };
    rafRef.current = requestAnimationFrame(run);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pct]);

  const outerDash = `${(displayed / 100) * circ} ${circ}`;
  const innerDash = `${(WEEKLY_PROGRESS_PCT / 100) * innerCirc} ${innerCirc}`;

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128" width="160" height="160">
        {/* Track rings */}
        <circle
          cx="64"
          cy="64"
          r={outerR}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={innerR}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="5"
        />
        {/* Weekly progress ring (gold, inner) */}
        <circle
          cx="64"
          cy="64"
          r={innerR}
          fill="none"
          stroke="#f5c451"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={innerDash}
          className="ring-glow-gold"
          style={{ transition: "stroke-dasharray 0.03s linear" }}
        />
        {/* Mastery ring (violet, outer) */}
        <circle
          cx="64"
          cy="64"
          r={outerR}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={outerDash}
          className="ring-glow-violet"
          style={{ transition: "stroke-dasharray 0.03s linear" }}
        />
      </svg>
      <div className="relative text-center">
        <div className="text-gradient-violet text-3xl font-bold tabular-nums">{displayed}%</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Mastery</div>
      </div>
    </div>
  );
}

/* ── Streak Flame floating ── */
function StreakFlame() {
  return (
    <div className="relative flex items-center gap-1">
      <span className="flame-float text-xl">🔥</span>
      <motion.span
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
        className="text-sm opacity-60"
      >
        🔥
      </motion.span>
      <motion.span
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
        className="text-xs opacity-40"
      >
        🔥
      </motion.span>
    </div>
  );
}

/* ── Upcoming Quizzes ── */
function UpcomingQuizzes({ subjects, quizzes }: { subjects: any[]; quizzes: any[] }) {
  const SUBJECT_ICONS: Record<string, string> = {
    "Big Data Analytics": "📊",
    "Machine Learning": "🤖",
    "Cloud Computing": "☁️",
    Cybersecurity: "🔒",
  };

  const activeQuizzes = quizzes && quizzes.length > 0
    ? quizzes.slice(0, 4).map((q, i) => ({
        id: q.id,
        title: q.title,
        subject: q.subjectName || "Course Assessment",
        due: i === 0 ? "Due Today" : i === 1 ? "Due Tomorrow" : `Due in ${i + 2} days`,
        urgency: i === 0 ? "urgent" : i === 1 ? "soon" : "normal",
        icon: SUBJECT_ICONS[q.subjectName] ?? "📝",
      }))
    : subjects.slice(0, 3).map((s, i) => ({
        id: s.id,
        title: `${s.name} Assessment`,
        subject: s.name,
        due: i === 0 ? "Available Now" : `Due in ${i + 2} days`,
        urgency: i === 0 ? "urgent" : "normal",
        icon: SUBJECT_ICONS[s.name] ?? "📚",
      }));

  return (
    <Card title="Upcoming & Published Quizzes">
      {activeQuizzes.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No upcoming quizzes yet. Quizzes created by faculty will appear here.
        </div>
      ) : (
        <ul className="space-y-2">
          {activeQuizzes.map((q, i) => (
            <motion.li
              key={q.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.2 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition",
                q.urgency === "urgent"
                  ? "quiz-urgent"
                  : q.urgency === "soon"
                    ? "quiz-soon"
                    : "border-border bg-background hover:bg-accent/30",
              )}
            >
              <span className="text-xl">{q.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{q.title}</div>
                <div
                  className={cn(
                    "text-[11px] font-semibold",
                    q.urgency === "urgent"
                      ? "text-danger"
                      : q.urgency === "soon"
                        ? "text-gold"
                        : "text-muted-foreground",
                  )}
                >
                  {q.due} · {q.subject}
                </div>
              </div>
              <Link to="/student/quizzes">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  className="flex items-center gap-1 rounded-lg bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet transition hover:bg-violet/20"
                >
                  <Play className="h-3 w-3" /> Start
                </motion.button>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Chart Tooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-xl"
      style={{ boxShadow: "0 8px 24px -6px rgba(0,0,0,0.25), 0 0 0 1px var(--color-border)" }}
    >
      {label && <div className="font-bold text-foreground mb-1">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name ?? p.dataKey}:</span>
          <span className="font-semibold text-foreground">
            {p.value}
            {p.name === "Hours" ? "h" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Animated pulse dot for latest chart point ── */
function PulseChartDot(props: any) {
  const { cx, cy, index, dataLength } = props;
  if (index !== dataLength - 1) return null;
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={6}
        fill="#8b5cf6"
        stroke="var(--color-card)"
        strokeWidth={2}
        animate={{ r: [5, 8, 5], opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </g>
  );
}

import { useAuth } from "@/lib/auth";

function StudentDashboard() {
  const { subjects, quizzes, modules, enrollStudent, unenrollStudent } = useAppData();
  const { user } = useAuth();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const myId = user?.id || "";
  const myEmail = user?.email || "";
  const myStudentId = user?.studentId || "";

  const isEnrolled = (s: any) => {
    const list = s.enrolledStudentIds || [];
    return (
      list.includes(myId) ||
      list.includes(myEmail) ||
      (myStudentId && list.includes(myStudentId))
    );
  };

  const handleToggleEnroll = async (subjectId: string) => {
    if (!myId) return;
    setEnrollingId(subjectId);
    const s = subjects.find((sub) => sub.id === subjectId);
    if (s && isEnrolled(s)) {
      await unenrollStudent(subjectId, myId);
    } else {
      await enrollStudent(subjectId, myId);
    }
    setEnrollingId(null);
  };

  const semesters = Array.from(
    new Set(subjects.map((subject) => Number(subject.semester)).filter(Boolean)),
  ).sort((a, b) => a - b);
  const [activeSemester, setActiveSemester] = useState<number | null>(null);
  const visibleSubjects = activeSemester
    ? subjects.filter((subject) => Number(subject.semester) === activeSemester)
    : subjects;

  const suggestedWeakTopics = subjects.slice(0, 3).map((s, i) => ({
    topic: i === 0 ? "MapReduce Shuffle & Partitioning" : i === 1 ? "L1/L2 Regularization Penalty" : "Distributed File Storage HDFS",
    reason: i === 0 ? "Scored 55% in recent assessment" : "Low confidence in Ask Tutor session",
    subject: s.name,
  }));

  const axisStyle = { fontSize: 11, fill: "var(--color-muted-foreground)" };

  return (
    <div>
      <PageHeader
        title="Your Learning Dashboard"
        subtitle="Personalized progress across all subjects."
      />

      {/* ── Semester navigator ── */}
      <section className="mb-5 rounded-3xl border border-violet/15 bg-gradient-to-r from-violet/10 via-card to-gold/5 p-4 shadow-[0_14px_32px_-24px_oklch(0.62_0.22_293_/_45%)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
              Your curriculum
            </div>
            <h2 className="mt-1 font-serif text-lg font-bold text-foreground">
              Explore by semester
            </h2>
          </div>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {visibleSubjects.length} subject{visibleSubjects.length === 1 ? "" : "s"} shown
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSemester(null)}
            className={cn(
              "min-w-[84px] rounded-2xl border px-3 py-2 text-left transition",
              activeSemester === null
                ? "border-violet bg-violet text-white shadow-md"
                : "border-border bg-card text-muted-foreground hover:border-violet/40 hover:text-foreground",
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider">All</div>
            <div className="mt-1 text-xs font-semibold">Subjects</div>
          </button>
          {semesters.map((semester) => {
            const count = subjects.filter(
              (subject) => Number(subject.semester) === semester,
            ).length;
            return (
              <button
                key={semester}
                type="button"
                onClick={() => setActiveSemester(semester)}
                className={cn(
                  "min-w-[84px] rounded-2xl border px-3 py-2 text-left transition",
                  activeSemester === semester
                    ? "border-violet bg-violet text-white shadow-md"
                    : "border-border bg-card text-muted-foreground hover:border-violet/40 hover:text-foreground",
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider">Sem {semester}</div>
                <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
                  {count} course{count === 1 ? "" : "s"} <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
        {visibleSubjects.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {visibleSubjects.slice(0, 4).map((subject) => (
              <div
                key={subject.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-foreground">
                    {subject.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {subject.code} · Sem {subject.semester}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Row 1: Mastery Hero, Streak, Quick Actions ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Mastery Hero Card */}
        <Card variant="hero" className="flex flex-col items-center justify-center gap-4 py-8">
          <MasteryRing pct={MASTERY_PCT} />
          <div className="text-center">
            <div className="font-serif text-base font-bold text-foreground">Overall Mastery</div>
            <div className="text-xs text-muted-foreground">Across all enrolled subjects</div>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-success">
              <Star className="h-3.5 w-3.5 fill-success" />
              Top 30% of your class
            </div>
            {/* Weekly progress legend */}
            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet" />
                Overall {MASTERY_PCT}%
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gold" />
                Weekly {WEEKLY_PROGRESS_PCT}%
              </div>
            </div>
          </div>
        </Card>

        {/* Streak Card */}
        <Card variant="hero-gold" className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/25 shadow-[0_0_14px_-3px_oklch(0.82_0.18_84_/_40%)]">
              <Flame className="h-6 w-6 text-gold" />
            </div>
            <div>
              <div className="text-gradient-gold font-serif text-2xl font-bold">6 Day Streak</div>
              <div className="text-xs text-muted-foreground">Best: 14 days · Keep going!</div>
            </div>
          </div>
          <StreakFlame />
          <div className="h-20 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={STREAK_DAYS} barSize={14}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar
                  dataKey="active"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                >
                  {STREAK_DAYS.map((d, i) => (
                    <motion.rect key={i} />
                  ))}
                  {STREAK_DAYS.map((d, i) => (
                    // Use Cell equivalent via custom fill
                    <></>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/student/ask">
            <ActionCard
              icon={MessageCircle}
              title="Ask the AI Tutor"
              description="Get grounded answers from your course material."
              color="indigo"
            />
          </Link>
          <Link to="/student/quizzes">
            <ActionCard
              icon={ListChecks}
              title="Take a Quiz"
              description="Self-assess and build your mastery score."
              color="amber"
            />
          </Link>
        </div>
      </div>

      {/* ── Row 2: Time Chart, Upcoming Quizzes ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Time Spent This Week">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TIME_SPENT}>
                <defs>
                  <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                    <stop offset="55%" stopColor="#8b5cf6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit="h" />
                <Tooltip content={<ChartTooltip />} />
                {/* Average reference line */}
                <ReferenceLine
                  y={AVG_HOURS}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Avg ${AVG_HOURS}h`,
                    fill: "var(--color-muted-foreground)",
                    fontSize: 10,
                    position: "right",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#timeGrad)"
                  name="Hours"
                  isAnimationActive
                  animationDuration={900}
                  dot={false}
                  activeDot={{ r: 5, fill: "#8b5cf6", stroke: "var(--color-card)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <UpcomingQuizzes subjects={subjects} quizzes={quizzes} />
      </div>

      {/* ── Row 3: Enrolled Subjects & Modules (Strict Access Control) ── */}
      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-violet">
                Active Learning Curriculum
              </div>
              <h2 className="font-serif text-xl font-bold text-foreground">
                My Enrolled Subjects & Learning Modules ({subjects.filter(isEnrolled).length})
              </h2>
            </div>
          </div>

          {subjects.filter(isEnrolled).length === 0 ? (
            <Card className="border-amber-500/30 bg-amber-500/5 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 shrink-0">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-serif text-base font-bold text-foreground">
                      0 Subjects Enrolled — Learning Modules Locked
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                      You are not currently enrolled in any subjects. To access curriculum units, learning modules, study materials, and AI tutor grounding, please browse the Course Catalog below and click <strong>+ Enroll in Subject</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {subjects.filter(isEnrolled).map((s) => {
                const subMods = modules.filter((m) => m.subjectId === s.id);
                return (
                  <Card key={s.id} className="border-violet/25 bg-gradient-to-br from-card to-indigo-brand/5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet font-bold">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-bold text-foreground">{s.name}</span>
                            <Pill tone="green">✓ Enrolled & Unlocked</Pill>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {s.code} · Sem {s.semester} · Faculty: <strong className="text-foreground font-medium">{s.faculty || "Faculty Member"}</strong> · {subMods.length} Module{subMods.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/student/ask"
                          className="rounded-xl bg-violet px-3.5 py-1.5 text-xs font-bold text-white hover:bg-violet-hover shadow-2xs flex items-center gap-1.5 transition"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Ask AI Tutor
                        </Link>
                      </div>
                    </div>

                    {/* Modules list for this enrolled subject */}
                    <div className="mt-4 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-violet" /> Unlocked Modules for {s.name}:
                      </div>
                      {subMods.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic py-2 pl-1">
                          No learning modules uploaded yet by faculty for this course.
                        </div>
                      ) : (
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {subMods.map((mod) => (
                            <div
                              key={mod.id}
                              className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 p-3 hover:border-violet/40 transition"
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
                                {mod.order || 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-foreground truncate">{mod.name}</div>
                                {mod.description && (
                                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                    {mod.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── University Course Catalog ── */}
        <Card title="University Course Catalog & Enrollment Directory">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                Enroll in subjects to unlock their modules, AI tutor knowledge base, and study quizzes.
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSemester(null)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition",
                    activeSemester === null
                      ? "bg-foreground text-background font-bold"
                      : "bg-accent text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({subjects.length})
                </button>
                {semesters.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setActiveSemester(sem)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-semibold transition",
                      activeSemester === sem
                        ? "bg-foreground text-background font-bold"
                        : "bg-accent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sem {sem}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSubjects.map((s) => {
                const enrolled = isEnrolled(s);
                const subMods = modules.filter((m) => m.subjectId === s.id);
                const isProcessing = enrollingId === s.id;

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-4 transition shadow-2xs",
                      enrolled
                        ? "border-violet/30 bg-indigo-brand/5"
                        : "border-border bg-card hover:border-violet/20"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Pill tone="indigo">{s.code}</Pill>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Sem {s.semester}
                        </span>
                      </div>
                      <div className="mt-2 font-serif text-base font-bold text-foreground">
                        {s.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Faculty: <strong className="text-foreground font-medium">{s.faculty || "Faculty"}</strong>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        {enrolled ? (
                          <span className="text-success font-medium flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> {subMods.length} module{subMods.length !== 1 ? "s" : ""} unlocked
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Lock className="h-3 w-3" /> {subMods.length} module{subMods.length !== 1 ? "s" : ""} (enroll to unlock)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleToggleEnroll(s.id)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-2xs disabled:opacity-50",
                          enrolled
                            ? "bg-green-brand text-white hover:opacity-90"
                            : "bg-violet text-white hover:bg-violet-hover"
                        )}
                      >
                        {isProcessing
                          ? "Updating..."
                          : enrolled
                          ? "✓ Enrolled"
                          : "+ Enroll in Subject"}
                      </button>

                      {enrolled ? (
                        <Link
                          to="/student/ask"
                          className="text-xs font-semibold text-violet hover:underline"
                        >
                          Ask Tutor →
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 4: Weak Topics ── */}
      <div className="mt-4">
        <Card title="Weak Topics — Suggested AI Revision">
          {suggestedWeakTopics.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Take a few quizzes to build your personalized revision plan.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {suggestedWeakTopics.map((w) => (
                <li
                  key={w.topic}
                  className="flex items-center justify-between py-3 transition hover:bg-accent/30 rounded-lg px-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{w.topic}</div>
                      <span className="rounded-full bg-violet/10 px-1.5 py-0.5 text-[10px] font-bold text-violet">
                        AI Recommended
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{w.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone="indigo">{w.subject}</Pill>
                    <Link
                      to="/student/ask"
                      className="rounded-lg bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet/20 transition"
                    >
                      Ask Tutor →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
