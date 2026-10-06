import { useState, useId } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, CheckCircle2, Target, Flame, Clock, BookOpen, Brain, Star, TrendingDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import type { Role, LearningStyle } from "@/lib/mock-data";
import { studentLearningProfiles } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const roleMeta: Record<Role, { label: string; color: string; pillTone: "indigo" | "amber" | "green" }> = {
  student: { label: "Student",  color: "bg-indigo-brand/10 text-violet", pillTone: "indigo" },
  faculty: { label: "Faculty",  color: "bg-amber-brand/15 text-amber-brand",   pillTone: "amber" },
  admin:   { label: "Admin",    color: "bg-teal-brand/10 text-teal-brand",     pillTone: "green" },
};

const STYLE_OPTIONS: { value: LearningStyle; label: string; desc: string }[] = [
  { value: "visual",        label: "Visual",        desc: "Diagrams, charts, and visual representations" },
  { value: "textual",       label: "Textual",       desc: "Written explanations, definitions, and proofs" },
  { value: "example-driven", label: "Example-driven", desc: "Real-world examples before formal concepts" },
];

// ─── Main Profile Page ────────────────────────────────────────────────────────

export function ProfilePage({ role }: { role: Role }) {
  const { user, changePassword, clearMustChangePw, updateProfile } = useAuth();
  const { markPasswordChanged } = useAppData();
  const id = useId();

  // Profile Edit State
  const [name, setName] = useState(user?.name ?? "");
  const [studentId, setStudentId] = useState(user?.studentId ?? "");
  const [facultyId, setFacultyId] = useState(user?.facultyId ?? "");
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? "CE");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change State
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError]     = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const meta = roleMeta[role];
  const displayUser = user ?? { name: "—", email: "—", role };
  const initials = (name || displayUser.name)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);

    const res = await updateProfile({
      name: name.trim(),
      studentId: role === "student" ? studentId.trim() : undefined,
      facultyId: role === "faculty" ? facultyId.trim() : undefined,
      departmentId: departmentId.trim(),
    });

    setProfileSaving(false);
    if (res.ok) {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } else {
      setProfileError(res.error || "Failed to save profile changes.");
    }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 6)    { setPwError("New password must be at least 6 characters."); return; }
    setPwLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = changePassword(currentPw, newPw);
    setPwLoading(false);
    if (!result.ok) { setPwError(result.error ?? "Failed to change password."); return; }
    // Clear mustChangePassword flag from session and users table
    clearMustChangePw();
    if (user) markPasswordChanged(user.email);
    setPwSuccess(true);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Your account details, identifier, and security settings." />

      {/* Avatar + info row */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center py-4 text-center">
            <div className={cn("flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold", meta.color)}>
              {initials || "U"}
            </div>
            <div className="mt-4 font-serif text-xl font-bold text-foreground">{name || displayUser.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{displayUser.email}</div>
            <div className="mt-3 flex items-center gap-2">
              <Pill tone={meta.pillTone}>{meta.label}</Pill>
              {role === "student" && studentId && (
                <span className="rounded-full bg-indigo-brand/10 px-2.5 py-0.5 text-xs font-bold text-violet">
                  ID: {studentId}
                </span>
              )}
              {role === "faculty" && facultyId && (
                <span className="rounded-full bg-amber-brand/15 px-2.5 py-0.5 text-xs font-bold text-gold">
                  ID: {facultyId}
                </span>
              )}
            </div>
          </div>
        </Card>

        <div className="md:col-span-2">
          <Card title="Update & Save Profile">
            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-success/8 px-4 py-3 text-xs font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Profile changes saved and synchronized successfully!
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-danger/8 px-4 py-3 text-xs font-semibold text-danger">
                <span>⚠</span> {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Enter your name"
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-violet"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={displayUser.email}
                    disabled
                    className="w-full rounded-xl border border-border bg-accent/30 px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {role === "student" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Student ID / Roll No
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                      placeholder="e.g. 24CS045"
                      className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold uppercase outline-none focus:border-violet"
                    />
                  </div>
                )}

                {role === "faculty" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Faculty ID / Employee Code
                    </label>
                    <input
                      type="text"
                      value={facultyId}
                      onChange={(e) => setFacultyId(e.target.value.toUpperCase())}
                      placeholder="e.g. FAC001"
                      className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold uppercase outline-none focus:border-violet"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium outline-none focus:border-violet"
                  >
                    <option value="CE">Computer Engineering (CE)</option>
                    <option value="CSE">Computer Science & Eng (CSE)</option>
                    <option value="IT">Information Technology (IT)</option>
                    <option value="AIML">AI & Machine Learning (AIML)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-violet-hover transition disabled:opacity-50"
                >
                  {profileSaving ? "Saving changes..." : "Save Profile Details"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Student Learning Profile section — only shown for student role */}
      {role === "student" && <StudentLearningProfileSection userId="u1" />}

      {/* Default-password warning banner */}
      {user?.mustChangePassword && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/8 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Default password still active</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your account was created with the default password <code className="rounded bg-muted px-1 py-0.5 font-mono">password1234</code>. Please set a personal password.
            </p>
            <Link to="/change-password" className="mt-2 inline-block text-xs font-semibold text-violet hover:underline">
              Change password now →
            </Link>
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="mt-6">
        <Card title="Change Password">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <KeyRound className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Update your account password. You'll stay logged in after changing it.
            </p>
          </div>

          {pwSuccess && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password changed successfully!
            </div>
          )}
          {pwError && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger">
              <span>⚠</span> {pwError}
            </div>
          )}

          <form onSubmit={handleChangePw} noValidate className="max-w-md space-y-4">
            <div>
              <label htmlFor={`${id}-cur-pw`} className="mb-1.5 block text-sm font-medium text-foreground">Current password</label>
              <input id={`${id}-cur-pw`} type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                placeholder={user?.mustChangePassword ? "password1234" : "Your current password"} required
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
              />
            </div>
            <div>
              <label htmlFor={`${id}-new-pw`} className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
              <input id={`${id}-new-pw`} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 6 characters" required
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
              />
            </div>
            <div>
              <label htmlFor={`${id}-confirm-pw`} className="mb-1.5 block text-sm font-medium text-foreground">Confirm new password</label>
              <input id={`${id}-confirm-pw`} type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password" required
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
              />
            </div>
            <button type="submit" disabled={pwLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9d72f7] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {pwLoading && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {pwLoading ? "Updating…" : "Update password"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ─── Student Learning Profile Section ────────────────────────────────────────

function StudentLearningProfileSection({ userId }: { userId: string }) {
  const profile = studentLearningProfiles[userId];
  const id = useId();

  const [style, setStyle]         = useState<LearningStyle>(profile?.learningStyle ?? "example-driven");
  const [goals, setGoals]         = useState(profile?.learningGoals ?? "");
  const [semester, setSemester]   = useState(String(profile?.currentSemester ?? 5));
  const [saved, setSaved]         = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In production: PATCH /api/students/{id}/profile
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!profile) return null;

  const studyHours = Math.round(profile.totalStudyTimeMinutes / 60);

  return (
    <div className="mt-6 space-y-6">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { icon: Flame,    label: "Learning streak",  value: `${profile.currentStreakDays} days`,  color: "text-amber-brand bg-amber-brand/15" },
          { icon: Clock,    label: "Study time",        value: `${studyHours}h`,                    color: "text-violet bg-indigo-brand/10" },
          { icon: BookOpen, label: "Topics completed",  value: profile.topicsCompleted.length,      color: "text-green-brand bg-green-brand/10" },
          { icon: Target,   label: "Quiz attempts",     value: profile.quizScoreHistory.length,     color: "text-teal-brand bg-teal-brand/10" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(30,27,60,0.08)]">
            <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Concepts row ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Strong Concepts">
          <div className="flex flex-wrap gap-2 mt-1">
            {profile.strongConcepts.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-green-brand/10 px-3 py-1 text-xs font-medium text-green-700">
                <Star className="h-3 w-3" /> {c}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Weak Concepts — Needs Revision">
          <div className="flex flex-wrap gap-2 mt-1">
            {profile.weakConcepts.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-red-brand/10 px-3 py-1 text-xs font-medium text-red-700">
                <TrendingDown className="h-3 w-3" /> {c}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Learning preferences form ── */}
      <Card title="Learning Preferences">
        <form onSubmit={handleSave} className="space-y-5 max-w-lg">
          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Preferences saved!
            </div>
          )}

          {/* Learning style */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              <Brain className="mr-1.5 inline h-4 w-4 text-violet" />
              Preferred learning style
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              The AI Tutor will adapt its explanations to match your preferred style.
            </p>
            <div className="space-y-2">
              {STYLE_OPTIONS.map(({ value, label, desc }) => (
                <label key={value} className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                  style === value
                    ? "border-violet bg-indigo-brand/5"
                    : "border-border hover:border-slate-300"
                )}>
                  <input
                    type="radio"
                    name={`${id}-style`}
                    value={value}
                    checked={style === value}
                    onChange={() => setStyle(value)}
                    className="mt-0.5 accent-indigo-brand"
                  />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Learning goals */}
          <div>
            <label htmlFor={`${id}-goals`} className="mb-1.5 block text-sm font-medium text-foreground">
              <Target className="mr-1.5 inline h-4 w-4 text-violet" />
              Learning goals
            </label>
            <textarea
              id={`${id}-goals`}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="e.g. Master Big Data concepts for a data engineering internship."
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-violet"
            />
          </div>

          {/* Current semester */}
          <div>
            <label htmlFor={`${id}-semester`} className="mb-1.5 block text-sm font-medium text-foreground">
              Current semester
            </label>
            <select
              id={`${id}-semester`}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-violet"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>Semester {n}</option>
              ))}
            </select>
          </div>

          <button type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-brand-hover"
          >
            Save preferences
          </button>
        </form>
      </Card>

      {/* ── Quiz score history ── */}
      <Card title="Quiz Score History">
        {profile.quizScoreHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No quiz attempts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-3">Subject</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Percentage</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {profile.quizScoreHistory.map((q, i) => {
                const pct = Math.round((q.score / q.total) * 100);
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2.5 font-medium text-foreground">{q.subject}</td>
                    <td className="py-2.5 text-muted-foreground">{q.score}/{q.total}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-green-brand" : pct >= 60 ? "bg-amber-brand" : "bg-red-brand")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-semibold", pct >= 80 ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-700")}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{q.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
