import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  User,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { API_BASE, authHeaders } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface MeetingSlot {
  id: string;
  facultyId: string;
  facultyName: string;
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
  audienceType?: string;
  notes?: string;
}

interface MeetingBooking {
  id: string;
  slotId: string;
  facultyName: string;
  subjectCode: string;
  subjectName: string;
  topic: string;
  doubtDescription: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "requested" | "approved" | "rejected" | "cancelled" | "completed" | "no_show";
  teamsJoinUrl?: string | null;
  teamsMeetingId?: string | null;
  facultyNotes?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
}

export function StudentMeetingScheduler() {
  const { user } = useAuth();
  const token = localStorage.getItem("token") || "";

  const [activeTab, setActiveTab] = useState<"available" | "my_bookings">("my_bookings");
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [bookings, setBookings] = useState<MeetingBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<MeetingSlot | null>(null);

  // Form state
  const [topic, setTopic] = useState("");
  const [doubtDesc, setDoubtDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings/available-slots`, {
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
      const res = await fetch(`${API_BASE}/api/meetings/student/bookings`, {
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

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSlots(), fetchBookings()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot || !topic.trim()) {
      toast.error("Please enter your doubt topic.");
      return;
    }

    setSubmitting(true);
    try {
      // Idempotency key per submission to prevent duplicates on retry
      const idempotencyKey = `bk_${bookingSlot.id}_${user?.id}_${Date.now()}`;

      const res = await fetch(`${API_BASE}/api/meetings/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
        },
        body: JSON.stringify({
          slotId: bookingSlot.id,
          topic: topic.trim(),
          doubtDescription: doubtDesc.trim(),
          meetingType: "one_on_one",
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to book meeting");
      }

      toast.success("Doubt session requested! Awaiting faculty confirmation.");
      setBookingSlot(null);
      setTopic("");
      setDoubtDesc("");
      setActiveTab("my_bookings");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this meeting request?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/meetings/bookings/${bookingId}/student-cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token, { role: user?.role, id: user?.id, departmentId: user?.departmentId }),
        },
        body: JSON.stringify({ reason: "Student requested cancellation" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel");
      }

      toast.success("Meeting request cancelled.");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Video className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Faculty Connect Doubt Sessions</h3>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-wider">
              Microsoft Teams
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Schedule 1-on-1 office hours or small group doubt-solving with your course professors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-muted/60 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("my_bookings")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 transition-all",
                activeTab === "my_bookings"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              My Sessions ({bookings.length})
            </button>
            <button
              onClick={() => setActiveTab("available")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 transition-all",
                activeTab === "available"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Browse Faculty Slots ({slots.length})
            </button>
          </div>

          <button
            onClick={loadData}
            title="Refresh schedule"
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="pt-5">
        {activeTab === "my_bookings" ? (
          <div>
            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <h4 className="text-sm font-semibold text-foreground">No sessions scheduled yet</h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Browse open faculty office-hour slots to book a Microsoft Teams session for syllabus doubts.
                </p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="mt-4 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
                >
                  Browse Available Slots →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => {
                  const startTime = new Date(b.startTime);
                  const isApproved = b.status === "approved";
                  const isRequested = b.status === "requested";

                  return (
                    <div
                      key={b.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/80 bg-background/50 p-4 transition hover:border-violet/40 hover:bg-card"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              isApproved && "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
                              isRequested && "bg-amber-500/15 text-amber-500 border border-amber-500/20",
                              b.status === "completed" && "bg-blue-500/15 text-blue-500",
                              b.status === "cancelled" && "bg-muted text-muted-foreground",
                              b.status === "rejected" && "bg-rose-500/15 text-rose-500",
                            )}
                          >
                            {b.status === "approved" ? "Confirmed" : b.status}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            {b.subjectCode} · {b.subjectName}
                          </span>
                        </div>

                        <h4 className="mt-1 text-sm font-bold text-foreground truncate">{b.topic}</h4>
                        {b.doubtDescription && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            "{b.doubtDescription}"
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-violet" /> {b.facultyName}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{" "}
                            {startTime.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              weekday: "short",
                            })}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />{" "}
                            {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                            {b.durationMinutes} min)
                          </span>
                        </div>

                        {b.rejectionReason && (
                          <p className="mt-2 text-[11px] text-rose-500">
                            <strong>Reason:</strong> {b.rejectionReason}
                          </p>
                        )}
                        {b.cancellationReason && (
                          <p className="mt-2 text-[11px] text-muted-foreground italic">
                            Cancelled: {b.cancellationReason}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isApproved && b.teamsJoinUrl && (
                          <a
                            href={b.teamsJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 transition"
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>Join Teams Meeting</span>
                            <ExternalLink className="h-3 w-3 opacity-80" />
                          </a>
                        )}

                        {isRequested && (
                          <span className="text-xs font-medium text-amber-500 flex items-center gap-1 mr-2">
                            <Clock className="h-3.5 w-3.5 animate-pulse" /> Pending Faculty Approval
                          </span>
                        )}

                        {["requested", "approved"].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b.id)}
                            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <h4 className="text-sm font-semibold text-foreground">No upcoming slots available</h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Check back soon or post a doubt in the subject discussion forum to request faculty office hours.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slots.map((s) => {
                  const startTime = new Date(s.startTime);
                  const spotsLeft = (s.capacity || 1) - (s.bookedCount || 0);

                  return (
                    <div
                      key={s.id}
                      className="flex flex-col justify-between rounded-xl border border-border bg-background/50 p-4 transition hover:border-violet/40 hover:bg-card"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-violet/10 px-2 py-0.5 text-[10px] font-bold text-violet">
                            {s.subjectCode}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-500">
                            {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                          </span>
                        </div>

                        <h4 className="mt-2 text-sm font-bold text-foreground">{s.topic}</h4>
                        {s.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                        )}

                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" /> {s.facultyName}
                        </p>

                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-violet" />
                            {startTime.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              weekday: "short",
                            })}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-violet" />
                            {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (
                            {s.durationMinutes}m)
                          </span>
                        </div>

                        {s.notes && (
                          <p className="mt-2 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground italic">
                            "{s.notes}"
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/40 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setBookingSlot(s)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet/90 transition shadow-xs"
                        >
                          <Plus className="h-3.5 w-3.5" /> Book Session
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Booking Modal ── */}
      <AnimatePresence>
        {bookingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            >
              <h3 className="text-lg font-bold text-foreground">Book Doubt Session</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Session with <strong className="text-foreground">{bookingSlot.facultyName}</strong> for{" "}
                <strong className="text-foreground">{bookingSlot.subjectCode}</strong>.
              </p>

              <form onSubmit={handleBookSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">Specific Doubt / Topic to Cover *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MapReduce Shuffle spill-to-disk buffer threshold"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Describe your question or code issue</label>
                  <textarea
                    rows={3}
                    placeholder="Provide context on what you tried or where you got stuck..."
                    value={doubtDesc}
                    onChange={(e) => setDoubtDesc(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-violet focus:outline-hidden resize-none"
                  />
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-blue-600 dark:text-blue-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="h-3.5 w-3.5" /> Microsoft Teams Meeting
                  </div>
                  <p className="mt-1 text-[10.5px] leading-tight">
                    Once approved by faculty, a verified Microsoft Teams meeting join link will appear in your sessions tab.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingSlot(null)}
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
                    Confirm Booking
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
