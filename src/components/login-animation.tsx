/**
 * LoginAnimation — "Open Book, Awakening AI" login-to-dashboard transition.
 *
 * Sequence:
 *   0–200ms    Book-open: card halves rotate outward on center spine (perspectiveY flip)
 *   200–640ms  Page-flip: 5 pages with faint role-specific content ghosts
 *   640–760ms  Spark: small violet-gold node at center
 *   760–900ms  Radiate: 12 lines spread outward (Concept Graph edge style)
 *   900–1050ms Resolve: overlay fades out; dashboard crystallizes beneath
 *
 * Respects prefers-reduced-motion: entire sequence is replaced by a 150ms crossfade.
 *
 * Cancellation safety: all timeouts cleared on unmount; AnimatePresence handles
 * mid-animation unmount without errors.
 */

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Role } from "@/lib/mock-data";

interface Props {
  role: Role;
  active: boolean;
  onComplete: () => void;
}

// Faint role-specific content ghost SVGs shown on "pages"
function PageGhost({ role, page }: { role: Role; page: number }) {
  const opacity = 0.07;
  const stroke = "#8b5cf6";

  if (role === "student") {
    if (page === 0) return (
      // Quiz checkmarks
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <rect x="10" y="10" width="60" height="40" rx="4" />
        <polyline points="20,25 28,33 42,19" />
        <polyline points="20,40 28,48 42,34" />
        <line x1="50" y1="22" x2="68" y2="22" />
        <line x1="50" y1="37" x2="68" y2="37" />
      </svg>
    );
    if (page === 1) return (
      // Area chart silhouette
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <polyline points="8,50 20,35 32,40 44,20 56,28 72,12" fill="none" />
        <line x1="8" y1="50" x2="72" y2="50" />
        <line x1="8" y1="12" x2="8" y2="50" />
      </svg>
    );
    return (
      // Chat bubble
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <rect x="8" y="8" width="52" height="32" rx="8" />
        <polygon points="12,40 22,40 16,52" />
        <line x1="16" y1="22" x2="48" y2="22" />
        <line x1="16" y1="30" x2="38" y2="30" />
      </svg>
    );
  }

  if (role === "faculty") {
    if (page === 0) return (
      // Document upload icon
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <rect x="16" y="10" width="48" height="40" rx="4" />
        <line x1="40" y1="44" x2="40" y2="24" />
        <polyline points="32,30 40,22 48,30" />
        <line x1="24" y1="48" x2="56" y2="48" />
      </svg>
    );
    if (page === 1) return (
      // Donut outline
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1.5" opacity={opacity}>
        <circle cx="40" cy="30" r="22" />
        <circle cx="40" cy="30" r="12" />
      </svg>
    );
    return (
      // Bar chart
      <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <rect x="12" y="30" width="10" height="20" />
        <rect x="28" y="18" width="10" height="32" />
        <rect x="44" y="10" width="10" height="40" />
        <rect x="60" y="24" width="10" height="26" />
        <line x1="8" y1="50" x2="76" y2="50" />
      </svg>
    );
  }

  // admin
  if (page === 0) return (
    // Stat cards outline
    <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
      <rect x="6"  y="8"  width="30" height="18" rx="3" />
      <rect x="44" y="8"  width="30" height="18" rx="3" />
      <rect x="6"  y="34" width="30" height="18" rx="3" />
      <rect x="44" y="34" width="30" height="18" rx="3" />
    </svg>
  );
  if (page === 1) return (
    // Users list rows
    <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
      <circle cx="18" cy="18" r="7" />
      <line x1="30" y1="14" x2="68" y2="14" />
      <line x1="30" y1="22" x2="56" y2="22" />
      <line x1="8" y1="36" x2="72" y2="36" />
      <line x1="8" y1="48" x2="72" y2="48" />
    </svg>
  );
  return (
    <svg viewBox="0 0 80 60" className="h-full w-full" fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
      <polyline points="8,50 22,32 36,40 50,18 64,25 72,12" />
      <line x1="8" y1="50" x2="72" y2="50" />
    </svg>
  );
}

// The 12 radial line angles (spread like concept graph edges)
const RADIAL_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const LINE_LENGTH = 180; // px from center

export function LoginAnimation({ role, active, onComplete }: Props) {
  const prefersReduced = useReducedMotion();
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timerRefs.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    return () => {
      // Cancellation safety: clear all pending timers on unmount
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const duration = prefersReduced ? 100 : 350;
    addTimer(onComplete, duration);
  }, [active, prefersReduced, onComplete, addTimer]);

  if (!active) return null;

  // ── Reduced-motion: simple fade crossfade ─────────────────────────────────
  if (prefersReduced) {
    return (
      <motion.div
        key="reduced-overlay"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9999] bg-background"
        style={{ pointerEvents: "none" }}
      />
    );
  }

  // ── Full animation ────────────────────────────────────────────────────────
  const W = 420; // card width px
  const H = 520; // card height px
  const cx = W / 2;
  const cy = H / 2;

  const PAGES = [0, 1, 2, 3, 4];

  return (
    <AnimatePresence>
      <motion.div
        key="book-overlay"
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        style={{ background: "var(--color-background)", pointerEvents: "none" }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* ── Ambient background glow (fades out) ── */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.12, 0.06, 0] }}
          transition={{ duration: 1.05, times: [0, 0.3, 0.7, 1] }}
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.62 0.22 293 / 1) 0%, transparent 70%)",
          }}
        />

        {/* ── Book container ── */}
        <div
          className="relative select-none"
          style={{ width: W, height: H, perspective: "1200px" }}
        >
          {/* ── Left half — rotates outward ── */}
          <motion.div
            className="absolute top-0 left-0 overflow-hidden rounded-l-2xl border border-border bg-card"
            style={{
              width: W / 2,
              height: H,
              transformOrigin: "right center",
              transformStyle: "preserve-3d",
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: -70 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex h-full flex-col items-center justify-center opacity-20">
              <div className="font-serif text-4xl font-bold text-foreground">AI</div>
              <div className="text-xs text-muted-foreground">Tutor</div>
            </div>
          </motion.div>

          {/* ── Right half — rotates outward ── */}
          <motion.div
            className="absolute top-0 right-0 overflow-hidden rounded-r-2xl border border-border bg-card"
            style={{
              width: W / 2,
              height: H,
              transformOrigin: "left center",
              transformStyle: "preserve-3d",
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 70 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex h-full flex-col items-center justify-center opacity-20">
              <div className="font-serif text-4xl font-bold text-foreground">🎓</div>
            </div>
          </motion.div>

          {/* ── Page flip sequence ── */}
          {PAGES.map((page, i) => (
            <motion.div
              key={`page-${page}`}
              className="absolute top-0 left-0 overflow-hidden rounded-2xl border border-violet/15 bg-card"
              style={{
                width: W,
                height: H,
                transformOrigin: "left center",
                transformStyle: "preserve-3d",
              }}
              initial={{ rotateY: 0, opacity: 0 }}
              animate={{
                rotateY: [0, 0, -80, -80],
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{
                duration: 0.44 / PAGES.length + 0.05,
                delay: 0.2 + i * (0.44 / PAGES.length),
                ease: "easeInOut",
                times: [0, 0.05, 0.9, 1],
              }}
            >
              <div className="flex h-full items-center justify-center p-8">
                <PageGhost role={role} page={page % 3} />
              </div>
              {/* Spine highlight */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-violet/15 to-transparent" />
            </motion.div>
          ))}

          {/* ── Spark node at center ── */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 12,
              height: 12,
              left: cx - 6,
              top: cy - 6,
              background: "radial-gradient(circle, #f5c451 0%, #8b5cf6 60%, transparent 100%)",
              boxShadow: "0 0 20px 6px oklch(0.62 0.22 293 / 60%), 0 0 40px 12px oklch(0.82 0.18 84 / 30%)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
            transition={{ delay: 0.64, duration: 0.12, ease: "easeOut" }}
          />

          {/* ── Radiating concept-graph lines ── */}
          <svg
            className="absolute inset-0"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ overflow: "visible" }}
          >
            {RADIAL_ANGLES.map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x2 = cx + Math.cos(rad) * LINE_LENGTH;
              const y2 = cy + Math.sin(rad) * LINE_LENGTH;
              return (
                <motion.line
                  key={angle}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke="url(#lineGrad)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeOpacity={0.55}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 0.55, 0] }}
                  transition={{
                    delay: 0.76 + i * 0.012,
                    duration: 0.22,
                    ease: "easeOut",
                    opacity: { times: [0, 0.4, 1], duration: 0.3 },
                  }}
                />
              );
            })}
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
                <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* ── Terminal node dots at line ends ── */}
          {RADIAL_ANGLES.slice(0, 8).map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = cx + Math.cos(rad) * LINE_LENGTH;
            const y = cy + Math.sin(rad) * LINE_LENGTH;
            return (
              <motion.div
                key={`node-${angle}`}
                className="absolute rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  left: x - 2.5,
                  top: y - 2.5,
                  background: "#8b5cf6",
                  boxShadow: "0 0 8px 2px oklch(0.62 0.22 293 / 50%)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 0.9], opacity: [0, 1, 0] }}
                transition={{
                  delay: 0.85 + i * 0.015,
                  duration: 0.2,
                  ease: "easeOut",
                }}
              />
            );
          })}
        </div>

        {/* ── Final fade-out overlay — reveals dashboard beneath ── */}
        <motion.div
          className="absolute inset-0 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.88, duration: 0.17, ease: "easeIn" }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
