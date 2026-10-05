import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useId, useCallback, useEffect, useRef } from "react";
import {
  GraduationCap,
  User,
  Users,
  Shield,
  Eye,
  EyeOff,
  Chrome,
  ArrowLeft,
  Moon,
  Sun,
  X,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { LoginAnimation } from "@/components/login-animation";

export const Route = createFileRoute("/")({
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
    icon: User,
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
    icon: Shield,
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

// ─── Ambient Particle Node ────────────────────────────────────────────────────

interface ParticleNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

const NUM_PARTICLES = 14;
const CONNECTION_DIST = 180;

function useParticles(count: number) {
  const [nodes, setNodes] = useState<ParticleNode[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1200),
      y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 800),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      size: 2 + Math.random() * 2.5,
    })),
  );

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const tick = () => {
      setNodes((prev) =>
        prev.map((n) => {
          let nx = n.x + n.vx;
          let ny = n.y + n.vy;
          let nvx = n.vx;
          let nvy = n.vy;
          if (nx < 0 || nx > W) nvx = -nvx;
          if (ny < 0 || ny > H) nvy = -nvy;
          nx = Math.max(0, Math.min(W, nx));
          ny = Math.max(0, Math.min(H, ny));
          return { ...n, x: nx, y: ny, vx: nvx, vy: nvy };
        }),
      );
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return nodes;
}

function ParticleCanvas() {
  const nodes = useParticles(NUM_PARTICLES);

  const connections: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> =
    [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DIST) {
        connections.push({
          x1: nodes[i].x,
          y1: nodes[i].y,
          x2: nodes[j].x,
          y2: nodes[j].y,
          opacity: (1 - dist / CONNECTION_DIST) * 0.12,
        });
      }
    }
  }

  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {connections.map((c, i) => (
        <line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke="#8b5cf6"
          strokeWidth={0.8}
          strokeOpacity={c.opacity}
        />
      ))}
      {nodes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={n.size} fill="#8b5cf6" fillOpacity={0.18} />
      ))}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function LoginPage() {
  const [activeRole, setActiveRole] = useState<Role>("student");
  const [view, setView] = useState<ViewMode>("login");
  const [animating, setAnimating] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role>("student");
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const prefersReduced = useReducedMotion();

  const handleLoginSuccess = useCallback(
    (role: Role, mustChangePw: boolean) => {
      if (mustChangePw) {
        // Bypass animation — go straight to forced password change
        navigate({ to: "/change-password" });
        return;
      }
      setPendingRole(role);
      setAnimating(true);
    },
    [navigate],
  );

  const handleRegisterSuccess = useCallback((role: Role) => {
    setPendingRole(role);
    setAnimating(true);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    setAnimating(false);
    navigate({ to: `/${pendingRole}` });
  }, [navigate, pendingRole]);

  const roleConfig = ROLES.find((r) => r.key === activeRole)!;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 font-sans"
      style={{ background: isDark ? "#0d0d14" : "#f7f7fb" }}
    >
      {/* ── Ambient background glows (page level) ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-[100px]"
          style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }}
        />
        <div
          className="absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full opacity-[0.05] blur-[90px]"
          style={{ background: "radial-gradient(circle, #f5c451 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Theme toggle top-right ── */}
      <div className="fixed right-6 top-5 z-20">
        <button
          type="button"
          onClick={toggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="theme-toggle-pill hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            className={cn(
              "absolute left-2 flex h-5 w-5 items-center justify-center transition-opacity",
              isDark ? "opacity-30" : "opacity-0",
            )}
          >
            <Sun className="h-3.5 w-3.5 text-gold" />
          </span>
          <span
            className={cn(
              "absolute right-2 flex h-5 w-5 items-center justify-center transition-opacity",
              !isDark ? "opacity-30" : "opacity-0",
            )}
          >
            <Moon className="h-3.5 w-3.5 text-violet" />
          </span>
          <span className={cn("theme-toggle-thumb", isDark ? "is-dark" : "is-light")}>
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span
                  key="sun"
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 45, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Sun className="h-3.5 w-3.5 text-white" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ rotate: 45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -45, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Moon className="h-3.5 w-3.5 text-white" />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>
      </div>

      {/* ── Two-panel floating card container ── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-6xl mx-auto"
      >
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            boxShadow: isDark
              ? "0 0 0 1px rgba(167,139,250,0.24), 0 32px 80px -20px rgba(0,0,0,0.72), 0 0 70px -12px rgba(139,92,246,0.22)"
              : "0 0 0 1px oklch(0.62 0.22 293 / 15%), 0 32px 80px -20px rgba(0,0,0,0.28), 0 0 60px -10px oklch(0.62 0.22 293 / 10%)",
          }}
        >
          <div className="grid lg:grid-cols-[40%_60%] min-h-[600px]">
            {/* ── LEFT PANEL (Form side) ── */}
            <div
              className="relative px-8 py-10 lg:px-12 lg:py-14"
              style={{ background: isDark ? "#17171f" : "#ffffff" }}
            >
              {/* Logo lockup */}
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/15 ring-1 ring-violet/25 shadow-[0_0_12px_-2px_oklch(0.62_0.22_293_/_30%)]">
                  <GraduationCap className="h-6 w-6 text-violet" />
                </div>
                <div className="leading-tight">
                  <div className="font-serif text-2xl font-bold">
                    <span className={isDark ? "text-white" : "text-foreground"}>AI </span>
                    <span className="text-violet">Tutor</span>
                  </div>
                </div>
              </div>

              {/* Headline and subtext */}
              <div className="mb-6">
                <h1 className="font-serif text-3xl font-bold text-foreground">
                  Sign in to AI Tutor
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your syllabus-grounded study companion
                </p>
              </div>

              {/* Role tabs (pill-shaped segmented control) */}
              <div className="mb-6">
                <div
                  className="inline-flex rounded-full p-1 gap-1"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                >
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
                        className={cn(
                          "relative px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isActive
                            ? "bg-violet text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Forms */}
              <AnimatePresence mode="wait">
                {view === "login" && (
                  <motion.div
                    key={`login-${activeRole}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <LoginForm
                      roleConfig={roleConfig}
                      onForgot={() => setView("forgot")}
                      onRegister={() => setView("register")}
                      onLoginSuccess={handleLoginSuccess}
                    />
                  </motion.div>
                )}
                {view === "register" && (
                  <motion.div
                    key={`register-${activeRole}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <RegisterForm
                      roleConfig={roleConfig}
                      onBack={() => setView("login")}
                      onRegisterSuccess={handleRegisterSuccess}
                    />
                  </motion.div>
                )}
                {view === "forgot" && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ForgotPasswordForm onBack={() => setView("login")} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Demo hint */}
              <p className="mt-6 text-center text-xs text-muted-foreground opacity-70">
                Demo credentials are pre-filled — just click <strong>Login</strong>.
              </p>
            </div>

            {/* ── RIGHT PANEL (Brand/illustration side) ── */}
            <div className="relative hidden lg:block overflow-hidden">
              {/* Base gradient background */}
              <div
                className="absolute inset-0"
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #a855f7 100%)"
                    : "linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #9333ea 100%)",
                }}
              />

              {/* Large decorative background shapes - matching reference style */}
              <div className="absolute inset-0">
                {/* Large circle/blob - top left */}
                <div
                  className="absolute -top-20 -left-20 rounded-full"
                  style={{
                    width: "400px",
                    height: "400px",
                    background: isDark
                      ? "radial-gradient(circle, rgba(167,139,250,0.4) 0%, rgba(139,92,246,0.2) 50%, transparent 100%)"
                      : "radial-gradient(circle, rgba(233,213,255,0.6) 0%, rgba(216,180,254,0.3) 50%, transparent 100%)",
                    filter: "blur(60px)",
                  }}
                />

                {/* Large circle/blob - bottom right */}
                <div
                  className="absolute -bottom-32 -right-32 rounded-full"
                  style={{
                    width: "500px",
                    height: "500px",
                    background: isDark
                      ? "radial-gradient(circle, rgba(196,181,253,0.3) 0%, rgba(167,139,250,0.15) 50%, transparent 100%)"
                      : "radial-gradient(circle, rgba(243,232,255,0.5) 0%, rgba(233,213,255,0.25) 50%, transparent 100%)",
                    filter: "blur(80px)",
                  }}
                />

                {/* Medium floating shape - center */}
                <div
                  className="absolute top-1/3 left-1/4 rounded-full"
                  style={{
                    width: "250px",
                    height: "250px",
                    background: isDark
                      ? "radial-gradient(circle, rgba(245,196,81,0.25) 0%, rgba(217,119,6,0.1) 50%, transparent 100%)"
                      : "radial-gradient(circle, rgba(254,243,199,0.4) 0%, rgba(253,224,71,0.2) 50%, transparent 100%)",
                    filter: "blur(50px)",
                  }}
                />

                {/* Geometric accent shape - like reference */}
                <div
                  className="absolute top-0 right-0"
                  style={{
                    width: "60%",
                    height: "70%",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(196,181,253,0.15) 0%, rgba(139,92,246,0.1) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(233,213,255,0.15) 100%)",
                    clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 80%)",
                    filter: "blur(30px)",
                  }}
                />

                {/* Layered wave/curve effect - bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: "200px",
                    background: isDark
                      ? "linear-gradient(180deg, transparent 0%, rgba(139,92,246,0.2) 100%)"
                      : "linear-gradient(180deg, transparent 0%, rgba(192,132,252,0.3) 100%)",
                    filter: "blur(20px)",
                  }}
                />
              </div>

              {/* Subtle particle overlay - only in background */}
              <div className="absolute inset-0 opacity-30">
                <ParticleCanvas />
              </div>

              {/* Content overlay */}
              <div className="relative h-full flex flex-col items-center justify-between p-12 z-10">
                {/* Top: Logo wordmark with white badge style */}
                <div className="text-center">
                  <div
                    className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl mb-4"
                    style={{
                      background: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.3)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <GraduationCap className="h-7 w-7 text-white" />
                    <div className="font-serif text-2xl font-bold text-white">AI Tutor</div>
                  </div>
                  <p className="text-sm font-medium text-white/90">Smart Study Assistant</p>
                </div>

                {/* Center: 3D Student Illustration with animated background */}
                <div className="flex-1 flex items-end justify-center w-full px-8 pb-8">
                  <div className="relative w-full max-w-lg">
                    {/* Animated floating shapes behind character */}
                    <motion.div
                      className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full -z-10"
                      style={{
                        background: isDark
                          ? "radial-gradient(circle, rgba(245,196,81,0.4) 0%, transparent 70%)"
                          : "radial-gradient(circle, rgba(253,224,71,0.5) 0%, transparent 70%)",
                        filter: "blur(40px)",
                      }}
                      animate={prefersReduced ? undefined : { y: [0, -20, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />

                    <motion.div
                      className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full -z-10"
                      style={{
                        background: isDark
                          ? "radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%)"
                          : "radial-gradient(circle, rgba(196,181,253,0.6) 0%, transparent 70%)",
                        filter: "blur(35px)",
                      }}
                      animate={
                        prefersReduced
                          ? undefined
                          : { y: [0, 25, 0], x: [0, -15, 0], scale: [1, 1.15, 1] }
                      }
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />

                    <motion.div
                      className="absolute bottom-1/3 left-1/3 w-28 h-28 rounded-full -z-10"
                      style={{
                        background: isDark
                          ? "radial-gradient(circle, rgba(196,181,253,0.45) 0%, transparent 70%)"
                          : "radial-gradient(circle, rgba(216,180,254,0.55) 0%, transparent 70%)",
                        filter: "blur(38px)",
                      }}
                      animate={
                        prefersReduced
                          ? undefined
                          : { y: [0, 20, 0], x: [0, 10, 0], scale: [1, 1.2, 1] }
                      }
                      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    />

                    {/* Glow effect behind character */}
                    <div
                      className="absolute inset-0 -z-10"
                      style={{
                        background: isDark
                          ? "radial-gradient(ellipse at bottom, rgba(255,255,255,0.15) 0%, transparent 60%)"
                          : "radial-gradient(ellipse at bottom, rgba(255,255,255,0.4) 0%, transparent 60%)",
                        filter: "blur(40px)",
                      }}
                    />

                    {/* Character image - white background removed via CSS filter */}
                    <img
                      src="/assets/illustrations/student-illustration.png"
                      alt="Male student with backpack and books"
                      className="w-full h-auto object-contain relative z-10"
                      style={{
                        filter: `
                          drop-shadow(0 25px 50px rgba(0,0,0,0.4))
                          contrast(1.05)
                          saturate(1.1)
                        `,
                        maxHeight: "480px",
                        background: "transparent",
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src.includes(".png")) {
                          target.src = "/assets/illustrations/student-illustration.svg";
                        } else {
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector(".fallback-placeholder")) {
                            const fallback = document.createElement("div");
                            fallback.className =
                              "fallback-placeholder flex flex-col items-center justify-center gap-4 py-12";
                            fallback.innerHTML = `
                              <div class="text-6xl opacity-50">👨‍🎓</div>
                              <div class="text-center text-white/70">
                                <p class="text-sm font-medium">Add your 3D student illustration</p>
                                <p class="text-xs mt-1 opacity-70">Place image at:</p>
                                <p class="text-xs font-mono mt-1">/assets/illustrations/student-illustration.png</p>
                              </div>
                            `;
                            parent.appendChild(fallback);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Bottom: Subtle tagline */}
                <div className="text-center">
                  <p className="text-xs text-white/60 font-medium">
                    CSPIT CSE · RAG-Powered Learning Platform
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Book animation overlay ── */}
      <LoginAnimation role={pendingRole} active={animating} onComplete={handleAnimationComplete} />
    </div>
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
    await new Promise((r) => setTimeout(r, 380));
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
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card/50 py-3 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-violet/35 hover:bg-accent/40 hover:shadow-[0_8px_20px_-12px_rgba(124,58,237,0.55)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Chrome className="h-4 w-4 text-muted-foreground" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative my-5 flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">Or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Email with icon inside */}
        <div className="mb-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className={cn(
                "w-full rounded-full border bg-background/60 pl-11 pr-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-violet/30",
                "focus:border-violet/50 focus:shadow-[0_0_0_3px_oklch(0.62_0.22_293_/_12%)]",
                isDark ? "border-border" : "border-border",
              )}
            />
          </div>
        </div>

        {/* Password with icon inside */}
        <div className="mb-3">
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id={`${id}-password`}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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

        {/* Remember me & Forgot password row */}
        <div className="mb-6 flex items-center justify-between">
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
          whileTap={{ scale: 0.97 }}
          whileHover={{ boxShadow: "0 0 24px -4px oklch(0.62 0.22 293 / 60%)" }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60",
            "bg-gradient-to-r from-[#9d72f7] via-[#8b5cf6] to-[#6d28d9]",
          )}
        >
          {loading ? "Signing in…" : "Login"}
        </motion.button>
      </form>

      <div className="mt-5 text-center text-sm text-muted-foreground">
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
    await new Promise((r) => setTimeout(r, 450));
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
  const { register } = useAuth();
  const id = useId();
  const { isDark } = useTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState<string>(roleConfig.placeholder.email);
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("CSE");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName("");
    setEmail(roleConfig.placeholder.email);
    setPassword("");
    setDepartmentId("CSE");
    setError(null);
  }, [roleConfig.key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const result = await register(
      name.trim(),
      email.trim(),
      password,
      roleConfig.key,
      departmentId,
    );
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Registration failed.");
      return;
    }

    onRegisterSuccess(roleConfig.key);
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
          <h2 className="font-serif text-xl font-bold text-foreground">Create your account</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Register as a {roleConfig.label.toLowerCase()} to access AI Tutor.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
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
              placeholder="Email address"
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

        <div className="mb-4">
          <div className="relative">
            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id={`${id}-register-password`}
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
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
          {loading ? "Creating account…" : `Sign up as ${roleConfig.label}`}
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
    await new Promise((r) => setTimeout(r, 400));
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
