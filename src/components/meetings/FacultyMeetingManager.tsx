import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  User,
  Plus,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Check,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { API_BASE, authHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

interface FacultySlot {
  id: string;
  subjectCode: string;
  subjectName: string;
  topic: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  locationType: string;
  audienceType: "department" | "specific_students" | "all";
  teamsMeetingId?: string | null;
  teamsJoinUrl?: string | null;
  status: "active" | "cancelled" | "completed";
  notes?: string;
}

interface FacultyBooking {
  id: string;
  slotId: string;
  studentName: string;
  studentEmail: string;
  subjectCode: string;
  topic: string;
  doubtDescription: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "requested" | "approved" | "rejected" | "cancelled" | "completed" | "no_show";
  teamsJoinUrl?: string | null;
  teamsMeetingId?: string | null;
  createdAt: string;
}

interface EligibleStudent {
  id: string;
  name: string;
  email: string;
  departmentId: string;
}

export function FacultyMeetingManager() {
  const { user } = useAuth();
  const { subjects } = useAppData();
  const token = localStorage.getItem("token") || "";

  const [activeTab, setActiveTab] = useState<"requests" | "slots">("requests");
  const [slots, setSlots] = useState<FacultySlot[]>([]);
  const [bookings, setBookings] = useState<FacultyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [step, setStep] = useState<"details" | "review">("details");

  // Add Session form state
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.code || "CSUC301");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [startTime, setStartTime] = useState("14:00");
  const [duration, setDuration] = useState(45);
  const [capacity, setCapacity] = useState(5);
  const [sessionType, setSessionType] = useState<"office_hours" | "instant_teams">("office_hours");
  const [audienceType, setAudienceType] = useState<"department" | "specific_students">("department");
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/faculty/slots`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSlots(data || []);
      }
    } catch (e) {
      console.warn("Failed to fetch slots:", e);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/faculty/bookings`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch (e) {
      console.warn("Failed to fetch bookings:", e);
    }
  };

  const fetchEligibleStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/students/eligible`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setEligibleStudents(data || []);
      }
    } catch (e) {
      console.warn("Failed to fetch eligible students:", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSlots(), fetchBookings()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    fetchEligibleStudents();
  }, []);

  const handleOpenAddModal = () => {
    setStep("details");
    setShowAddModal(true);
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a session topic or title.");
      return;
    }
    if (audienceType === "specific_students" && selectedStudentIds.length === 0) {
      toast.error("Please select at least one student for targeted invite.");
      return;
    }
    setStep("review");
  };

  const handleCreateSession = async () => {
    setSubmitting(true);
    try {
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
      const foundSubject = subjects.find((s) => s.code === selectedSubject);

      const res = await fetch(`${API_BASE}/api/meetings/slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
        },
        body: JSON.stringify({
          subjectCode: selectedSubject,
          subjectName: foundSubject?.name || "Course Subject",
          subjectId: foundSubject?.id || null,
          topic: topic.trim(),
          description: description.trim(),
          date,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          durationMinutes: duration,
          capacity,
          audienceType,
          invitedStudentIds: audienceType === "specific_students" ? selectedStudentIds : [],
          createTeamsMeeting: sessionType === "instant_teams",
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      toast.success(
        sessionType === "instant_teams"
          ? "Microsoft Teams meeting created successfully!"
          : "Office hour session published successfully!",
      );
      setShowAddModal(false);
      setTopic("");
      setDescription("");
      setNotes("");
      setSelectedStudentIds([]);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: "approved" | "rejected") => {
    setActionInProgress(bookingId);
    try {
      const res = await fetch(`${API_BASE}/api/meetings/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? "Schedule conflict or duplicate topic" : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update booking status");
      }

      toast.success(
        status === "approved"
          ? "Meeting approved! Real Microsoft Teams join link generated."
          : "Meeting request declined.",
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to cancel this entire session and notify booked students?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/meetings/slots/${slotId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
        },
        body: JSON.stringify({ reason: "Session cancelled by faculty" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel slot");
      }

      toast.success("Session cancelled and affected students notified.");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel slot");
    }
  };

  const pendingRequests = bookings.filter((b) => b.status === "requested");
  const confirmedSessions = bookings.filter((b) => b.status === "approved");
  const activeSlots = slots.filter((s) => s.status === "active");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Video className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Faculty Connect & Microsoft Teams</h3>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-wider">
              Microsoft Graph API
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Schedule department lectures, group doubt seminars, or approve 1-on-1 office hours with real Microsoft Teams meetings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-muted/60 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("requests")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5",
                activeTab === "requests"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Requests & Confirmed</span>
              {pendingRequests.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("slots")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-all",
                activeTab === "slots"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              My Sessions ({activeSlots.length})
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Schedule Session
          </button>

          <button
            onClick={loadData}
            title="Refresh"
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="pt-5">
        {activeTab === "requests" ? (
          <div className="space-y-6">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending Student Doubt Requests ({pendingRequests.length})
                </h4>
                <div className="space-y-3">
                  {pendingRequests.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            {b.subjectCode}
                          </span>
                          <span className="text-xs font-bold text-foreground">{b.studentName}</span>
                          <span className="text-[11px] text-muted-foreground">({b.studentEmail})</span>
                        </div>
                        <h5 className="mt-1 text-sm font-bold text-foreground">{b.topic}</h5>
                        {b.doubtDescription && (
                          <p className="mt-1 text-xs text-muted-foreground">"{b.doubtDescription}"</p>
                        )}
                        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{" "}
                            {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} (
                            {b.durationMinutes}m)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={actionInProgress === b.id}
                          onClick={() => handleUpdateBookingStatus(b.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
                        >
                          {actionInProgress === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Approve & Generate Teams Meeting</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionInProgress === b.id}
                          onClick={() => handleUpdateBookingStatus(b.id, "rejected")}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Sessions */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Confirmed Microsoft Teams Sessions ({confirmedSessions.length})
              </h4>
              {confirmedSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                  No confirmed sessions currently. Approved requests will appear here with instant Teams links.
                </div>
              ) : (
                <div className="space-y-3">
                  {confirmedSessions.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-background/50 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                            Confirmed
                          </span>
                          <span className="text-xs font-bold text-foreground">{b.studentName}</span>
                          <span className="text-[11px] text-muted-foreground">({b.subjectCode})</span>
                        </div>
                        <h5 className="mt-1 text-sm font-bold text-foreground">{b.topic}</h5>
                        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-violet" />{" "}
                            {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} (
                            {b.durationMinutes}m)
                          </span>
                        </div>
                      </div>

                      {b.teamsJoinUrl && (
                        <a
                          href={b.teamsJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 transition"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Start Microsoft Teams Meeting</span>
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {activeSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <h4 className="text-sm font-semibold text-foreground">No sessions scheduled</h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Click "Schedule Session" to publish office hours or direct Microsoft Teams lectures.
                </p>
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> Schedule First Session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSlots.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-background/50 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet">
                            {s.subjectCode}
                          </span>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {s.audienceType === "specific_students"
                              ? "Targeted Invite"
                              : "Department-wide"}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {s.bookedCount} / {s.capacity} booked
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-foreground">{s.topic}</h4>
                      {s.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                      )}
                      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-violet" />
                        <span>
                          {new Date(s.startTime).toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                          {new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span>({s.durationMinutes}m)</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                      {s.teamsJoinUrl ? (
                        <a
                          href={s.teamsJoinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Join Teams</span>
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Info className="h-3 w-3" /> Link generated upon student request approval
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCancelSlot(s.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Cancel Session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Schedule Session Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            >
              {step === "details" ? (
                <>
                  <h3 className="text-lg font-bold text-foreground">Schedule Faculty Connect Session</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Set up an office hours window or direct Microsoft Teams session for your students.
                  </p>

                  <form onSubmit={handleProceedToReview} className="mt-4 space-y-3.5">
                    {/* Session Type */}
                    <div>
                      <label className="text-xs font-semibold text-foreground">Session Delivery Mode</label>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSessionType("office_hours")}
                          className={cn(
                            "rounded-xl border p-2.5 text-left transition",
                            sessionType === "office_hours"
                              ? "border-violet bg-violet/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <div className="text-xs font-bold text-foreground">Office Hours Window</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Students request doubt slots; Teams links created on approval.
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionType("instant_teams")}
                          className={cn(
                            "rounded-xl border p-2.5 text-left transition",
                            sessionType === "instant_teams"
                              ? "border-blue-600 bg-blue-600/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <div className="text-xs font-bold text-foreground flex items-center gap-1">
                            <Video className="h-3 w-3 text-blue-500" /> Direct Teams Meeting
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Creates a live Microsoft Teams meeting immediately on publish.
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Course Subject */}
                    <div>
                      <label className="text-xs font-semibold text-foreground">Course Subject</label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                      >
                        {subjects.map((sub) => (
                          <option key={sub.id || sub.code} value={sub.code}>
                            {sub.code} · {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Topic */}
                    <div>
                      <label className="text-xs font-semibold text-foreground">Topic / Agenda *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Unit 3 Neural Networks & Backprop Doubt Solving"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-semibold text-foreground">Description / Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="Outline topics covered or required preparation..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                      />
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground">Date</label>
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground">Start Time</label>
                        <input
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Duration and Capacity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground">Duration (Minutes)</label>
                        <input
                          type="number"
                          min={15}
                          max={180}
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground">Max Capacity</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="text-xs font-semibold text-foreground">Meeting Audience</label>
                      <div className="mt-1 flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="audience"
                            checked={audienceType === "department"}
                            onChange={() => setAudienceType("department")}
                            className="accent-violet"
                          />
                          <span>All Department Students</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="audience"
                            checked={audienceType === "specific_students"}
                            onChange={() => setAudienceType("specific_students")}
                            className="accent-violet"
                          />
                          <span>Specific Eligible Students</span>
                        </label>
                      </div>

                      {audienceType === "specific_students" && (
                        <div className="mt-2.5 rounded-xl border border-border bg-background/50 p-3 max-h-36 overflow-y-auto space-y-1.5">
                          {eligibleStudents.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              No student accounts found in department.
                            </p>
                          ) : (
                            eligibleStudents.map((s) => (
                              <label
                                key={s.id}
                                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-accent/40 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedStudentIds.includes(s.id)}
                                    onChange={() => handleToggleStudent(s.id)}
                                    className="accent-violet rounded"
                                  />
                                  <span className="font-medium text-foreground">{s.name}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">{s.email}</span>
                              </label>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet/90"
                      >
                        Review Details →
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Step 2: Review details before submit */
                <div>
                  <h3 className="text-lg font-bold text-foreground">Review Session Scope</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Confirm your Microsoft Teams session details before publishing.
                  </p>

                  <div className="mt-4 rounded-xl border border-border bg-background/50 p-4 space-y-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Subject & Topic:</span>
                      <div className="font-bold text-foreground mt-0.5">
                        {selectedSubject} · {topic}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Date & Time:</span>
                        <div className="font-medium text-foreground mt-0.5">
                          {date} at {startTime} ({duration}m)
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Session Type:</span>
                        <div className="font-medium text-foreground mt-0.5">
                          {sessionType === "instant_teams" ? "Direct Teams Meeting" : "Office Hours Window"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Audience Scope:</span>
                      <div className="font-medium text-foreground mt-0.5">
                        {audienceType === "department"
                          ? "All students in department"
                          : `${selectedStudentIds.length} targeted student(s)`}
                      </div>
                    </div>

                    {description && (
                      <div>
                        <span className="text-muted-foreground">Description:</span>
                        <div className="text-muted-foreground mt-0.5 italic">"{description}"</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-5">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setStep("details")}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleCreateSession}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet/90 disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Publish Session
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
