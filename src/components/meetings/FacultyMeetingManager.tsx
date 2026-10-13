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
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  locationType: string;
  status: string;
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

export function FacultyMeetingManager() {
  const { user } = useAuth();
  const { subjects } = useAppData();
  const token = localStorage.getItem("token") || "";

  const [activeTab, setActiveTab] = useState<"requests" | "slots">("requests");
  const [slots, setSlots] = useState<FacultySlot[]>([]);
  const [bookings, setBookings] = useState<FacultyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);

  // New slot form state
  const [topic, setTopic] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.code || "CSUC301");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [startTime, setStartTime] = useState("14:00");
  const [duration, setDuration] = useState(45);
  const [capacity, setCapacity] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/faculty/slots`, {
        headers: authHeaders(token, { role: user?.role, id: user?.id }),
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
        headers: authHeaders(token, { role: user?.role, id: user?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch (e) {
      console.warn("Failed to fetch bookings:", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSlots(), fetchBookings()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a session topic.");
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      const foundSubject = subjects.find((s) => s.code === selectedSubject);

      const res = await fetch(`${API_BASE}/api/meetings/slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id }),
        },
        body: JSON.stringify({
          subjectCode: selectedSubject,
          subjectName: foundSubject?.name || "Course Subject",
          subjectId: foundSubject?.id || null,
          topic: topic.trim(),
          date,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          durationMinutes: duration,
          capacity,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create slot");
      }

      toast.success("Office hour slot published successfully!");
      setShowAddSlot(false);
      setTopic("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create slot");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id }),
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === "rejected" ? "Schedule conflict or duplicate topic" : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      toast.success(
        status === "approved"
          ? "Meeting approved! Microsoft Teams link generated and dispatched."
          : "Meeting request declined."
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const pendingRequests = bookings.filter((b) => b.status === "requested");
  const confirmedSessions = bookings.filter((b) => b.status === "approved");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Video className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Office Hours & Teams Meetings</h3>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-wider">
              Microsoft Teams
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Publish available office hours and approve doubt-clearing sessions with 1-click Microsoft Teams generation.
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
                  : "text-muted-foreground hover:text-foreground"
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
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Slots ({slots.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddSlot(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Slot
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
                            <Clock className="h-3 w-3" /> {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} ({b.durationMinutes}m)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(b.id, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Create Teams Meeting
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(b.id, "rejected")}
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
                            <Clock className="h-3 w-3 text-violet" /> {new Date(b.startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} ({b.durationMinutes}m)
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
                          <span>Start Teams Meeting</span>
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
            {slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <h4 className="text-sm font-semibold text-foreground">No office hour slots published</h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Click "Add Slot" to publish recurring or one-off availability for your students.
                </p>
                <button
                  onClick={() => setShowAddSlot(true)}
                  className="mt-4 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> Publish First Slot
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slots.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-background/50 p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet">
                          {s.subjectCode}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {s.bookedCount} / {s.capacity} booked
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-foreground">{s.topic}</h4>
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-violet" />
                        <span>
                          {new Date(s.startTime).toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                          {new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span>({s.durationMinutes}m)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Slot Modal ── */}
      <AnimatePresence>
        {showAddSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-foreground">Publish Office Hour Slot</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Set up an available window for student doubt consultations.
              </p>

              <form onSubmit={handleCreateSlot} className="mt-4 space-y-3.5">
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

                <div>
                  <label className="text-xs font-semibold text-foreground">Session Topic / Scope *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit 1 Architecture & Spark RDD Doubt Clearing"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                  />
                </div>

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
                    <label className="text-xs font-semibold text-foreground">Max Capacity (Students)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Special Instructions / Prep</label>
                  <input
                    type="text"
                    placeholder="e.g. Please bring code implementation errors"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSlot(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-2 text-xs font-bold text-white hover:bg-violet/90 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Publish Slot
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
