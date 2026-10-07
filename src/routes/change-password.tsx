import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useId, useEffect } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, GraduationCap, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { DEFAULT_PASSWORD } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, changePassword, clearMustChangePw, logout } = useAuth();
  const { markPasswordChanged } = useAppData();
  const navigate = useNavigate();
  const id = useId();

  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);

  // Route guard — if user is not logged in or doesn't need to change password,
  // redirect immediately so this URL cannot be bypassed or bookmarked uselessly.
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // If they reached here voluntarily (mustChangePassword is false), that's fine —
    // profile page uses this same component. But if they navigated here directly
    // without the flag set AND they came from a fresh session, just let them proceed
    // (they may have already changed it this session). The real guard is in the
    // login handler in index.tsx — this component just verifies they're logged in.
  }, [user, navigate]);

  if (!user) return null;

  const isMandatory = user.mustChangePassword === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw !== confirmPw) { setError("New passwords do not match."); return; }
    if (newPw.length < 8)    { setError("New password must be at least 8 characters."); return; }
    if (newPw === DEFAULT_PASSWORD) { setError('Please choose a password other than the default "password1234".'); return; }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const result = changePassword(currentPw, newPw);
    setLoading(false);

    if (!result.ok) { setError(result.error ?? "Failed to change password."); return; }

    // Clear the flag from session and AppData users table
    clearMustChangePw();
    markPasswordChanged(user.email);
    setDone(true);

    // Navigate to dashboard after brief success moment
    setTimeout(() => {
      navigate({ to: `/${user.role}` });
    }, 1200);
  };

  const strengthChecks = [
    { label: "8+ characters",     met: newPw.length >= 8 },
    { label: "Uppercase letter",  met: /[A-Z]/.test(newPw) },
    { label: "Number",            met: /[0-9]/.test(newPw) },
    { label: "Not default password", met: newPw !== DEFAULT_PASSWORD && newPw.length > 0 },
  ];
  const strength = strengthChecks.filter((c) => c.met).length;
  const strengthLabel = ["Weak", "Fair", "Good", "Strong"][Math.min(strength, 3)];
  const strengthColor = ["bg-danger", "bg-gold", "bg-gold", "bg-success"][Math.min(strength, 3)];

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--color-background)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.09] blur-3xl"
          style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(circle, #f5c451 0%, transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl"
        style={{ boxShadow: "0 0 0 1px oklch(0.62 0.22 293 / 12%), 0 24px 64px -16px rgba(0,0,0,0.4)" }}
      >
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/15 ring-1 ring-violet/25">
            <GraduationCap className="h-5 w-5 text-violet" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-xl font-bold text-foreground">AI Tutor</div>
            <div className="text-[11px] text-muted-foreground">CSPIT CSE · RAG Platform</div>
          </div>
        </div>

        {/* Mandatory banner */}
        {isMandatory && !done && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3.5"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">Password change required</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your account was created with a default password. You must set a personal password before accessing the platform.
              </p>
            </div>
          </motion.div>
        )}

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success shadow-[0_0_24px_-4px_oklch(0.75_0.17_160_/_40%)]">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="mt-4 font-serif text-xl font-bold text-foreground">Password updated!</div>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting you to your dashboard…</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-violet" />
                <h1 className="font-serif text-xl font-bold text-foreground">
                  {isMandatory ? "Set Your Personal Password" : "Change Password"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger"
              >
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Current / Default password */}
            <div className="mb-4">
              <label htmlFor={`${id}-current`} className="mb-1.5 block text-sm font-medium text-foreground">
                {isMandatory ? "Default password (password1234)" : "Current password"}
              </label>
              <div className="relative">
                <input
                  id={`${id}-current`}
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder={isMandatory ? "password1234" : "Your current password"}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground outline-none transition focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide" : "Show"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="mb-2">
              <label htmlFor={`${id}-new`} className="mb-1.5 block text-sm font-medium text-foreground">
                New password
              </label>
              <div className="relative">
                <input
                  id={`${id}-new`}
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground outline-none transition focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide" : "Show"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Strength bar */}
            {newPw.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cn("flex-1 rounded-full transition-all duration-300", i < strength ? strengthColor : "bg-muted")} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {strengthChecks.map((c) => (
                    <span key={c.label} className={cn("flex items-center gap-1 text-[11px] font-medium", c.met ? "text-success" : "text-muted-foreground")}>
                      {c.met ? "✓" : "○"} {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm */}
            <div className="mb-6">
              <label htmlFor={`${id}-confirm`} className="mb-1.5 block text-sm font-medium text-foreground">
                Confirm new password
              </label>
              <input
                id={`${id}-confirm`}
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                required
                className={cn(
                  "w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                  confirmPw && newPw !== confirmPw
                    ? "border-danger/50 focus:border-danger"
                    : "border-border focus:border-violet/50"
                )}
              />
              {confirmPw && newPw !== confirmPw && (
                <p className="mt-1.5 text-xs text-danger">Passwords don't match</p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              whileHover={{ boxShadow: "0 0 22px -4px oklch(0.62 0.22 293 / 55%)" }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9d72f7] to-[#7c3aed] py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
            >
              {loading ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <ShieldCheck className="h-4 w-4" />}
              {loading ? "Updating…" : "Set New Password"}
            </motion.button>

            {!isMandatory && (
              <button
                type="button"
                onClick={() => navigate({ to: `/${user.role}` })}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancel — go back to dashboard
              </button>
            )}

            {isMandatory && (
              <button
                type="button"
                onClick={() => { logout(); navigate({ to: "/login" }); }}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-danger transition"
              >
                Sign out instead
              </button>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
