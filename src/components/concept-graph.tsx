import { useState } from "react";
import {
  Network, BookOpen, Star, AlertCircle, Sparkles, FileText,
  HelpCircle, ArrowRight, Layers, CheckCircle2, Lock,
} from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import type { ConceptNode } from "@/lib/mock-data";
import { useNavigate, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const MASTERY_COLORS: Record<ConceptNode["mastery"], { bg: string; text: string; label: string }> = {
  mastered: { bg: "bg-green-brand/10", text: "text-green-700", label: "Mastered ✓" },
  weak:     { bg: "bg-amber-brand/15", text: "text-amber-700", label: "Needs Revision ⚡" },
  unread:   { bg: "bg-muted",      text: "text-muted-foreground", label: "Unread 📖" },
};

const DOMAIN_COLORS: Record<string, string> = {
  "Storage Layer":            "#4F46E5", // Indigo
  "Batch Processing":         "#0284C7", // Sky blue
  "In-Memory Engine":         "#0D9488", // Teal
  "Distributed Architecture": "#D97706", // Amber
  "Consensus Protocols":      "#DC2626", // Red
  "Containerization":         "#16A34A", // Green
  "Statistical ML":           "#8B5CF6", // Purple
  "Deep Learning":            "#EC4899", // Pink
  "Memory Management":        "#64748B", // Slate
};

export function ConceptGraphView() {
  const { conceptNodes, conceptEdges, subjects, documents } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isStudent = user?.role === "student";

  const isEnrolled = (s: any) => {
    if (!isStudent) return true;
    const myId = user?.id || "";
    const myEmail = user?.email ? String(user.email).toLowerCase() : "";
    const myStudentId = (user as any)?.studentId ? String((user as any).studentId).toLowerCase() : "";
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

  const availableSubjects = isStudent ? subjects.filter(isEnrolled) : subjects;
  const enrolledSubjectIds = new Set(availableSubjects.map((s) => s.id));
  const enrolledSubjectNames = new Set(availableSubjects.map((s) => s.name.toLowerCase()));
  const enrolledSubjectCodes = new Set(availableSubjects.map((s) => (s.code || "").toLowerCase()));

  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedNodeId, setSelectedNodeId]   = useState<string | null>("mapreduce");

  // If student is enrolled in 0 subjects, lock the view
  if (isStudent && availableSubjects.length === 0) {
    return (
      <div>
        <PageHeader
          title="Interactive Knowledge Graph & Concept Map"
          subtitle="Visual relationship map connecting CSE topics across subjects, prerequisite dependencies, and mastery status."
        />
        <Card className="border-amber-500/30 bg-amber-500/5 p-8 text-center max-w-xl mx-auto my-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground">
            Concept Map Locked — 0 Subjects Enrolled
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            You are not currently enrolled in any subjects. The visual knowledge graph and prerequisite maps are dynamically populated from your enrolled courses. Please enroll in a subject to unlock the concept map.
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

  const baseNodes = isStudent
    ? conceptNodes.filter(
        (n) =>
          enrolledSubjectIds.has(n.subjectId) ||
          enrolledSubjectNames.has((n.subjectName || "").toLowerCase()) ||
          enrolledSubjectCodes.has((n.subjectName || "").toLowerCase())
      )
    : conceptNodes;

  const filteredNodes = selectedSubject === "all"
    ? baseNodes
    : baseNodes.filter((n) => n.subjectId === selectedSubject);

  const selectedNode = baseNodes.find((n) => n.id === selectedNodeId) ?? baseNodes[0];

  const connectedEdges = conceptEdges.filter(
    (e) => e.source === selectedNode?.id || e.target === selectedNode?.id
  );

  const handleAskAIAboutRelationship = (targetNodeLabel: string, edgeLabel: string) => {
    // Navigate to student ask page with pre-filled question
    navigate({
      to: "/student/ask",
    });
  };

  return (
    <div>
      <PageHeader
        title="Interactive Knowledge Graph & Concept Map"
        subtitle="Visual relationship map connecting CSE topics across subjects, prerequisite dependencies, and mastery status."
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Filter Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-violet font-medium"
            >
              <option value="all">
                {isStudent ? "All Enrolled Subjects" : "All Subjects (Platform Graph)"}
              </option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Interactive SVG Network Graph ── */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-violet" />
                <span className="font-serif text-lg font-bold text-foreground">
                  Concept Network Graph
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Mastered</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Needs Revision</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Unread</span>
              </div>
            </div>

            {/* SVG Visual Canvas */}
            <div className="relative rounded-xl border border-border bg-accent/40/50 p-4 min-h-[460px] flex items-center justify-center">
              <svg width="100%" height="440" viewBox="0 0 800 560" className="w-full h-auto">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="28"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#94A3B8" />
                  </marker>
                </defs>

                {/* Render Edges */}
                {conceptEdges.map((e) => {
                  const srcNode = baseNodes.find((n) => n.id === e.source);
                  const tgtNode = baseNodes.find((n) => n.id === e.target);
                  if (!srcNode || !tgtNode) return null;

                  const isConnected = selectedNode?.id === e.source || selectedNode?.id === e.target;

                  return (
                    <g key={e.id}>
                      <line
                        x1={srcNode.x}
                        y1={srcNode.y}
                        x2={tgtNode.x}
                        y2={tgtNode.y}
                        stroke={isConnected ? "#4F46E5" : "#CBD5E1"}
                        strokeWidth={isConnected ? "2.5" : "1.5"}
                        strokeDasharray={isConnected ? "none" : "4 4"}
                        markerEnd="url(#arrowhead)"
                      />
                      <text
                        x={(srcNode.x + tgtNode.x) / 2}
                        y={(srcNode.y + tgtNode.y) / 2 - 6}
                        textAnchor="middle"
                        fill={isConnected ? "#4F46E5" : "#64748B"}
                        className="text-[10px] font-semibold tracking-wide fill-slate-500"
                      >
                        {e.label}
                      </text>
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {filteredNodes.map((n) => {
                  const isSelected = selectedNode?.id === n.id;
                  const nodeColor = DOMAIN_COLORS[n.domain] ?? "#4F46E5";
                  const mastery = MASTERY_COLORS[n.mastery];

                  return (
                    <g
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className="cursor-pointer transition-all duration-200"
                    >
                      {/* Outer Selection Ring */}
                      {isSelected && (
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r="32"
                          fill="none"
                          stroke={nodeColor}
                          strokeWidth="3"
                          className="animate-pulse"
                        />
                      )}

                      {/* Node Circle */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r="24"
                        fill={isSelected ? nodeColor : "#FFFFFF"}
                        stroke={nodeColor}
                        strokeWidth="3"
                        className="shadow-md transition hover:scale-110"
                      />

                      {/* Domain indicator dot */}
                      <circle
                        cx={n.x + 14}
                        cy={n.y - 14}
                        r="6"
                        fill={n.mastery === "mastered" ? "#16A34A" : n.mastery === "weak" ? "#D97706" : "#94A3B8"}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />

                      {/* Node Label Text */}
                      <text
                        x={n.x}
                        y={n.y + 40}
                        textAnchor="middle"
                        className={cn(
                          "text-xs font-bold font-serif fill-slate-800",
                          isSelected ? "fill-indigo-900 font-extrabold" : ""
                        )}
                      >
                        {n.label}
                      </text>
                      <text
                        x={n.x}
                        y={n.y + 53}
                        textAnchor="middle"
                        className="text-[10px] fill-slate-400 font-sans"
                      >
                        {n.subjectName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </Card>
        </div>

        {/* ── Concept Inspector Drawer ── */}
        <div className="lg:col-span-1">
          {selectedNode ? (
            <Card title="Concept Inspector">
              <div className="space-y-4">

                {/* Node Title & Mastery */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: DOMAIN_COLORS[selectedNode.domain] ?? "#4F46E5" }}>
                      {selectedNode.domain}
                    </span>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", MASTERY_COLORS[selectedNode.mastery].bg, MASTERY_COLORS[selectedNode.mastery].text)}>
                      {MASTERY_COLORS[selectedNode.mastery].label}
                    </span>
                  </div>
                  <div className="mt-3 font-serif text-xl font-bold text-foreground">
                    {selectedNode.label}
                  </div>
                  <div className="mt-1 text-xs text-violet font-medium">
                    {selectedNode.subjectName}
                  </div>
                </div>

                {/* Concept Summary */}
                <div className="rounded-xl border border-border bg-accent/40 p-3 text-xs text-foreground leading-relaxed">
                  {selectedNode.summary}
                </div>

                {/* Connected Concepts */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Graph Relationships ({connectedEdges.length})
                  </div>
                  <div className="space-y-2">
                    {connectedEdges.map((e) => {
                      const isSource = e.source === selectedNode?.id;
                      const otherId = isSource ? e.target : e.source;
                      const otherNode = baseNodes.find((n) => n.id === otherId);
                      return (
                        <div key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5 text-xs">
                          <div>
                            <span className="text-muted-foreground font-medium">{isSource ? `→ ${e.label}: ` : `← ${e.label} by: `}</span>
                            <span className="font-bold text-foreground">{otherNode?.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(otherId)}
                            className="text-xs text-violet hover:underline font-medium"
                          >
                            view
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Related Course Materials */}
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Related Course Documents
                  </div>
                  <div className="space-y-1.5">
                    {selectedNode.relatedDocNames.map((dName) => (
                      <div key={dName} className="flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-2 text-xs font-medium text-foreground">
                        <FileText className="h-3.5 w-3.5 text-violet shrink-0" />
                        <span className="truncate">{dName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick AI Ask Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/student/ask" })}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-brand px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-brand-hover shadow-sm transition"
                  >
                    <Sparkles className="h-4 w-4" /> Ask AI Tutor about {selectedNode.label}
                  </button>
                </div>

              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-xs text-muted-foreground italic text-center py-10">Select a node on the graph to inspect relationships.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
