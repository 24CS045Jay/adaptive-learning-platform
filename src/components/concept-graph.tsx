import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Network,
  BookOpen,
  Sparkles,
  FileText,
  ArrowRight,
  CheckCircle2,
  Lock,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ExternalLink,
  Compass,
  AlertTriangle,
  Clock,
  ListChecks,
  Check,
  RefreshCw,
  Info,
} from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import type { ConceptNode, ConceptEdge } from "@/lib/mock-data";
import { useNavigate, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ── Domain Color Palette ──────────────────────────────────────────────────────
const DOMAIN_STYLES: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  "Data Engineering": { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", accent: "#3B82F6" },
  "Distributed Systems": { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30", accent: "#6366F1" },
  "Storage Layer": { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30", accent: "#06B6D4" },
  "Batch Processing": { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", accent: "#F59E0B" },
  "Cluster Management": { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", accent: "#A855F7" },
  "Statistical ML": { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", accent: "#10B981" },
  "Clustering": { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30", accent: "#14B8A6" },
  "Pattern Mining": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30", accent: "#F43F5E" },
  "Dimensionality Reduction": { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/30", accent: "#8B5CF6" },
  "Core Curriculum": { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30", accent: "#64748B" },
};

function getDomainStyle(domain: string = "") {
  return DOMAIN_STYLES[domain] || DOMAIN_STYLES["Core Curriculum"];
}

// ── Mastery Badges ────────────────────────────────────────────────────────────
const MASTERY_CONFIG = {
  mastered: {
    label: "Mastered",
    icon: CheckCircle2,
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    nodeBorder: "border-emerald-500",
    nodeBg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    nodeBorder: "border-blue-500",
    nodeBg: "bg-blue-50/50 dark:bg-blue-950/20",
    dot: "bg-blue-500",
  },
  weak: {
    label: "Needs Revision",
    icon: AlertTriangle,
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    nodeBorder: "border-amber-500",
    nodeBg: "bg-amber-50/50 dark:bg-amber-950/20",
    dot: "bg-amber-500",
  },
  unread: {
    label: "Not Started",
    icon: BookOpen,
    badgeBg: "bg-muted text-muted-foreground border-border",
    nodeBorder: "border-border",
    nodeBg: "bg-card",
    dot: "bg-slate-400",
  },
};

type FilterStatus = "all" | "unread" | "in_progress" | "weak" | "mastered";

export function ConceptGraphView() {
  const {
    conceptNodes,
    conceptEdges,
    recommendedNodeId,
    recommendationReason,
    refreshConceptGraph,
    markConceptReviewed,
    generateConceptGraph,
    subjects,
    documents,
  } = useAppData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isStudent = user?.role === "student";

  // Check enrollment
  const isEnrolled = useCallback(
    (s: any) => {
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
    },
    [isStudent, user],
  );

  const availableSubjects = useMemo(() => {
    return isStudent ? subjects.filter(isEnrolled) : subjects;
  }, [isStudent, subjects, isEnrolled]);

  const defaultSubj = availableSubjects[0]?.id || "all";
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubj);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Zoom & Pan Canvas State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync graph on subject change
  useEffect(() => {
    if (selectedSubject && selectedSubject !== "all") {
      setIsRefreshing(true);
      refreshConceptGraph(selectedSubject).finally(() => setIsRefreshing(false));
    } else if (availableSubjects.length > 0 && selectedSubject === "all") {
      setSelectedSubject(availableSubjects[0].id);
    }
  }, [selectedSubject, availableSubjects, refreshConceptGraph]);

  // Set initial selected node
  useEffect(() => {
    if (conceptNodes.length > 0 && !selectedNodeId) {
      if (recommendedNodeId && conceptNodes.some((n) => n.id === recommendedNodeId)) {
        setSelectedNodeId(recommendedNodeId);
      } else {
        setSelectedNodeId(conceptNodes[0].id);
      }
    }
  }, [conceptNodes, recommendedNodeId, selectedNodeId]);

  // Active Subject details
  const activeSubjectObj = useMemo(() => {
    return availableSubjects.find((s) => s.id === selectedSubject) || availableSubjects[0] || null;
  }, [availableSubjects, selectedSubject]);

  // Approved docs for active subject
  const subjectApprovedDocs = useMemo(() => {
    if (!selectedSubject || selectedSubject === "all") return documents.filter((d) => d.status === "approved");
    return documents.filter((d) => d.subjectId === selectedSubject && d.status === "approved");
  }, [documents, selectedSubject]);

  // Group concept nodes by Milestone
  const milestoneGroups = useMemo(() => {
    const groups: Record<string, ConceptNode[]> = {};
    conceptNodes.forEach((node) => {
      const milestone = node.milestone || node.unit || "Core Learning Sequence";
      if (!groups[milestone]) groups[milestone] = [];
      groups[milestone].push(node);
    });
    return groups;
  }, [conceptNodes]);

  // Filtered nodes based on search & status
  const visibleNodes = useMemo(() => {
    return conceptNodes.filter((n) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.summary.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "unread" && n.mastery === "unread") ||
        (statusFilter === "in_progress" && n.mastery === "in_progress") ||
        (statusFilter === "weak" && n.mastery === "weak") ||
        (statusFilter === "mastered" && n.mastery === "mastered");

      return matchesSearch && matchesStatus;
    });
  }, [conceptNodes, searchQuery, statusFilter]);

  const selectedNode = useMemo(() => {
    return conceptNodes.find((n) => n.id === selectedNodeId) || conceptNodes[0] || null;
  }, [conceptNodes, selectedNodeId]);

  // Prerequisite & dependent edges connected to selected node
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return conceptEdges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id,
    );
  }, [conceptEdges, selectedNode]);

  // Interactive Pan & Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".roadmap-card") || (e.target as HTMLElement).closest("button")) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(1.6, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.15));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Actions
  const handleMarkAsReviewed = async () => {
    if (!selectedNode) return;
    setIsReviewing(true);
    try {
      const ok = await markConceptReviewed(selectedNode.id, selectedNode.subjectId);
      if (ok) {
        toast.success(`"${selectedNode.label}" marked as reviewed! Progress recorded.`);
      } else {
        toast.error("Could not record review. Please try again.");
      }
    } catch {
      toast.error("Network error recording review.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleAskAITutor = (concept: ConceptNode) => {
    const questionText = `Explain ${concept.label} in detail based on our course material. What are its core mechanisms, architecture, and real-world trade-offs?`;
    navigate({
      to: "/student/ask",
      search: {
        subjectId: concept.subjectId,
        concept: concept.label,
        question: questionText,
      } as any,
    });
  };

  const handlePracticeQuiz = (concept: ConceptNode) => {
    navigate({
      to: "/student/quizzes",
    });
  };

  const handleGenerateGraph = async () => {
    if (!selectedSubject || selectedSubject === "all") return;
    setIsRefreshing(true);
    try {
      const ok = await generateConceptGraph(selectedSubject);
      if (ok) {
        toast.success("Concept roadmap synchronized from course material!");
      } else {
        toast.error("Failed to generate concept map.");
      }
    } catch {
      toast.error("Error generating concept map.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Locked State if 0 enrolled subjects ──
  if (isStudent && availableSubjects.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Adaptive Concept Roadmap"
          subtitle="Interactive learning sequence connecting course concepts, verified prerequisites, and real student mastery."
        />
        <Card className="border-amber-500/30 bg-amber-500/5 p-10 text-center max-w-xl mx-auto my-12 rounded-2xl shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground">
            Concept Roadmap Locked — 0 Subjects Enrolled
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            You are not currently enrolled in any subjects. The visual knowledge graph and prerequisite learning sequences are dynamically populated from your enrolled courses.
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

  // Calculate roadmap statistics
  const totalConcepts = conceptNodes.length;
  const masteredCount = conceptNodes.filter((n) => n.mastery === "mastered").length;
  const inProgressCount = conceptNodes.filter((n) => n.mastery === "in_progress").length;
  const weakCount = conceptNodes.filter((n) => n.mastery === "weak").length;
  const unreadCount = conceptNodes.filter((n) => n.mastery === "unread").length;
  const progressPct = totalConcepts > 0 ? Math.round((masteredCount / totalConcepts) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header & Course Selector ── */}
      <PageHeader
        title="Adaptive Concept Roadmap"
        subtitle="Visual, interactive learning sequence inspired by roadmap.sh, grounded strictly in uploaded course materials and your demonstrated mastery."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Subject:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs md:text-sm font-semibold outline-none focus:border-violet shadow-2xs"
              >
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || "CSE"})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateGraph}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition shadow-2xs disabled:opacity-50"
              title="Synchronize roadmap with latest course documents"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-violet")} />
              <span className="hidden sm:inline">Sync from Docs</span>
            </button>

            {/* External Reference Link (Phase 7) */}
            <a
              href="https://roadmap.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-accent/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition shadow-2xs"
              title="View external reference roadmap.sh"
            >
              <span>Explore roadmap.sh</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        }
      />

      {/* ── Adaptive Recommendation Callout (Phase 5) ── */}
      {recommendedNodeId && (
        <div className="rounded-2xl border border-violet/30 bg-gradient-to-r from-violet/10 via-indigo-500/5 to-transparent p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet text-white shadow-md">
              <Compass className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet">
                  Adaptive Learning Sequence
                </span>
                <span className="rounded-full bg-violet/20 px-2 py-0.5 text-[10px] font-bold text-violet">
                  Recommended Next Step
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-foreground mt-0.5">
                {conceptNodes.find((n) => n.id === recommendedNodeId)?.label || "Next Course Concept"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                {recommendationReason ||
                  "Based on your verified prerequisite progress and course syllabus sequence."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setSelectedNodeId(recommendedNodeId)}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-2 text-xs font-bold text-white hover:bg-violet-hover transition shadow-sm"
            >
              Focus Next Topic <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Empty State: Subject has 0 uploaded documents / concepts ── */}
      {conceptNodes.length === 0 && (
        <Card className="border-border p-12 text-center rounded-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="font-serif text-lg font-bold text-foreground">
            No Concept Roadmap Available Yet
          </h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Authorized course materials and syllabus documents for <strong>{activeSubjectObj?.name}</strong> have not been approved yet. Once faculty uploads approved documents, EduSense AI generates the interactive concept roadmap.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleGenerateGraph}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-hover transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              Sync & Generate From Uploaded Material
            </button>
          </div>
        </Card>
      )}

      {conceptNodes.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Left / Center Column: Interactive Roadmap Canvas (2 cols) ── */}
          <div className="lg:col-span-2 space-y-3">
            {/* Control Bar: Filter Pills, Search, Zoom */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-2xs">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                {(
                  [
                    { id: "all", label: "All", count: totalConcepts },
                    { id: "mastered", label: "Mastered", count: masteredCount },
                    { id: "in_progress", label: "In Progress", count: inProgressCount },
                    { id: "weak", label: "Needs Rev.", count: weakCount },
                    { id: "unread", label: "Not Started", count: unreadCount },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5",
                      statusFilter === f.id
                        ? "bg-violet text-white shadow-2xs"
                        : "bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <span>{f.label}</span>
                    <span
                      className={cn(
                        "text-[10px] rounded-full px-1.5 py-0.2",
                        statusFilter === f.id
                          ? "bg-white/20 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Zoom controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-44">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-border bg-background focus:outline-none focus:border-violet"
                  />
                </div>

                <div className="flex items-center gap-1 border-l border-border pl-2">
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetView}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Reset view"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Roadmap Viewport */}
            <Card className="overflow-hidden p-0 relative border-border bg-slate-50/50 dark:bg-slate-950/40 min-h-[580px] select-none rounded-2xl">
              {/* Subtle Roadmap Grid Background */}
              <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, currentColor 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Start Milestone Header Banner */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-xl bg-card/90 backdrop-blur-md border border-border px-3 py-1.5 shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-foreground">
                  🏁 Learning Track: {activeSubjectObj?.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  ({progressPct}% Mastered)
                </span>
              </div>

              {/* Zoom badge */}
              <div className="absolute bottom-4 left-4 z-10 text-[10px] font-mono text-muted-foreground bg-card/80 backdrop-blur-md px-2 py-1 rounded-md border border-border">
                Zoom: {Math.round(zoom * 100)}% | Drag canvas to pan
              </div>

              {/* Pan & Zoom Canvas Area */}
              <div
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={cn(
                  "w-full h-[580px] overflow-hidden relative cursor-grab active:cursor-grabbing",
                  isPanning && "cursor-grabbing",
                )}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "top left",
                    transition: isPanning ? "none" : "transform 0.15s ease-out",
                  }}
                  className="w-[960px] min-h-[720px] p-8 relative"
                >
                  {/* SVG Connecting Edges (Prerequisites & Sequences) */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-0"
                    style={{ minWidth: 960, minHeight: 720 }}
                  >
                    <defs>
                      <marker
                        id="roadmap-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 4, 0 8" fill="#94A3B8" />
                      </marker>
                      <marker
                        id="roadmap-arrow-active"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 4, 0 8" fill="#6366F1" />
                      </marker>
                    </defs>

                    {conceptEdges.map((e) => {
                      const srcNode = conceptNodes.find((n) => n.id === e.source);
                      const tgtNode = conceptNodes.find((n) => n.id === e.target);
                      if (!srcNode || !tgtNode) return null;

                      // Card dimensions: width 210, height 85
                      // Edge connects bottom of srcNode to top of tgtNode
                      const isConnected =
                        selectedNode?.id === e.source || selectedNode?.id === e.target;

                      const x1 = srcNode.x + 105;
                      const y1 = srcNode.y + 85;
                      const x2 = tgtNode.x + 105;
                      const y2 = tgtNode.y;

                      // Bezier curve
                      const dy = y2 - y1;
                      const cpy1 = y1 + Math.max(30, dy * 0.4);
                      const cpy2 = y2 - Math.max(30, dy * 0.4);
                      const pathData = `M ${x1} ${y1} C ${x1} ${cpy1}, ${x2} ${cpy2}, ${x2} ${y2}`;

                      return (
                        <g key={e.id}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke={isConnected ? "#6366F1" : "#CBD5E1"}
                            strokeWidth={isConnected ? "2.5" : "1.5"}
                            strokeDasharray={isConnected ? "none" : "4 4"}
                            markerEnd={
                              isConnected ? "url(#roadmap-arrow-active)" : "url(#roadmap-arrow)"
                            }
                            className="transition-all duration-200"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Render Roadmap Topic Nodes by Milestone */}
                  {Object.entries(milestoneGroups).map(([milestoneTitle, nodesInMilestone], mIdx) => {
                    const firstY = nodesInMilestone[0]?.y || 100;
                    return (
                      <div key={milestoneTitle}>
                        {/* Milestone Chapter Header Badge */}
                        <div
                          style={{
                            position: "absolute",
                            left: 160,
                            top: Math.max(20, firstY - 45),
                            width: 680,
                          }}
                          className="flex items-center gap-3 z-0"
                        >
                          <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-1 shadow-2xs">
                            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-violet/10 text-violet font-mono text-[10px] font-bold">
                              {mIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {milestoneTitle}
                            </span>
                          </div>
                          <div className="h-px flex-1 bg-border/80" />
                        </div>

                        {/* Concept Cards in this Milestone */}
                        {nodesInMilestone.map((node) => {
                          const isSelected = selectedNode?.id === node.id;
                          const isRecommended = recommendedNodeId === node.id;
                          const domainStyle = getDomainStyle(node.domain);
                          const masteryConfig =
                            MASTERY_CONFIG[node.mastery] || MASTERY_CONFIG.unread;
                          const StatusIcon = masteryConfig.icon;

                          const isDimmed =
                            searchQuery.trim() !== "" &&
                            !node.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
                            !node.domain.toLowerCase().includes(searchQuery.toLowerCase());

                          return (
                            <div
                              key={node.id}
                              style={{
                                position: "absolute",
                                left: node.x,
                                top: node.y,
                                width: 210,
                              }}
                              onClick={() => setSelectedNodeId(node.id)}
                              className={cn(
                                "roadmap-card group cursor-pointer rounded-2xl border p-3.5 transition-all duration-200 shadow-2xs z-10",
                                masteryConfig.nodeBg,
                                isSelected
                                  ? "border-violet ring-2 ring-violet/40 shadow-md scale-[1.03]"
                                  : isRecommended
                                  ? "border-violet/60 ring-1 ring-violet/30 hover:border-violet"
                                  : "border-border hover:border-violet/50 hover:shadow-sm",
                                isDimmed && "opacity-30",
                              )}
                            >
                              {/* Top Bar: Domain Tag & Mastery Status */}
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-bold truncate max-w-[110px]",
                                    domainStyle.bg,
                                    domainStyle.text,
                                  )}
                                >
                                  {node.domain}
                                </span>

                                <span
                                  className={cn(
                                    "rounded-md px-1.5 py-0.5 text-[10px] font-bold border flex items-center gap-1",
                                    masteryConfig.badgeBg,
                                  )}
                                  title={masteryConfig.label}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  <span>
                                    {node.masteryScore !== null && node.masteryScore !== undefined
                                      ? `${node.masteryScore}%`
                                      : masteryConfig.label}
                                  </span>
                                </span>
                              </div>

                              {/* Title */}
                              <h4 className="font-serif text-xs font-bold text-foreground leading-snug line-clamp-2">
                                {node.label}
                              </h4>

                              {/* Bottom row: Recommended badge or Review indicator */}
                              <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                                {isRecommended ? (
                                  <span className="text-violet font-bold flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5" /> Next Step
                                  </span>
                                ) : (
                                  <span>{node.unit || "Core"}</span>
                                )}

                                {node.isReviewed && (
                                  <span
                                    className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5"
                                    title="Marked as reviewed by you"
                                  >
                                    <Check className="h-3 w-3" /> Reviewed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roadmap Legend Bar (Phase 2 & 7) */}
              <div className="border-t border-border bg-card/90 backdrop-blur-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                    Legend:
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Mastered (Score &ge; 80%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-500" /> In Progress / Reviewed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Needs Revision (Score &lt; 60%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" /> Not Started
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Click any topic to view verified citations & practice
                </div>
              </div>
            </Card>
          </div>

          {/* ── Right Column: Concept Inspector Drawer (Phase 4) ── */}
          <div className="lg:col-span-1">
            {selectedNode ? (
              <Card className="border-border space-y-4 rounded-2xl sticky top-6 shadow-sm">
                {/* Header: Domain & Mastery */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-bold",
                        getDomainStyle(selectedNode.domain).bg,
                        getDomainStyle(selectedNode.domain).text,
                      )}
                    >
                      {selectedNode.domain}
                    </span>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold border flex items-center gap-1",
                        MASTERY_CONFIG[selectedNode.mastery].badgeBg,
                      )}
                    >
                      {MASTERY_CONFIG[selectedNode.mastery].label}
                      {selectedNode.masteryScore !== null &&
                        selectedNode.masteryScore !== undefined && (
                          <span className="ml-1">({selectedNode.masteryScore}%)</span>
                        )}
                    </span>
                  </div>

                  <h3 className="mt-3 font-serif text-xl font-bold text-foreground">
                    {selectedNode.label}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span>{selectedNode.subjectName || activeSubjectObj?.name}</span>
                    <span>•</span>
                    <span>{selectedNode.milestone || selectedNode.unit || "Core"}</span>
                  </div>
                </div>

                {/* Concept Summary */}
                <div className="rounded-xl border border-border bg-accent/30 p-3.5 text-xs text-foreground leading-relaxed">
                  {selectedNode.summary}
                </div>

                {/* Why This Concept Matters (Phase 4) */}
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5" /> Why This Concept Matters
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {selectedNode.whyItMatters ||
                      "Mastering this topic establishes foundational prerequisites needed for subsequent distributed systems and machine learning modules."}
                  </p>
                </div>

                {/* Verified Prerequisites & Dependents */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Learning Sequence Dependencies
                  </div>

                  {/* Prerequisites */}
                  <div className="rounded-xl border border-border p-3 bg-card space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Prerequisites (Builds Upon):
                    </span>
                    {(selectedNode.prerequisites || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(selectedNode.prerequisites || []).map((pLabel, idx) => {
                          const pNode = conceptNodes.find((n) => n.label === pLabel);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => pNode && setSelectedNodeId(pNode.id)}
                              className="rounded-lg bg-accent/60 hover:bg-accent border border-border px-2 py-1 text-xs font-medium text-foreground transition text-left"
                            >
                              ← {pLabel}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        None (Foundational Entry Concept in this syllabus).
                      </p>
                    )}
                  </div>

                  {/* Dependents */}
                  <div className="rounded-xl border border-border p-3 bg-card space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Unlocks Next Steps:
                    </span>
                    {(selectedNode.dependents || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(selectedNode.dependents || []).map((dLabel, idx) => {
                          const dNode = conceptNodes.find((n) => n.label === dLabel);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => dNode && setSelectedNodeId(dNode.id)}
                              className="rounded-lg bg-accent/60 hover:bg-accent border border-border px-2 py-1 text-xs font-medium text-foreground transition text-left"
                            >
                              → {dLabel}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Advanced topic at the current frontier of this unit.
                      </p>
                    )}
                  </div>
                </div>

                {/* Grounded Course Materials & Cited Excerpt (Phase 3 & 4) */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Verified Course Citations</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Authentic Evidence
                    </span>
                  </div>

                  {(selectedNode.evidenceSources || []).length > 0 ? (
                    (selectedNode.evidenceSources || []).map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <FileText className="h-3.5 w-3.5 text-violet shrink-0" />
                          <span className="truncate">{ev.fileName}</span>
                          {ev.page && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              (p. {ev.page})
                            </span>
                          )}
                        </div>
                        {ev.excerpt && (
                          <div className="text-[11px] text-muted-foreground font-sans leading-relaxed border-l-2 border-violet/50 pl-2.5">
                            "{ev.excerpt}"
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-border bg-accent/20 p-3 text-xs text-muted-foreground italic">
                      No document excerpts indexed yet for this concept.
                    </div>
                  )}
                </div>

                {/* Primary Pedagogical Actions (Phase 4) */}
                <div className="space-y-2 pt-2 border-t border-border">
                  {/* Ask AI Tutor */}
                  <button
                    type="button"
                    onClick={() => handleAskAITutor(selectedNode)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-hover shadow-sm transition"
                  >
                    <Sparkles className="h-4 w-4" /> Ask AI Tutor about {selectedNode.label}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Practice Quiz */}
                    <button
                      type="button"
                      onClick={() => handlePracticeQuiz(selectedNode)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition shadow-2xs"
                    >
                      <ListChecks className="h-3.5 w-3.5 text-violet" />
                      <span>Practice Quiz</span>
                    </button>

                    {/* Mark as Reviewed */}
                    <button
                      type="button"
                      onClick={handleMarkAsReviewed}
                      disabled={isReviewing || selectedNode.isReviewed}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-2xs",
                        selectedNode.isReviewed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-default"
                          : "border-border bg-card text-foreground hover:bg-accent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{selectedNode.isReviewed ? "Reviewed ✓" : "Mark Reviewed"}</span>
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
                Select a topic node on the roadmap to inspect verified citations, prerequisites, and learning actions.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
