import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useId, useCallback, useEffect } from "react";
import {
  User,
  Users,
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  X,
  UserPlus,
  GraduationCap,
  Settings,
  Mail,
  Lock,
  BookOpen,
  FileText,
  Code2,
  Brain,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { Logo, Sparkle, ThemeToggle } from "@/components/brand";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · AI Tutor" },
      {
        name: "description",
        content: "Sign in to AI Tutor — grounded academic tutoring for CSPIT CSE.",
      },
      { property: "og:title", content: "Sign in · AI Tutor" },
    ],
  }),
  component: LoginPage,
});

// ─── Role config ─────────────────────────────────────────────────────────────

const ROLES = [
  {
    key: "student" as Role,
    label: "Student",
    icon: GraduationCap,
    headline: "Student Sign In",
    subtext: "Ask, learn, and quiz yourself.",
    accentClass: "text-violet",
    placeholder: { email: "student@charusat.edu.in", password: "student123" },
  },
  {
    key: "faculty" as Role,
    label: "Faculty",
    icon: Users,
    headline: "Faculty Sign In",
    subtext: "Manage content and answer student queries.",
    accentClass: "text-gold",
    placeholder: { email: "faculty@charusat.edu.in", password: "faculty123" },
  },
  {
    key: "admin" as Role,
    label: "Admin",
    icon: Settings,
    headline: "Admin Sign In",
    subtext: "Operate the institution knowledge base.",
    accentClass: "text-teal-brand",
    placeholder: { email: "admin@charusat.edu.in", password: "admin123" },
  },
] as const;

type ViewMode = "login" | "forgot" | "register";

const DEPARTMENT_OPTIONS = [
  { code: "CE", label: "Computer Engineering" },
  { code: "CSE", label: "Computer Science & Engineering" },
  { code: "IT", label: "Information Technology" },
  { code: "EC", label: "Electronics & Communication" },
  { code: "AIML", label: "AI & Machine Learning" },
];

const FEATURE_CHIPS = [
  { icon: BookOpen, label: ["Understand", "Concepts"], tile: "from-sky-400/30 to-blue-500/20 text-sky-500", dx: 0 },
  { icon: FileText, label: ["Summarize", "Notes"], tile: "from-emerald-400/35 to-teal-500/20 text-emerald-500", dx: 14 },
  { icon: Code2, label: ["Solve", "Doubts"], tile: "from-violet-400/35 to-indigo-500/25 text-violet", dx: 22 },
  { icon: Brain, label: ["Personalized", "Learning"], tile: "from-fuchsia-400/35 to-pink-500/20 text-fuchsia-500", dx: 22 },
];

// ─── Login page ──────────────────────────────────────────────────────────────

function LoginPage() {
  const [activeRole, setActiveRole] = useState<Role>("student");
  const [view, setView] = useState<ViewMode>("login");
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleLoginSuccess = useCallback(
    (role: Role, mustChangePw: boolean) => {
      if (mustChangePw) {
        navigate({ to: "/change-password" });
        return;
      }
      navigate({ to: `/${role}` });
    },
    [navigate],
  );

  const handleRegisterSuccess = useCallback(
    (role: Role) => {
      navigate({ to: `/${role}` });
    },
    [navigate],
  );

  const roleConfig = ROLES.find((r) => r.key === activeRole)!;

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-foreground">
      <AuthBackdrop />

      {/* Theme toggle */}
      <div className="fixed right-6 top-5 z-30">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1560px] items-center gap-6 px-6 py-8 lg:grid-cols-[1.28fr_1fr] lg:px-10 xl:px-14">
        {/* ───────── LEFT: brand + mascot ───────── */}
        <section className="relative hidden min-h-[640px] self-stretch lg:block">
          <Link to="/" className="absolute left-0 top-0">
            <Logo size="md" />
          </Link>

          <div className="absolute left-0 top-[5.5rem]">
            <h1 className="text-[3.4rem] font-extrabold leading-[1.04] tracking-tight xl:text-[3.9rem]">
              Your
              <br />
              Personal
              <br />
              <span className="gradient-word relative inline-block">
                AI Study Partner
                <svg viewBox="0 0 220 10" className="absolute -bottom-1 left-0 h-2.5 w-[48%] text-violet" fill="none" aria-hidden>
                  <path d="M2 6c10-6 20 4 30 0s20-6 30 0 20 4 30 0 20-6 30 0 20 4 30 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-5 max-w-sm text-lg leading-snug text-muted-foreground">
              Learn smarter, ask deeper, and
              <br />
              grow faster with AI.
            </p>

            <div className="mt-7 space-y-3">
              {FEATURE_CHIPS.map((c, i) => (
                <motion.div
                  key={c.label.join("")}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  style={{ marginLeft: c.dx, rotate: -5 }}
                  className="glass flex w-[15.5rem] items-center gap-3 rounded-[1.4rem] border border-border p-2.5 shadow-[var(--card-shadow)]"
                >
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br", c.tile)}>
                    <c.icon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {c.label[0]}
                    <br />
                    {c.label[1]}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mascot scene */}
          <div className="pointer-events-none absolute bottom-0 right-[2%] w-[56%] max-w-[560px]">
            <div className="absolute -top-[9.5rem] left-[52%] w-[34%]">
              <div className="absolute inset-[-25%] rounded-full bg-indigo-400/25 blur-2xl dark:bg-indigo-500/35" />
              <img src="/assets/ui/robot.png" alt="AI Tutor robot" className="bob relative w-full drop-shadow-[0_12px_28px_rgba(99,102,241,.5)]" />
              <Sparkle className="-left-5 top-2 h-4 w-4" />
              <Sparkle className="right-0 -top-3 h-6 w-6" delay={0.8} />
              <Sparkle className="-left-9 top-14 h-3 w-3" delay={1.5} />
            </div>
            <img
              src="/assets/ui/login-boy.png"
              alt="Student learning with AI Tutor"
              className="relative z-10 w-full drop-shadow-[0_28px_40px_rgba(30,20,90,.35)]"
            />
          </div>

          {/* handwritten note + arrow */}
          <div className="pointer-events-none absolute right-[4%] top-[2.6rem] hidden xl:block">
            <div className="hand-note text-[1.7rem]" style={{ transform: "rotate(-11deg)" }}>
              <div>Ask</div>
              <div>Learn</div>
              <div>Grow</div>
            </div>
            <svg viewBox="0 0 80 60" className="absolute -bottom-9 left-1 h-14 w-20 text-violet" fill="none" aria-hidden>
              <path d="M70 6C60 36 36 46 8 44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 0" />
              <path d="M16 36 6 44l12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>


        </section>

        {/* ───────── RIGHT: auth card ───────── */}
        <section className="relative mx-auto w-full max-w-[600px] lg:ml-auto lg:mr-0">
          <div className="pointer-events-none absolute -right-2 bottom-24 hidden translate-x-full xl:block" aria-hidden>
            <svg viewBox="0 0 90 90" className="absolute -top-44 left-4 h-24 w-24 text-violet" fill="none">
              <path d="M14 70C20 40 50 24 74 18" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
              <path d="m62 10 14 8-10 12-4-20z" fill="currentColor" />
              <circle cx="22" cy="78" r="10" stroke="currentColor" strokeDasharray="3 4" strokeWidth="1.5" opacity=".6" />
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass relative rounded-[2.2rem] border border-border px-7 py-9 sm:px-10"
            style={{
              boxShadow: isDark
                ? "0 0 0 1px rgba(139,123,255,.28), 0 40px 90px -30px rgba(0,0,0,.8), 0 0 80px -20px rgba(99,102,241,.35)"
                : "0 40px 80px -36px rgba(76,56,190,.45), 0 0 0 1px rgba(255,255,255,.8) inset",
            }}
          >
            <div className="mb-5 flex justify-center lg:hidden">
              <Logo size="md" />
            </div>
            <div className="mb-5 hidden justify-center lg:flex">
              <Logo size="lg" />
            </div>

            <div className="mb-6 text-center">
              <h2 className="text-[1.9rem] font-extrabold tracking-tight">
                {view === "register" ? "Create Account" : view === "forgot" ? "Reset Password" : "Welcome Back!"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {view === "register"
                  ? "Join AI Tutor and start your learning journey."
                  : view === "forgot"
                    ? "We'll help you get back into your account."
                    : "Sign in to continue your learning journey."}
              </p>
            </div>

            {/* Role tabs */}
            <div className="mb-6 flex justify-center">
              <div className="seg inline-flex items-center justify-center">
                {ROLES.map((r) => {
                  const isActive = activeRole === r.key;
                  return (
                    <button
                      key={r.key}
                      id={`role-tab-${r.key}`}
                      type="button"
                      onClick={() => {
                        setActiveRole(r.key);
                        setView("login");
                      }}
                      aria-pressed={isActive}
                      className="justify-center text-center px-4 py-2"
                    >
                      <r.icon className="h-4 w-4" />
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {view === "login" && (
                <motion.div key={`login-${activeRole}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                  <LoginForm
                    roleConfig={roleConfig}
                    onForgot={() => setView("forgot")}
                    onRegister={() => setView("register")}
                    onLoginSuccess={handleLoginSuccess}
                  />
                </motion.div>
              )}
              {view === "register" && (
                <motion.div key={`register-${activeRole}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                  <RegisterForm roleConfig={roleConfig} onBack={() => setView("login")} onRegisterSuccess={handleRegisterSuccess} />
                </motion.div>
              )}
              {view === "forgot" && (
                <motion.div key="forgot" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                  <ForgotPasswordForm onBack={() => setView("login")} />
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Demo credentials are pre-filled — just click <strong className="text-foreground">Login</strong>.
            </p>
          </motion.div>

          <div className="pointer-events-none absolute -right-4 bottom-10 hidden translate-x-full xl:block">
            <div className="hand-note w-32 text-[1.05rem]" style={{ transform: "rotate(-12deg)" }}>
              “Same Syllabus
              <br />
              Better Learning
              <br />
              with AI!”
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Cosy blurred study-room backdrop for both themes */
export function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef2ff_0%,#f3efff_45%,#eaf1ff_100%)] dark:bg-[linear-gradient(135deg,#070a24_0%,#0b0f33_50%,#0a0c2b_100%)]" />
      <div className="absolute -left-24 top-10 h-[26rem] w-[26rem] rounded-full bg-sky-300/35 blur-3xl dark:bg-indigo-600/25" />
      <div className="absolute right-[18%] -top-24 h-[30rem] w-[30rem] rounded-[5rem] bg-violet-300/45 blur-3xl dark:bg-violet-700/25" />
      <div className="absolute bottom-0 left-[28%] h-[20rem] w-[34rem] rounded-full bg-fuchsia-200/40 blur-3xl dark:bg-blue-700/20" />
      {/* faux bookshelf / window bokeh on the far left */}
      <div className="absolute left-0 top-0 hidden h-full w-[12%] bg-gradient-to-r from-slate-300/35 to-transparent dark:from-indigo-900/40 lg:block" />
      <div className="absolute inset-0 opacity-[.5] [background-image:radial-gradient(circle,rgba(255,255,255,.7)_1px,transparent_1.5px)] [background-size:34px_34px] dark:opacity-[.12]" />
    </div>
  );
}

function GoogleG({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({
  roleConfig,
  onForgot,
  onRegister,
  onLoginSuccess,
}: {
  roleConfig: (typeof ROLES)[number];
  onForgot: () => void;
  onRegister: () => void;
  onLoginSuccess: (role: Role, mustChangePw: boolean) => void;
}) {
  const { login, loginWithGoogle } = useAuth();
  const id = useId();
  const { isDark } = useTheme();

  const [email, setEmail] = useState<string>(roleConfig.placeholder.email);
  const [password, setPassword] = useState<string>(roleConfig.placeholder.password);
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // Reset pre-filled when role tab changes
  useEffect(() => {
    setEmail(roleConfig.placeholder.email);
    setPassword(roleConfig.placeholder.password);
    setError(null);
  }, [roleConfig.key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(roleConfig.key, email.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Login failed.");
      return;
    }
    onLoginSuccess(roleConfig.key, result.mustChangePassword ?? false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            id={`${id}-error`}
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-full border border-danger/30 bg-danger/8 px-5 py-3 text-sm text-danger"
          >
            <span className="mt-0.5">⚠</span>
            <span>{error}</span>
          </motion.div>
        )}

        {/* Google button */}
        <button
          type="button"
          onClick={() => setShowGoogleModal(true)}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card/70 py-3.5 text-[0.95rem] font-semibold text-foreground shadow-[var(--card-shadow)] transition hover:-translate-y-0.5 hover:border-violet/40 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <GoogleG />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative mb-5 flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">Or sign in with email</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Email with icon inside */}
        <div className="mb-4">
          <div className="relative">
            <Mail className="absolute left-5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-muted-foreground" />
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className={cn(
                "w-full rounded-full border bg-card/60 pl-12 pr-4 py-3.5 text-[0.95rem] text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                isDark ? "border-border" : "border-border",
              )}
            />
          </div>
        </div>

        {/* Password with icon inside */}
        <div className="mb-3">
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-muted-foreground" />
            <input
              id={`${id}-password`}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className={cn(
                "w-full rounded-full border bg-card/60 pl-12 pr-12 py-3.5 text-[0.95rem] text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                isDark ? "border-border" : "border-border",
              )}
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me & Forgot password row */}
        <div className="mb-5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border text-violet focus:ring-violet focus:ring-2 focus:ring-offset-0 cursor-pointer"
              style={{
                accentColor: "#8b5cf6",
              }}
            />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <button
            type="button"
            onClick={onForgot}
            className="text-sm font-medium text-violet transition hover:underline hover:text-violet/80"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit button with gradient */}
        <motion.button
          id={`login-btn-${roleConfig.key}`}
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.98 }}
          className="btn-grad relative flex w-full items-center justify-center rounded-full py-4 text-base font-bold text-white shadow-[0_18px_34px_-14px_rgba(95,63,230,.85)] transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Login"}
          <span className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-violet shadow-md">
            <ArrowRight className="h-5 w-5" />
          </span>
        </motion.button>
      </form>

      <div className="mt-5 text-center text-[0.95rem] text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onRegister}
          className="font-medium text-violet hover:underline"
        >
          Create account
        </button>
      </div>

      <AnimatePresence>
        {showGoogleModal && (
          <GoogleSignInModal
            role={roleConfig.key}
            onClose={() => setShowGoogleModal(false)}
            onSuccess={(role) => {
              setShowGoogleModal(false);
              onLoginSuccess(role, false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Google Sign In Modal ─────────────────────────────────────────────────────

function GoogleSignInModal({
  role,
  onClose,
  onSuccess,
}: {
  role: Role;
  onClose: () => void;
  onSuccess: (role: Role) => void;
}) {
  const { loginWithGoogle, signInWithGoogleOAuth } = useAuth();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handleOAuthClick = async () => {
    setOauthLoading(true);
    const res = await signInWithGoogleOAuth(role);
    if (!res.ok) {
      setOauthLoading(false);
      alert(res.error || "Failed to start Google sign-in.");
    }
  };

  const demoAccounts =
    role === "student"
      ? [
        { name: "Aarav Patel", email: "student@charusat.edu.in", avatar: "AP" },
        { name: "Meera Joshi", email: "meera@charusat.edu.in", avatar: "MJ" },
      ]
      : role === "faculty"
        ? [
          { name: "Dr. Nisha Shah", email: "faculty@charusat.edu.in", avatar: "NS" },
          { name: "Prof. Anil Kumar", email: "anil@charusat.edu.in", avatar: "AK" },
        ]
        : [{ name: "Rahul Mehta", email: "admin@charusat.edu.in", avatar: "RM" }];

  const handleSelectAccount = async (email: string, name?: string) => {
    setLoadingEmail(email);
    loginWithGoogle(role, email, name);
    onSuccess(role);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="font-medium text-sm text-foreground">Sign in with Google</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4">
          {/* Live Official Google OAuth button */}
          <button
            type="button"
            disabled={oauthLoading}
            onClick={handleOAuthClick}
            className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-violet/35 bg-violet/10 py-3 text-sm font-semibold text-violet hover:bg-violet/20 transition disabled:opacity-50 shadow-sm"
          >
            {oauthLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-violet" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting to Google...
              </span>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google Account
              </>
            )}
          </button>

          <div className="relative my-3 flex items-center gap-3">
            <div className="flex-1 border-t border-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Or Instant Demo</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="space-y-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loadingEmail !== null}
                onClick={() => handleSelectAccount(acc.email, acc.name)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:bg-violet/10 hover:border-violet/30 transition text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-violet/20 text-violet flex items-center justify-center text-xs font-bold ring-1 ring-violet/30">
                    {acc.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-violet">
                      {acc.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{acc.email}</div>
                  </div>
                </div>
                {loadingEmail === acc.email ? (
                  <svg className="h-4 w-4 animate-spin text-violet" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>

          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Use another Google account
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customEmail.trim()) handleSelectAccount(customEmail.trim(), customName.trim());
              }}
              className="mt-3 space-y-2 border-t border-border pt-3"
            >
              <input
                type="email"
                placeholder="Google Email (e.g. user@gmail.com)"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-violet"
                required
              />
              <input
                type="text"
                placeholder="Full Name (optional)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-violet"
              />
              <button
                type="submit"
                disabled={!customEmail.trim() || loadingEmail !== null}
                className="w-full rounded-xl bg-violet py-2 text-xs font-semibold text-white hover:bg-violet-hover disabled:opacity-50"
              >
                Sign in with this account
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Register Form ──────────────────────────────────────────────────────────

function RegisterForm({
  roleConfig,
  onBack,
  onRegisterSuccess,
}: {
  roleConfig: (typeof ROLES)[number];
  onBack: () => void;
  onRegisterSuccess: (role: Role) => void;
}) {
  const { register, sendOtp } = useAuth();
  const id = useId();
  const { isDark } = useTheme();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState<string>(roleConfig.placeholder.email);
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("CSE");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setName("");
    setEmail(roleConfig.placeholder.email);
    setPassword("");
    setDepartmentId("CSE");
    setOtp("");
    setStep("form");
    setError(null);
  }, [roleConfig.key]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill out all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setLoading(true);

    const otpRes = await sendOtp(email.trim(), name.trim());
    setLoading(false);

    if (!otpRes.ok) {
      setError(otpRes.error || "Failed to send verification email. Please try again.");
      return;
    }

    setResendCooldown(60);
    setStep("otp");
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    const otpRes = await sendOtp(email.trim(), name.trim());
    setLoading(false);
    if (!otpRes.ok) {
      setError(otpRes.error || "Failed to resend verification code.");
      return;
    }
    setResendCooldown(60);
  };

  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setError(null);
    setLoading(true);

    const result = await register(
      name.trim(),
      email.trim(),
      password,
      roleConfig.key,
      departmentId,
      otp.trim(),
    );
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Invalid or expired verification code.");
      return;
    }

    onRegisterSuccess(roleConfig.key);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === "otp") {
              setStep("form");
              setError(null);
            } else {
              onBack();
            }
          }}
          className="text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">
            {step === "form" ? "Create your account" : "Verify your email"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {step === "form"
              ? `Register as a ${roleConfig.label.toLowerCase()} to access AI Tutor.`
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>
      </div>

      {step === "form" ? (
        <form onSubmit={handleSendOtp} noValidate>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              id={`${id}-register-error`}
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-full border border-danger/30 bg-danger/8 px-5 py-3 text-sm text-danger"
            >
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </motion.div>
          )}

          <div className="mb-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id={`${id}-name`}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                required
                className={cn(
                  "w-full rounded-full border bg-background/60 pl-11 pr-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                  "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                  isDark ? "border-border" : "border-border",
                )}
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address (e.g. 24cs045@charusat.edu.in)"
                required
                className={cn(
                  "w-full rounded-full border bg-background/60 pl-11 pr-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                  "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                  isDark ? "border-border" : "border-border",
                )}
              />
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor={`${id}-department`}
              className="mb-1.5 ml-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Department
            </label>
            <select
              id={`${id}-department`}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
              className={cn(
                "w-full rounded-full border bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition",
                "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                isDark ? "border-border" : "border-border",
              )}
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.code} · {department.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id={`${id}-register-password`}
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min. 6 characters)"
                required
                className={cn(
                  "w-full rounded-full border bg-background/60 pl-11 pr-11 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                  "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                  isDark ? "border-border" : "border-border",
                )}
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            whileHover={{ boxShadow: "0 0 24px -4px oklch(0.62 0.22 293 / 60%)" }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60",
              "bg-gradient-to-r from-[#9d72f7] via-[#8b5cf6] to-[#6d28d9]",
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending Verification Code…
              </span>
            ) : (
              `Send Verification Code`
            )}
          </motion.button>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onBack}
              className="font-medium text-violet hover:underline"
            >
              Sign in
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtpAndRegister} noValidate>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger"
            >
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </motion.div>
          )}

          <div className="mb-6 rounded-2xl border border-violet/20 bg-violet/5 p-4 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet/10 text-violet">
              ✉
            </div>
            <p className="text-xs text-muted-foreground">
              We sent a 6-digit verification code directly to:
            </p>
            <p className="mt-0.5 font-semibold text-foreground text-sm">{email}</p>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Enter 6-Digit Code
            </label>
            <input
              id={`${id}-otp-input`}
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="123456"
              autoFocus
              className={cn(
                "w-full rounded-2xl border bg-background/60 py-3.5 text-center font-mono text-2xl tracking-[0.5em] font-bold text-foreground outline-none transition",
                "focus:border-violet focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_15%)]",
                isDark ? "border-border" : "border-border",
              )}
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading || otp.length !== 6}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-50",
              "bg-gradient-to-r from-[#9d72f7] via-[#8b5cf6] to-[#6d28d9]",
            )}
          >
            {loading ? "Verifying & Signing in…" : "Verify & Complete Registration"}
          </motion.button>

          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground px-2">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground transition underline"
            >
              Change Email
            </button>

            <button
              type="button"
              disabled={resendCooldown > 0 || loading}
              onClick={handleResendOtp}
              className="font-medium text-violet hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : "Resend Code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Forgot Password Form ────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { sendPasswordReset } = useAuth();
  const { isDark } = useTheme();
  const id = useId();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = sendPasswordReset(email.trim());
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Error sending reset link.");
      return;
    }
    setSent(true);
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">Forgot password?</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            We'll send a reset link to your email.
          </p>
        </div>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-success/30 bg-success/8 px-6 py-8 text-center">
          <div className="text-3xl mb-3">📬</div>
          <div className="font-semibold text-foreground">Reset link sent!</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your inbox at <strong>{email}</strong>.
          </p>
          <p className="mt-1 text-xs text-muted-foreground opacity-70">
            (Demo — no email is actually sent.)
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 text-sm font-medium text-violet hover:underline"
          >
            Back to login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-full border border-danger/30 bg-danger/8 px-5 py-3 text-sm text-danger"
            >
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
          <div className="mb-6">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id={`${id}-reset-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@charusat.edu.in"
                required
                className={cn(
                  "w-full rounded-full border bg-background/60 pl-11 pr-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                  "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                  isDark ? "border-border" : "border-border",
                )}
              />
            </div>
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            whileHover={{ boxShadow: "0 0 24px -4px oklch(0.62 0.22 293 / 60%)" }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60",
              "bg-gradient-to-r from-[#9d72f7] via-[#8b5cf6] to-[#6d28d9]",
            )}
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {loading ? "Sending…" : "Send reset link"}
          </motion.button>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <button
              type="button"
              onClick={onBack}
              className="font-medium text-violet hover:underline"
            >
              Back to login
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
