import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useId, useRef } from "react";
import {
  Send,
  Sparkles,
  Sliders,
  FileText,
  History,
  Plus,
  Trash2,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PageHeader, Card } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { MermaidRenderer } from "@/components/MermaidRenderer";

export const Route = createFileRoute("/student/ask")({
  component: AskTutorPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type VisualData =
  | { type: "flowchart"; steps: string[] }
  | { type: "comparison_chart"; categories: string[]; values: number[]; label?: string }
  | {
      type: "concept_map";
      nodes: string[];
      edges: { from: string; to: string; relation?: string }[];
    }
  | null;

interface SourceChip {
  documentId: string | null;
  fileName: string;
  chunkIndex: number;
  page?: number | null;
  section?: string | null;
  score?: number | null;
}

interface ApiResponse {
  conversationId?: string;
  answer: string;
  worked_example?: string | null;
  visual?: VisualData;
  escalated: boolean;
  confidence: number;
  sources: SourceChip[];
  provider?: string | null;
  grounded?: boolean;
  mode?: string;
  intent?: string;
  agent_trace?: string[];
  follow_up?: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  worked_example?: string | null;
  visual?: VisualData;
  timestamp: string;
  escalated?: boolean;
  confidence?: number;
  sources?: SourceChip[];
  provider?: string | null;
  grounded?: boolean;
  mode?: string;
  intent?: string;
  agent_trace?: string[];
  follow_up?: string[];
}

interface ChatSession {
  id: string;
  mongoId?: string;
  title: string;
  subject: string;
  subjectId: string;
  createdAt: string;
  messages: ChatMessage[];
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  const dotColors = ["bg-violet", "bg-gold", "bg-success"];
  return (
    <div className="flex max-w-xs items-center gap-3 rounded-2xl border border-violet/20 bg-card px-4 py-3.5 shadow-sm chat-ai-bubble">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet/15 ring-1 ring-violet/20">
        <Sparkles className="h-3.5 w-3.5 text-violet" />
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("typing-dot h-2.5 w-2.5 rounded-full", dotColors[i])} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground italic">Thinking & structuring…</span>
    </div>
  );
}

// ── Visual Renderer ───────────────────────────────────────────────────────────
function VisualRenderer({ visual }: { visual: VisualData }) {
  if (!visual) return null;

  if (visual.type === "flowchart") {
    const steps = visual.steps || [];
    if (steps.length === 0) return null;

    const nodesDef = steps
      .map((s, i) => `  Node${i}["${i + 1}. ${s.replace(/"/g, "'")}"]`)
      .join("\n");
    const edgesDef = steps
      .slice(0, -1)
      .map((_, i) => `  Node${i} --> Node${i + 1}`)
      .join("\n");

    const mermaidText = `graph TD\n${nodesDef}\n${edgesDef}`;

    return (
      <div className="my-3 space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-violet flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Flowchart Step Sequence
        </div>
        <MermaidRenderer chart={mermaidText} />
      </div>
    );
  }

  if (visual.type === "concept_map") {
    const nodes = visual.nodes || [];
    const edges = visual.edges || [];
    if (nodes.length === 0) return null;

    const nodeMap: Record<string, string> = {};
    nodes.forEach((n, i) => {
      nodeMap[n] = `N${i}`;
    });

    const nodesDef = nodes.map((n, i) => `  N${i}["${n.replace(/"/g, "'")}"]`).join("\n");

    const edgesDef = edges
      .map((e) => {
        const fromId = nodeMap[e.from] || `N_${e.from.replace(/\W/g, "")}`;
        const toId = nodeMap[e.to] || `N_${e.to.replace(/\W/g, "")}`;
        const rel = e.relation ? `-- "${e.relation.replace(/"/g, "'")}" -->` : "-->";
        return `  ${fromId} ${rel} ${toId}`;
      })
      .join("\n");

    const mermaidText = `graph TD\n${nodesDef}\n${edgesDef}`;

    return (
      <div className="my-3 space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-violet flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Concept Map
        </div>
        <MermaidRenderer chart={mermaidText} />
      </div>
    );
  }

  if (visual.type === "comparison_chart") {
    const categories = visual.categories || [];
    const values = visual.values || [];
    const chartData = categories.map((cat, i) => ({
      category: cat,
      value: values[i] ?? 0,
    }));
    const colors = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"];

    return (
      <div className="my-3 rounded-xl border border-violet/20 bg-card p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-violet">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Comparison Chart
          </span>
          {visual.label && (
            <span className="text-muted-foreground font-normal text-xs">{visual.label}</span>
          )}
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e1b4b",
                  borderColor: "#7c3aed",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}

// ── Source chip ───────────────────────────────────────────────────────────────
function SourceChipBadge({
  source,
  onClick,
}: {
  source: SourceChip;
  onClick: (s: SourceChip) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(source)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-violet/25 bg-violet/8 px-2.5 py-1 text-[11px] font-medium text-violet hover:bg-violet/15 hover:border-violet/50 transition-all"
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="max-w-[140px] truncate">{source.fileName}</span>
      {source.page !== null && source.page !== undefined ? (
        <span className="text-violet/70">p.{source.page}</span>
      ) : (
        <span className="text-violet/60">#{source.chunkIndex}</span>
      )}
      {source.section && (
        <span className="text-muted-foreground/75 text-[10px] hidden sm:inline truncate max-w-[80px]">
          ({source.section})
        </span>
      )}
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </button>
  );
}

// ── Source detail modal ───────────────────────────────────────────────────────
function SourceModal({ source, onClose }: { source: SourceChip; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <FileText className="h-4 w-4 text-violet" />
          Verified Course Source
        </div>
        <div className="rounded-xl bg-muted p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Document</span>
            <span className="font-semibold text-foreground max-w-[220px] truncate text-right">
              {source.fileName}
            </span>
          </div>
          {source.page !== null && source.page !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Page</span>
              <span className="font-semibold text-foreground">Page {source.page}</span>
            </div>
          )}
          {source.section && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Section</span>
              <span className="font-semibold text-foreground max-w-[220px] truncate text-right">{source.section}</span>
            </div>
          )}
          {source.score !== undefined && source.score !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Relevance Score</span>
              <span className="font-semibold text-success">{Math.round((source.score || 0) * 100)}%</span>
            </div>
          )}
          {source.documentId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document ID</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {source.documentId.slice(-8)}…
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-gradient-to-r from-violet to-[#7c3aed] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Educational Modes ──────────────────────────────────────────────────────────
const EDUCATIONAL_MODES = [
  { id: "ask_tutor", label: "Ask Tutor", icon: "🎓" },
  { id: "explain", label: "Explain", icon: "💡" },
  { id: "summarize", label: "Summarize", icon: "📝" },
  { id: "exam_prep", label: "Exam Prep", icon: "🎯" },
  { id: "quiz_me", label: "Quiz Me", icon: "❓" },
  { id: "compare", label: "Compare", icon: "⚖️" },
  { id: "solve", label: "Solve", icon: "🔢" },
  { id: "code_help", label: "Code Help", icon: "💻" },
];

// ── Main page ─────────────────────────────────────────────────────────────────
function AskTutorPage() {
  const { subjects, addQuery, refreshQueries } = useAppData();
  const { user } = useAuth();
  const id = useId();

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = user?.studentId ? String(user.studentId) : "";

  const isEnrolled = (s: any) => {
    const list: string[] = Array.isArray(s.enrolledStudentIds)
      ? s.enrolledStudentIds
      : typeof s.enrolledStudentIds === "string"
      ? JSON.parse(s.enrolledStudentIds || "[]")
      : [];
    return (
      list.some((item) => {
        const clean = String(item).toLowerCase();
        return clean === myId.toLowerCase() || clean === myEmail || (myStudentId && clean === myStudentId.toLowerCase());
      })
    );
  };

  const enrolledSubjects = subjects.filter(isEnrolled);
  const firstSubject = enrolledSubjects[0] || subjects[0];
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(firstSubject?.id ?? "");
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(firstSubject?.name ?? "");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(firstSubject?.code ?? "");
  const [selectedMode, setSelectedMode] = useState<string>("ask_tutor");

  const [showControls, setShowControls] = useState<boolean>(false);

  const makeDefaultSession = (): ChatSession => ({
    id: "sess_1",
    title: "New Conversation",
    subject: selectedSubjectName,
    subjectId: selectedSubjectId,
    createdAt: "Today",
    messages: [],
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined") return [makeDefaultSession()];
    try {
      const saved = localStorage.getItem("ai_tutor_chat_sessions_v3");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [makeDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id ?? "sess_1");
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceChip | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load past conversations from MongoDB backend
  useEffect(() => {
    async function fetchServerConversations() {
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          headers: {
            ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
            ...(user?.id ? { "x-user-id": user.id } : {}),
          },
        });
        if (res.ok) {
          const convs = await res.json();
          if (Array.isArray(convs) && convs.length > 0) {
            const loadedSessions: ChatSession[] = convs.map((c: any) => ({
              id: c.id || c._id,
              mongoId: c.id || c._id,
              title: c.title,
              subject: c.subjectName || "General",
              subjectId: c.subjectId || "",
              createdAt: new Date(c.updatedAt).toLocaleDateString(),
              messages: [],
            }));
            setSessions(loadedSessions);
            setActiveSessionId(loadedSessions[0].id);
          }
        }
      } catch (e) {
        console.warn("[Ask Tutor] Could not fetch server conversations:", e);
      }
    }

    fetchServerConversations();
  }, [user?.id, user?.token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("ai_tutor_chat_sessions_v3", JSON.stringify(sessions));
    } catch {}
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  useEffect(() => {
    if (!activeSession) return;
    const subj = subjects.find(
      (s) => s.id === activeSession.subjectId || s.name === activeSession.subject,
    );
    if (subj) {
      setSelectedSubjectId(subj.id);
      setSelectedSubjectName(subj.name);
      setSelectedSubjectCode(subj.code);
    } else if (firstSubject) {
      setSelectedSubjectId(firstSubject.id);
      setSelectedSubjectName(firstSubject.name);
      setSelectedSubjectCode(firstSubject.code);
    }
  }, [activeSessionId, activeSession?.subject, activeSession?.subjectId, subjects, firstSubject]);

  // Load conversation messages from server when selected
  const handleSelectSession = async (sessId: string) => {
    setActiveSessionId(sessId);
    const target = sessions.find((s) => s.id === sessId);
    if (target && target.messages.length === 0 && target.mongoId) {
      try {
        const res = await fetch(`${API_BASE}/api/conversations/${target.mongoId}`, {
          headers: {
            ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
            ...(user?.id ? { "x-user-id": user.id } : {}),
          },
        });
        if (res.ok) {
          const convData = await res.json();
          const msgs: ChatMessage[] = (convData.messages || []).map((m: any, idx: number) => ({
            id: m._id || `msg_${idx}`,
            role: m.role === "student" ? "user" : "ai",
            text: m.text,
            worked_example: m.worked_example || null,
            visual: m.visual || null,
            sources: m.sources || [],
            timestamp: m.timestamp
              ? new Date(m.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
          }));

          setSessions((prev) => prev.map((s) => (s.id === sessId ? { ...s, messages: msgs } : s)));
        }
      } catch (err) {
        console.error("[Ask Tutor] Failed to load session messages:", err);
      }
    }
  };

  const createNewSession = () => {
    const newSess: ChatSession = {
      id: `sess_${Date.now()}`,
      title: "New Conversation",
      subject: selectedSubjectName,
      subjectId: selectedSubjectId,
      createdAt: "Just now",
      messages: [],
    };
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
  };

  const deleteSession = (sessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessId);
      if (remaining.length === 0) {
        const fresh = makeDefaultSession();
        fresh.id = `sess_${Date.now()}`;
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessId) setActiveSessionId(remaining[0].id);
      return remaining;
    });
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subj = subjects.find((s) => s.id === e.target.value);
    if (subj) {
      setSelectedSubjectId(subj.id);
      setSelectedSubjectName(subj.name);
      setSelectedSubjectCode(subj.code);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, subject: subj.name, subjectId: subj.id } : s,
        ),
      );
    }
  };

  // ── Send question ───────────────────────────────────────────────────────────
  const handleSend = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? input).trim();
    if (!q || isProcessing) return;

    if (!overrideQuery) setInput("");

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      text: q,
      timestamp: timeStr,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const newTitle =
          s.messages.length === 0 ? q.slice(0, 30) + (q.length > 30 ? "…" : "") : s.title;
        return { ...s, title: newTitle, messages: [...s.messages, userMsg] };
      }),
    );

    addQuery({
      student: user?.name ?? "Student",
      subject: selectedSubjectName,
      question: q,
      createdAt: "Just now",
    });

    setIsProcessing(true);

    let apiResp: ApiResponse | null = null;
    const conversationIdToSend = activeSession.mongoId;

    try {
      const res = await fetch(`${API_BASE}/api/tutor/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
          ...(user?.id ? { "x-user-id": user.id } : {}),
          ...(user?.role ? { "x-user-role": user.role } : {}),
        },
        body: JSON.stringify({
          subjectId: selectedSubjectId || firstSubject?.id || undefined,
          subjectCode: selectedSubjectCode || firstSubject?.code || "CSUC301",
          question: q,
          conversationId: conversationIdToSend,
          mode: selectedMode,
        }),
      });

      if (res.ok) {
        apiResp = (await res.json()) as ApiResponse;
        addQuery({
          student: user?.name || "Student",
          subject: selectedSubjectName || "General",
          question: q,
          confidence: apiResp ? Math.round((apiResp.confidence || 0.92) * 100) : 92,
          escalated: Boolean(apiResp?.escalated),
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        refreshQueries().catch(() => {});
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[Ask Tutor] API error:", res.status, errData);
      }
    } catch (fetchErr) {
      console.error("[Ask Tutor] Fetch failed:", fetchErr);
    }

    if (!apiResp) {
      apiResp = {
        answer:
          "The AI Tutor service is currently unreachable. Please make sure the Node backend (port 5000) and the Python RAG service (port 8001) are both running.",
        worked_example: null,
        visual: null,
        escalated: true,
        confidence: 0,
        sources: [],
      };
    }

    const aiMsg: ChatMessage = {
      id: `msg_ai_${Date.now()}`,
      role: "ai",
      text: apiResp.answer,
      worked_example: apiResp.worked_example || null,
      visual: apiResp.visual || null,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      escalated: apiResp.escalated,
      confidence: apiResp.confidence,
      sources: apiResp.sources ?? [],
      provider: apiResp.provider ?? null,
      grounded: apiResp.grounded,
      mode: apiResp.mode,
      intent: apiResp.intent,
      agent_trace: apiResp.agent_trace,
      follow_up: apiResp.follow_up,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          mongoId: apiResp?.conversationId || s.mongoId,
          messages: [...s.messages, aiMsg],
        };
      }),
    );
    setIsProcessing(false);
  };

  return (
    <div>
      <PageHeader
        title="AI Tutor — Adaptive & Visually Explaining"
        subtitle="Multi-turn conversation memory, topic mastery adaptivity, worked examples, and interactive diagrams."
        action={
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all",
              showControls
                ? "border-violet bg-violet/5 text-violet shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
                : "border-border bg-card text-muted-foreground hover:border-violet/40",
            )}
          >
            <Sliders className="h-4 w-4" />
            Controls
          </button>
        }
      />

      {enrolledSubjects.length === 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-foreground">0 Course Enrollments Active</div>
              <p className="text-xs text-muted-foreground">
                Enroll in subjects from your dashboard to ground the AI Tutor directly on your university syllabus and course documents.
              </p>
            </div>
          </div>
          <Link
            to="/student"
            className="rounded-xl bg-violet px-4 py-2 text-xs font-bold text-white hover:bg-violet-hover transition shadow-2xs shrink-0"
          >
            Go to Course Catalog →
          </Link>
        </div>
      )}

      {showControls && (
        <div className="mb-6 rounded-2xl border border-violet/20 bg-violet/5 p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subject Context ({enrolledSubjects.length > 0 ? "Enrolled Only" : "All Subjects"})
              </label>
              <select
                value={selectedSubjectId}
                onChange={handleSubjectChange}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-violet transition"
              >
                {(enrolledSubjects.length > 0 ? enrolledSubjects : subjects).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {isEnrolled(s) ? "✓ Enrolled" : "(Not Enrolled)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-xs text-muted-foreground rounded-xl border border-border bg-card px-3 py-2">
                <span className="font-semibold text-violet">RAG Engine:</span> ChromaDB + MiniLM →
                Gemini/Groq → MongoDB Conversation Memory & Structured Output
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sessions sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Conversations
              <span className="ml-1 rounded-full bg-violet/10 px-1.5 py-0.5 text-violet font-bold">
                {sessions.length}
              </span>
            </span>
            <button
              type="button"
              onClick={createNewSession}
              className="flex items-center gap-1 rounded-lg bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet/20 transition"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
            {sessions.map((s) => {
              const active = s.id === activeSessionId;
              return (
                <motion.div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  whileHover={{ x: 2 }}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition text-xs",
                    active
                      ? "bg-violet text-white font-medium shadow-[0_0_14px_-4px_oklch(0.62_0.22_293_/_50%)]"
                      : "bg-card text-foreground hover:bg-accent border border-border",
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate font-semibold">{s.title || "Untitled chat"}</div>
                    <div
                      className={cn(
                        "text-[11px] truncate mt-0.5",
                        active ? "text-violet-200 opacity-80" : "text-muted-foreground",
                      )}
                    >
                      {s.subject} · {s.messages.length} msgs
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteSession(s.id, e)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition p-1 rounded",
                      active
                        ? "hover:bg-white/20 text-white"
                        : "hover:text-danger text-muted-foreground",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-3">
          <Card>
            <div className="flex flex-col min-h-[520px]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/10 text-violet">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <select
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:border-violet transition cursor-pointer"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-violet/10 px-2.5 py-1 text-violet font-semibold">
                    Adaptive Conversational RAG ({selectedSubjectCode})
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
                {activeSession.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet/10 text-violet shadow-[0_0_24px_-4px_oklch(0.62_0.22_293_/_35%)]"
                    >
                      <Sparkles className="h-8 w-8" />
                    </motion.div>
                    <div className="font-serif text-2xl font-bold text-foreground">
                      Ask the AI Tutor
                    </div>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Ask questions, view worked examples, and explore interactive flowcharts,
                      concept maps, and comparison charts grounded in course material.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {activeSession.messages.map((msg) => (
                      <ChatMessageBubble
                        key={msg.id}
                        msg={msg}
                        onSourceClick={setSelectedSource}
                        onFollowUpClick={(fuText) => handleSend(fuText)}
                      />
                    ))}
                  </AnimatePresence>
                )}

                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex justify-start"
                  >
                    <TypingIndicator />
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Educational Mode Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
                {EDUCATIONAL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-all",
                      selectedMode === m.id
                        ? "bg-violet text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Input bar */}
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 shadow-sm focus-within:border-violet/50 focus-within:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)] transition-all">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={`Ask a question about ${selectedSubjectName || "your subject"}…`}
                  disabled={isProcessing}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <motion.button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ boxShadow: "0 0 18px -3px oklch(0.62 0.22 293 / 55%)" }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9d72f7] to-[#7c3aed] text-white disabled:opacity-40 transition-all"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Source detail modal */}
      <AnimatePresence>
        {selectedSource && (
          <SourceModal source={selectedSource} onClose={() => setSelectedSource(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ChatMessageBubble ─────────────────────────────────────────────────────────
function ChatMessageBubble({
  msg,
  onSourceClick,
  onFollowUpClick,
}: {
  msg: ChatMessage;
  onSourceClick: (s: SourceChip) => void;
  onFollowUpClick?: (text: string) => void;
}) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isUser = msg.role === "user";
  const isEscalated = msg.escalated === true;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex justify-end"
      >
        <div
          className="max-w-xl rounded-2xl rounded-tr-sm chat-user-bubble px-4 py-3 text-sm text-white shadow-sm"
          style={{ boxShadow: "0 4px 16px -4px oklch(0.62 0.22 293 / 40%)" }}
        >
          <div className="leading-relaxed">{msg.text}</div>
          <div className="mt-1 text-[10px] text-violet-200 text-right opacity-75">
            {msg.timestamp}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex gap-3 max-w-3xl"
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 shadow-sm mt-1",
          isEscalated
            ? "bg-amber-500/15 ring-amber-500/25 shadow-amber-500/20"
            : "bg-violet/15 ring-violet/25 shadow-[0_0_10px_-2px_oklch(0.62_0.22_293_/_30%)]",
        )}
      >
        {isEscalated ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <Sparkles className="h-4 w-4 text-violet" />
        )}
      </div>

      <div className="flex-1">
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border p-5 shadow-sm space-y-3",
            isEscalated
              ? "border-amber-500/20 bg-amber-500/5 chat-escalated-bubble"
              : "border-violet/15 bg-card chat-ai-bubble",
          )}
          style={{
            boxShadow: isEscalated
              ? "0 2px 12px -4px rgba(245,158,11,0.15)"
              : "0 2px 12px -4px rgba(0,0,0,0.15)",
          }}
        >
          {/* Escalation badge */}
          {isEscalated && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Escalated to Faculty — Not enough approved material found.
              </span>
            </div>
          )}

          {/* Header row with confidence, grounded status, and mode */}
          {!isEscalated && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Grounded answer</span>
                {msg.grounded && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Verified Grounded
                  </span>
                )}
                {msg.mode && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-violet/10 text-violet">
                    {msg.mode.replace("_", " ")}
                  </span>
                )}
              </div>
              {msg.confidence !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-bold text-[11px]",
                    msg.confidence >= 0.75
                      ? "bg-success/10 text-success"
                      : msg.confidence >= 0.55
                        ? "bg-violet/10 text-violet"
                        : "bg-gold/10 text-gold",
                  )}
                >
                  Confidence: {Math.round(msg.confidence * 100)}%
                </span>
              )}
            </div>
          )}

          {/* Main Answer text */}
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-line font-sans",
              isEscalated ? "text-amber-900 dark:text-amber-100" : "text-foreground",
            )}
          >
            {msg.text}
          </div>

          {/* Worked Example Block */}
          {!isEscalated && msg.worked_example && (
            <div className="rounded-xl border border-violet/20 bg-violet/5 p-4 my-3 space-y-1.5 text-xs shadow-sm">
              <div className="flex items-center gap-1.5 font-bold text-violet uppercase tracking-wider text-[11px]">
                <Code2 className="h-3.5 w-3.5" /> Worked Example
              </div>
              <div className="text-foreground/90 font-mono text-[12px] leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-violet/40">
                {msg.worked_example}
              </div>
            </div>
          )}

          {/* Visual Diagram Block */}
          {!isEscalated && msg.visual && <VisualRenderer visual={msg.visual} />}

          {/* Source citation chips */}
          {!isEscalated && msg.sources && msg.sources.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sources ({msg.sources.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.sources.map((src, i) => (
                  <SourceChipBadge key={i} source={src} onClick={onSourceClick} />
                ))}
              </div>
            </div>
          )}

          {/* Operational agent trace */}
          {msg.agent_trace && msg.agent_trace.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] font-mono text-muted-foreground">Trace:</span>
              {msg.agent_trace.map((step, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40"
                >
                  {typeof step === "string" ? step : (step as any)?.node ? `${(step as any).node}${(step as any)?.intent ? ` (${(step as any).intent})` : ""}` : JSON.stringify(step)}
                </span>
              ))}
            </div>
          )}

          {/* Follow-up question pills */}
          {!isEscalated && msg.follow_up && msg.follow_up.length > 0 && (
            <div className="pt-2 border-t border-border/50 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested Follow-Ups
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.follow_up.map((fu, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onFollowUpClick && onFollowUpClick(fu)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-violet/20 bg-violet/5 hover:bg-violet/15 text-violet font-medium transition text-left"
                  >
                    💬 {fu}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider badge */}
          {msg.provider && (
            <div className="text-[10px] text-muted-foreground">
              Generated by <span className="font-semibold capitalize">{msg.provider}</span>
            </div>
          )}

          {/* Feedback row */}
          {!isEscalated && (
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Helpful?</span>
                <button
                  type="button"
                  onClick={() => setRated("up")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2.5 py-1 transition",
                    rated === "up"
                      ? "border-success bg-success/10 text-success font-bold"
                      : "border-border bg-card text-muted-foreground hover:border-success hover:text-success",
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRated("down");
                    setShowCommentBox(true);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2.5 py-1 transition",
                    rated === "down"
                      ? "border-danger bg-danger/10 text-danger font-bold"
                      : "border-border bg-card text-muted-foreground hover:border-danger hover:text-danger",
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> No
                </button>
              </div>
              {rated && (
                <span className="text-[11px] text-success font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Recorded
                </span>
              )}
            </div>
          )}

          {showCommentBox && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowCommentBox(false);
              }}
              className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-2 text-xs"
            >
              <div className="font-semibold text-foreground">What could be improved?</div>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="e.g. Missing code example, outdated information…"
                rows={2}
                className="w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground outline-none focus:border-violet transition"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-violet to-[#7c3aed] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="mt-1 pl-2 text-[10px] text-muted-foreground">{msg.timestamp}</div>
      </div>
    </motion.div>
  );
}
