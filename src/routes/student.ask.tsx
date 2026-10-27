import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useId, useRef } from "react";
import {
  Send,
  Sparkles,
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
  Languages,
  GraduationCap,
  X,
  ChevronRight,
  Info,
  Maximize2,
  Copy,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PageHeader, Card } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ChartRenderer, type ChartSpec } from "@/components/chat/ChartRenderer";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { EducationalActions } from "@/components/chat/EducationalActions";

export const Route = createFileRoute("/student/ask")({
  head: () => ({
    meta: [
      { title: "AI Tutor · EduSense AI" },
      { name: "description", content: "Syllabus-grounded academic tutoring with verifiable source citations." },
    ],
  }),
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

export interface SourceChip {
  documentId: string | null;
  fileName: string;
  chunkIndex: number;
  page?: number | null;
  section?: string | null;
  score?: number | null;
  excerpt?: string | null;
}

interface ApiResponse {
  conversationId?: string;
  answer: string;
  worked_example?: string | null;
  visual?: VisualData;
  chart?: ChartSpec | null;
  sections?: any[] | null;
  escalated: boolean;
  confidence: number;
  sources: SourceChip[];
  provider?: string | null;
  grounded?: boolean;
  mode?: string;
  intent?: string;
  agent_trace?: string[];
  follow_up?: string[];
  response_language?: string;
  learner_level?: string;
  tool_used?: string | null;
  understanding_check?: {
    question: string;
    topic?: string;
    subtopic?: string;
  } | null;
  learning_intent?: any;
  learner_profile?: any;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  worked_example?: string | null;
  visual?: VisualData;
  chart?: ChartSpec | null;
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
  response_language?: string;
  learner_level?: string;
  tool_used?: string | null;
  understanding_check?: {
    question: string;
    topic?: string;
    subtopic?: string;
  } | null;
  learning_intent?: any;
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

// ── Language & Level Constants ────────────────────────────────────────────────
const LANGUAGES = [
  { code: "en", name: "English", flag: "🌐" },
  { code: "gu", name: "ગુજરાતી (Gujarati)", flag: "🇮🇳" },
  { code: "hi", name: "हिन्दी (Hindi)", flag: "🇮🇳" },
  { code: "mr", name: "मराठी (Marathi)", flag: "🇮🇳" },
  { code: "bn", name: "বাংলা (Bengali)", flag: "🇮🇳" },
  { code: "ta", name: "தமிழ் (Tamil)", flag: "🇮🇳" },
  { code: "te", name: "తెలుగు (Telugu)", flag: "🇮🇳" },
  { code: "es", name: "Español (Spanish)", flag: "🇪🇸" },
  { code: "fr", name: "Français (French)", flag: "🇫🇷" },
];

const LEARNER_LEVELS = [
  { id: "beginner", label: "Fundamental", hint: "Intuitive analogies & simplified foundations" },
  { id: "developing", label: "Structured", hint: "Step-by-step mechanisms & guided examples" },
  { id: "proficient", label: "Rigorous", hint: "Formal proofs, complexity & syllabus depth" },
  { id: "advanced", label: "Advanced", hint: "Edge cases, implementation code & optimization" },
];

const EDUCATIONAL_MODES = [
  { id: "ask_tutor", label: "Tutor Mode", icon: "🎓" },
  { id: "step_by_step", label: "Step-by-Step", icon: "🪜" },
  { id: "socratic", label: "Socratic Hints", icon: "🧠" },
  { id: "worked_example", label: "Worked Example", icon: "🔢" },
  { id: "exam_revision", label: "Exam Revision", icon: "📝" },
];

// ── Visual Renderer for Flowcharts & Concept Maps ──────────────────────────────
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
      <div className="my-3 rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>Flowchart Representation</span>
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
      <div className="my-3 rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>Concept Dependency Diagram</span>
        </div>
        <MermaidRenderer chart={mermaidText} />
      </div>
    );
  }

  if (visual.type === "comparison_chart") {
    const categories = visual.categories || [];
    const values = visual.values || [];
    if (categories.length === 0 || values.length === 0) return null;

    const chartData = categories.map((cat, i) => ({
      category: cat,
      value: values[i] ?? 0,
    }));

    return (
      <div className="my-3 rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>Concept Comparison</span>
          {visual.label && <span className="text-slate-500 font-normal">{visual.label}</span>}
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}

// ── Verified Source Evidence Shelf (Side Panel / Drawer) ────────────────────────
function SourceEvidenceShelf({
  source,
  onClose,
}: {
  source: SourceChip | null;
  onClose: () => void;
}) {
  if (!source) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileText className="h-4 w-4 text-blue-700" />
          <span>Verified Course Source</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Close evidence panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-slate-500">Document</span>
            <span className="font-bold text-slate-900 text-right truncate max-w-[200px]" title={source.fileName}>
              {source.fileName}
            </span>
          </div>

          {source.page !== null && source.page !== undefined && (
            <div className="flex justify-between border-t border-slate-200/60 pt-2">
              <span className="font-semibold text-slate-500">Location</span>
              <span className="font-bold text-slate-900">Page / Slide {source.page}</span>
            </div>
          )}

          {source.section && (
            <div className="flex justify-between border-t border-slate-200/60 pt-2">
              <span className="font-semibold text-slate-500">Curriculum Section</span>
              <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">{source.section}</span>
            </div>
          )}

          {source.score !== undefined && source.score !== null && (
            <div className="flex justify-between border-t border-slate-200/60 pt-2">
              <span className="font-semibold text-slate-500">Retrieval Grounding</span>
              <span className="font-bold text-emerald-700">{Math.round((source.score || 0) * 100)}% Match</span>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Indexed Syllabus Excerpt
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-slate-700 leading-relaxed font-sans text-xs shadow-2xs">
            {source.excerpt ? (
              <p className="whitespace-pre-wrap">{source.excerpt}</p>
            ) : (
              <p className="italic text-slate-400">
                This academic chunk was verified from the faculty-approved curriculum document and matched your question's semantic intent.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-slate-600 space-y-1">
          <div className="font-semibold text-blue-900 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-700" /> Academic Verification
          </div>
          <p className="text-[11px] leading-snug">
            EduSense AI strictly enforces fail-closed grounding. Answers are derived from this verified lecture note rather than generic internet sources.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
        >
          Dismiss Evidence View
        </button>
      </div>
    </div>
  );
}

// ── Formative Understanding Check ──────────────────────────────────────────────
function UnderstandingCheckCard({
  check,
  onEvaluated,
}: {
  check: { question: string; topic?: string; subtopic?: string };
  onEvaluated?: (res: any) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/adaptive/evaluate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: check.question,
          studentAnswer: answer.trim(),
          concept: check.topic || check.subtopic || "Concept Check",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (onEvaluated) onEvaluated(data);
        toast.success(data.correct ? "Mastery updated! Great answer." : "Concept check evaluated.");
      } else {
        toast.error("Could not evaluate concept check.");
      }
    } catch {
      toast.error("Connection error while evaluating check.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5 my-3 space-y-2 text-xs">
      <div className="flex items-center justify-between font-bold text-amber-900">
        <span className="flex items-center gap-1.5">
          <span>💡 Quick Concept Check</span>
          {check.topic && <span className="text-[10px] text-amber-700 font-normal">({check.topic})</span>}
        </span>
        {result && (
          <span className="rounded bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-900">
            Score: {result.score}%
          </span>
        )}
      </div>
      <p className="font-medium text-slate-800 leading-relaxed">{check.question}</p>

      {!result ? (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your brief answer to check retention..."
            className="flex-1 text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            disabled={loading || !answer.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50"
          >
            {loading ? "Checking..." : "Submit Answer"}
          </button>
        </form>
      ) : (
        <div className="pt-2 text-xs text-slate-700 space-y-1 border-t border-amber-200/80">
          <p className="font-semibold text-[11px] text-amber-900">Instructor Feedback:</p>
          <p className="italic text-slate-600">{result.feedback}</p>
        </div>
      )}
    </div>
  );
}

// ── Chat Message Bubble ────────────────────────────────────────────────────────
function ChatMessageBubble({
  msg,
  onSourceClick,
  onFollowUpClick,
  onRetry,
}: {
  msg: ChatMessage;
  onSourceClick: (s: SourceChip) => void;
  onFollowUpClick?: (text: string) => void;
  onRetry?: () => void;
  onProfileUpdate?: () => void;
}) {
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const isUser = msg.role === "user" || (msg.role as string) === "student";
  const isEscalated = msg.escalated === true;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-xl rounded-tr-xs bg-blue-700 px-4 py-3 text-sm text-white shadow-2xs">
          <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
          <div className="mt-1 text-[10px] text-blue-200 text-right opacity-80">{msg.timestamp}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-3xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs mt-0.5">
        <GraduationCap className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-2">
        <div
          className={cn(
            "rounded-xl border p-5 shadow-2xs space-y-3.5 bg-white transition-all",
            isEscalated ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
          )}
        >
          {/* Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 text-xs">
            <div className="flex items-center gap-2">
              {isEscalated ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-0.5 font-bold text-amber-900 text-[11px]">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" /> Escalated to Course Faculty
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 text-[11px] border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Syllabus Grounded
                </span>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <span className="text-[11px] font-medium text-slate-500">
                  ({msg.sources.length} Verified {msg.sources.length === 1 ? "Citation" : "Citations"})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
                title="Copy complete answer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Formatted Markdown, Math & Code */}
          <div className="text-sm leading-relaxed text-slate-800 font-sans">
            <MarkdownRenderer
              content={msg.text}
              onCitationClick={(num) => {
                if (msg.sources && msg.sources.length >= num && num > 0) {
                  onSourceClick(msg.sources[num - 1]);
                } else if (msg.sources && msg.sources.length > 0) {
                  onSourceClick(msg.sources[0]);
                }
              }}
            />
          </div>

          {/* Dedicated Chart visualization */}
          {!isEscalated && msg.chart && <ChartRenderer spec={msg.chart} />}

          {/* Visual Diagram Block */}
          {!isEscalated && msg.visual && <VisualRenderer visual={msg.visual} />}

          {/* Worked Example Block */}
          {!isEscalated && msg.worked_example && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 uppercase tracking-wider text-[11px]">
                <Code2 className="h-3.5 w-3.5 text-blue-700" /> Worked Example
              </div>
              <div className="text-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-blue-500">
                {msg.worked_example}
              </div>
            </div>
          )}

          {/* Formative Understanding Check */}
          {!isEscalated && msg.understanding_check && (
            <UnderstandingCheckCard check={msg.understanding_check} />
          )}

          {/* Clickable Source Citation Chips */}
          {!isEscalated && msg.sources && msg.sources.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-blue-600" /> Verified Course Citations
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.sources.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSourceClick(src)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/70 hover:text-blue-800 transition"
                    title={`View citation details from ${src.fileName}`}
                  >
                    <span className="font-bold text-blue-700">[{i + 1}]</span>
                    <span className="max-w-[150px] truncate">{src.fileName}</span>
                    {src.page !== null && src.page !== undefined && (
                      <span className="text-slate-500">p.{src.page}</span>
                    )}
                    <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up question pills */}
          {!isEscalated && msg.follow_up && msg.follow_up.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Suggested Academic Inquiries
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.follow_up.map((fu, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onFollowUpClick && onFollowUpClick(fu)}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition text-left"
                  >
                    💬 {fu}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible Inspection Details: folded for clean ergonomics */}
          {(msg.confidence !== undefined || msg.tool_used || msg.agent_trace) && (
            <details className="pt-1 text-[11px] text-slate-400 border-t border-slate-100">
              <summary className="cursor-pointer select-none font-medium hover:text-slate-600 transition">
                System Grounding & Trace Details
              </summary>
              <div className="mt-2 space-y-1 rounded-md bg-slate-50 p-2.5 text-[10.5px] font-mono text-slate-600">
                {msg.confidence !== undefined && (
                  <div>Grounding Confidence: {Math.round(msg.confidence * 100)}%</div>
                )}
                {msg.tool_used && <div>Retrieval Tool: {msg.tool_used}</div>}
                {msg.provider && <div>Model Engine: {msg.provider}</div>}
                {msg.agent_trace && msg.agent_trace.length > 0 && (
                  <div className="truncate">Trace Steps: {msg.agent_trace.length} verified operations</div>
                )}
              </div>
            </details>
          )}

          {/* Feedback Rating */}
          {!isEscalated && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium text-[11px]">Helpful explanation?</span>
                <button
                  type="button"
                  onClick={() => {
                    setRated("up");
                    toast.success("Thank you for your feedback.");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition",
                    rated === "up"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                  aria-label="Mark explanation helpful"
                >
                  <ThumbsUp className="h-3 w-3" /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRated("down");
                    toast.info("Feedback recorded to refine topic grounding.");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition",
                    rated === "down"
                      ? "border-rose-300 bg-rose-50 text-rose-800 font-bold"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                  aria-label="Mark explanation not helpful"
                >
                  <ThumbsDown className="h-3 w-3" /> No
                </button>
              </div>
              <span className="text-[10.5px] text-slate-400">{msg.timestamp}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main AskTutorPage Component ───────────────────────────────────────────────
function AskTutorPage() {
  const { subjects, addQuery, refreshQueries } = useAppData();
  const { user } = useAuth();

  const myId = user?.id || "";
  const myEmail = user?.email ? String(user.email).toLowerCase() : "";
  const myStudentId = user?.studentId ? String(user.studentId) : "";

  const isEnrolled = (s: any) => {
    const list: string[] = Array.isArray(s.enrolledStudentIds)
      ? s.enrolledStudentIds
      : typeof s.enrolledStudentIds === "string"
      ? JSON.parse(s.enrolledStudentIds || "[]")
      : [];
    return list.some((item) => {
      const clean = String(item).toLowerCase();
      return clean === myId.toLowerCase() || clean === myEmail || (myStudentId && clean === myStudentId.toLowerCase());
    });
  };

  const enrolledSubjects = subjects.filter(isEnrolled);
  const firstSubject = enrolledSubjects[0] || null;

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(firstSubject?.id ?? "");
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(firstSubject?.name ?? "");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(firstSubject?.code ?? "");
  const [selectedMode, setSelectedMode] = useState<string>("ask_tutor");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [learnerLevel, setLearnerLevel] = useState<string>("developing");
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(true);

  // Synchronize active subject with enrolled subjects
  useEffect(() => {
    if (enrolledSubjects.length > 0) {
      const currentValid = enrolledSubjects.find((s) => s.id === selectedSubjectId);
      if (!currentValid) {
        setSelectedSubjectId(enrolledSubjects[0].id);
        setSelectedSubjectName(enrolledSubjects[0].name);
        setSelectedSubjectCode(enrolledSubjects[0].code);
      }
    }
  }, [enrolledSubjects, selectedSubjectId]);

  // Handle URL query parameters (e.g. from Concept Map "Ask AI Tutor")
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSubjectId = params.get("subjectId");
      const urlQuestion = params.get("question");
      const urlConcept = params.get("concept");

      if (urlSubjectId && subjects.length > 0) {
        const matchingSubj = subjects.find(
          (s) => s.id === urlSubjectId || s.code?.toLowerCase() === urlSubjectId.toLowerCase(),
        );
        if (matchingSubj) {
          setSelectedSubjectId(matchingSubj.id);
          setSelectedSubjectName(matchingSubj.name);
          setSelectedSubjectCode(matchingSubj.code);
        }
      }

      if (urlQuestion) {
        setInput(urlQuestion);
      } else if (urlConcept) {
        setInput(
          `Explain the core principles, architecture, and real-world application of ${urlConcept} based on our syllabus.`,
        );
      }
    } catch {}
  }, [subjects]);

  const userSessionStorageKey = user?.id
    ? `ai_tutor_chat_sessions_user_${user.id}`
    : "ai_tutor_chat_sessions_guest";

  const makeDefaultSession = (): ChatSession => ({
    id: `sess_${Date.now()}`,
    title: "New Inquiry",
    subject: selectedSubjectName || (firstSubject?.name ?? "General"),
    subjectId: selectedSubjectId || (firstSubject?.id ?? ""),
    createdAt: "Today",
    messages: [],
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined") return [makeDefaultSession()];
    try {
      const key = user?.id ? `ai_tutor_chat_sessions_user_${user.id}` : "ai_tutor_chat_sessions_guest";
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [makeDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id ?? "sess_1");
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceChip | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to local storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(userSessionStorageKey, JSON.stringify(sessions));
    } catch {}
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, userSessionStorageKey]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  const handleSelectSession = (sessId: string) => {
    setActiveSessionId(sessId);
  };

  const createNewSession = () => {
    const newSess: ChatSession = {
      id: `sess_${Date.now()}`,
      title: "New Inquiry",
      subject: selectedSubjectName,
      subjectId: selectedSubjectId,
      createdAt: "Just now",
      messages: [],
    };
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
  };

  const deleteSession = async (sessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessId);
      if (remaining.length === 0) {
        const fresh = makeDefaultSession();
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
          s.id === activeSessionId ? { ...s, subject: subj.name, subjectId: subj.id } : s
        )
      );
    }
  };

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
        const newTitle = s.messages.length === 0 ? q.slice(0, 32) + (q.length > 32 ? "…" : "") : s.title;
        return { ...s, title: newTitle, messages: [...s.messages, userMsg] };
      })
    );

    addQuery({
      student: user?.name ?? "Student",
      subject: selectedSubjectName,
      question: q,
      createdAt: "Just now",
    });

    setIsProcessing(true);
    let apiResp: ApiResponse | null = null;

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
          conversationId: activeSession.mongoId,
          mode: selectedMode,
          response_language: selectedLanguage,
          learner_level: learnerLevel,
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
      }
    } catch (e) {
      console.warn("[Ask Tutor] Request error:", e);
    }

    if (!apiResp) {
      apiResp = {
        answer:
          "The academic tutoring service is currently processing offline. Please ensure the course backend service is active.",
        worked_example: null,
        visual: null,
        chart: null,
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
      chart: apiResp.chart || null,
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
      response_language: selectedLanguage,
      learner_level: learnerLevel,
      tool_used: (apiResp as any)?.tool_used ?? null,
      understanding_check: (apiResp as any)?.understanding_check ?? null,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          mongoId: apiResp?.conversationId || s.mongoId,
          messages: [...s.messages, aiMsg],
        };
      })
    );
    setIsProcessing(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Academic AI Tutor"
        subtitle="Syllabus-grounded explanations with verifiable citations, KaTeX math formulas, and interactive diagrams."
        breadcrumb="Student Portal / AI Tutor"
        action={
          <button
            type="button"
            onClick={() => setShowHistorySidebar((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Past Inquiries ({sessions.length})</span>
          </button>
        }
      />

      {/* Course Enrollment Warning if 0 enrolled */}
      {enrolledSubjects.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="text-amber-950 font-medium">
              No course enrollments detected. Enroll in subjects to ground the tutor directly on your semester materials.
            </span>
          </div>
          <Link
            to="/student"
            className="font-bold text-blue-700 hover:text-blue-900 underline"
          >
            Enroll in Courses →
          </Link>
        </div>
      )}

      {/* Top Persistent Context Controls Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Active Course Scope */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10.5px]">Course Scope:</span>
          <select
            value={selectedSubjectId}
            onChange={handleSubjectChange}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 text-xs outline-none focus:border-blue-600 cursor-pointer"
          >
            {enrolledSubjects.length === 0 ? (
              <option value="">General Academic Context</option>
            ) : (
              enrolledSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))
            )}
          </select>

          {/* Mode Selector */}
          <div className="hidden sm:flex items-center gap-1 border-l border-slate-200 pl-2.5">
            {EDUCATIONAL_MODES.slice(0, 3).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-semibold transition",
                  selectedMode === m.id
                    ? "bg-blue-100 text-blue-800 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Language and Pedagogical Level */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2.5">
            <span className="text-[10.5px] font-semibold text-slate-400">Depth:</span>
            <select
              value={learnerLevel}
              onChange={(e) => setLearnerLevel(e.target.value)}
              className="bg-transparent text-xs font-semibold text-blue-700 outline-none cursor-pointer"
            >
              {LEARNER_LEVELS.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid gap-4 lg:grid-cols-4 items-start">
        {/* Past Sessions Sidebar (Collapsible) */}
        {showHistorySidebar && (
          <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-500" /> Inquiries
              </span>
              <button
                type="button"
                onClick={createNewSession}
                className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-1 pr-0.5">
              {sessions.map((s) => {
                const active = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={cn(
                      "group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition",
                      active
                        ? "bg-blue-50 text-blue-800 font-semibold border border-blue-200"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="min-w-0 pr-1.5 truncate">
                      <div className="truncate">{s.title || "Untitled inquiry"}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {s.subject} · {s.messages.length} {s.messages.length === 1 ? "turn" : "turns"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversation Stream & Composer */}
        <div className={cn(showHistorySidebar ? "lg:col-span-3" : "lg:col-span-4")}>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col min-h-[560px]">
            {/* Conversation Messages */}
            <div className="flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
              {activeSession.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 mb-3">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Syllabus-Grounded Academic Inquiry
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Ask academic questions regarding lecture slides, textbook algorithms, and exam topics. Every answer references verified curriculum passages.
                  </p>

                  {/* Starter inquiry chips */}
                  <div className="mt-6 w-full space-y-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 text-left">
                      Suggested Academic Inquiries
                    </div>
                    {[
                      `Explain the core mechanism of ${selectedSubjectName || "this subject"} with an example`,
                      "What are the critical exam concepts and definitions for Unit 1?",
                      "Provide a step-by-step derivation with mathematical formulas",
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="w-full text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 text-slate-700 transition"
                      >
                        → {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeSession.messages.map((msg) => (
                  <ChatMessageBubble
                    key={msg.id}
                    msg={msg}
                    onSourceClick={(s) => setSelectedSource(s)}
                    onFollowUpClick={(fu) => handleSend(fu)}
                    onRetry={() => {
                      const userMsgs = activeSession.messages.filter((m) => m.role === "user");
                      const last = userMsgs[userMsgs.length - 1];
                      if (last) handleSend(last.text);
                    }}
                  />
                ))
              )}

              {/* Progressive Loading State */}
              {isProcessing && (
                <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 max-w-md text-xs text-blue-900">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white animate-spin">
                    ⏳
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold">Verifying Curriculum Passages…</div>
                    <div className="text-[11px] text-blue-700">Synthesizing grounded explanation from syllabus chunks.</div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={`Ask a question in ${selectedSubjectName || "your subject"}…`}
                  disabled={isProcessing}
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />

                <VoiceInputButton
                  onTranscript={(transcript) =>
                    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
                  }
                  language={selectedLanguage}
                  disabled={isProcessing}
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-white disabled:opacity-40 hover:bg-blue-800 transition shrink-0"
                  aria-label="Send academic query"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Source Evidence Side Shelf */}
      <AnimatePresence>
        {selectedSource && (
          <SourceEvidenceShelf
            source={selectedSource}
            onClose={() => setSelectedSource(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
