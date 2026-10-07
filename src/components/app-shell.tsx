import { useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  GraduationCap, LogOut, Bell, Sun, Moon,
  MessageSquare, Search, ChevronDown, TrendingUp, TrendingDown,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/mock-data";
import { currentUsers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { useTheme } from "@/hooks/use-theme";
import { useCountUp } from "@/hooks/use-count-up";
import { Logo, Mascot, ThemeToggle, Sparkle } from "@/components/brand";

export type NavItem = { to: string; label: string; icon: LucideIcon };

/* ─────────────────────────────────────────────────
   APP SHELL — shared layout for all roles
───────────────────────────────────────────────── */
export function AppShell({ role, nav }: { role: Role; nav: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const { notifications, markNotificationsAsRead } = useAppData();
  const { isDark, toggle } = useTheme();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const mockUser = currentUsers[role];
  const displayName = authUser?.name ?? mockUser.name;
  const displayEmail = authUser?.email ?? mockUser.email;
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const activeNav = nav.find(
    (item) => pathname === item.to || (item.to !== `/${role}` && pathname.startsWith(item.to))
  );
  const pageTitle = activeNav?.label ?? (role === "admin" ? "Overview" : role === "faculty" ? "Dashboard" : "Dashboard");

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      {/* ── Sidebar ── */}
      <aside className="sidebar-gradient fixed inset-y-0 left-0 z-20 flex w-[17.5rem] flex-col border-r border-border">
        <div className="px-6 pb-4 pt-6">
          <Logo size="sm" subtitle="CSPIT CSE · RAG Platform" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {nav.map((item) => {
            const active = pathname === item.to || (item.to !== `/${role}` && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={cn("nav-link", active && "is-active")}>
                <Icon className="nav-ico h-[1.15rem] w-[1.15rem] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 mb-4 mt-auto border-t border-border pt-4">
          <Link
            to={`/${role}/profile`}
            className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-accent"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet/25 to-violet/10 text-xs font-bold text-violet ring-2 ring-violet/30">
              {initials}
              <span className="online-dot absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">{displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground">{displayEmail}</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition hover:text-danger"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <div className="ml-[17.5rem] flex min-w-0 flex-1 flex-col">
        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-30 flex items-center gap-4 bg-background/70 px-8 py-4 backdrop-blur-xl">
          <div className="group top-chip max-w-xl flex-1 gap-3 px-5 text-sm transition-all focus-within:border-violet/50 focus-within:shadow-[0_0_0_4px_oklch(0.62_0.22_293_/_14%)]">
            <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-violet" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Quick search ${role === "admin" ? "students, subjects, documents" : role === "faculty" ? "subjects, queries, documents" : "subjects, notes, topics"}…`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:block">Ctrl + K</kbd>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowNotifications((v) => !v); setShowUserMenu(false); }}
                className="top-chip relative w-[2.6rem] justify-center text-muted-foreground transition hover:text-violet"
                title="Notifications"
              >
                <Bell className="h-[1.1rem] w-[1.1rem]" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-0.5 -top-1 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-violet px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 rounded-3xl border border-border bg-card p-4 shadow-2xl z-50 space-y-3"
                    style={{ boxShadow: "0 16px 48px -12px rgba(0,0,0,0.35), 0 0 0 1px var(--color-border)" }}
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <Bell className="h-3.5 w-3.5 text-violet" /> Notifications ({notifications.length})
                      </div>
                      {unreadCount > 0 && (
                        <button type="button" onClick={markNotificationsAsRead} className="text-[11px] font-medium text-violet hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={cn("rounded-xl border p-2.5 text-xs transition", n.read ? "border-border bg-muted/40 opacity-75" : "border-violet/20 bg-violet/5 font-medium")}>
                            <div className="flex justify-between font-bold text-foreground">
                              <span>{n.title}</span>
                              <span className="text-[10px] font-normal text-muted-foreground">{n.timestamp}</span>
                            </div>
                            <p className="mt-1 text-muted-foreground leading-snug">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-border pt-2 text-center">
                      <button type="button" onClick={() => setShowNotifications(false)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ThemeToggle />

            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowUserMenu((v) => !v); setShowNotifications(false); }}
                className="top-chip gap-2 py-0 pl-1.5 pr-3 transition hover:border-violet/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet/30 to-violet/10 text-[11px] font-bold text-violet ring-1 ring-violet/30">
                  {initials}
                </div>
                <span className="hidden text-sm font-semibold text-foreground sm:block">{displayName.split(" ")[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 rounded-2xl border border-border bg-card py-1.5 shadow-xl z-50"
                    style={{ boxShadow: "0 16px 48px -12px rgba(0,0,0,0.3), 0 0 0 1px var(--color-border)" }}
                  >
                    {[
                      { label: "Profile", to: `/${role}/profile` },
                    ].map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger transition hover:bg-accent"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── Page Content with instant navigation ── */}
        <main className="flex-1 px-8 pb-10 pt-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   PAGE HEADER
───────────────────────────────────────────────── */
const HERO_ART = [
  { src: "/assets/ui/users-hero.png", cls: "h-[10.5rem]" },
  { src: "/assets/ui/dash-hero.png", cls: "h-[10rem]" },
  { src: "/assets/ui/logs-hero.png", cls: "h-[9rem]" },
];
const HERO_NOTES = [
  ["Learn", "Grow", "Shine"],
  ["Manage", "Guide", "Empower"],
  ["Ask", "Learn", "Grow"],
  ["Plan", "Practice", "Succeed"],
  ["Track", "Improve", "Achieve"],
];
function strHash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function PageHeader({
  title,
  subtitle,
  action,
  note,
  art,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Handwritten annotation lines shown beside the mascot */
  note?: string[] | false;
  art?: "boy" | "boy-books" | "peek" | false;
}) {
  const h = strHash(title);
  const pick = art === "boy" ? HERO_ART[1] : art === "boy-books" ? HERO_ART[0] : art === "peek" ? HERO_ART[2] : HERO_ART[h % HERO_ART.length];
  const lines = note === false ? null : (note ?? HERO_NOTES[h % HERO_NOTES.length]);
  const words = title.trim().split(" ");
  const last = words.pop() as string;
  const head = words.join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="hero-banner relative mb-8 flex min-h-[9.5rem] items-center gap-4 pb-2 pt-3 lg:pr-[17rem]"
    >
      {/* soft lavender blob behind the mascot */}
      {art !== false && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 right-0 hidden h-[13rem] w-[26rem] rounded-[4rem] bg-gradient-to-br from-violet/20 via-violet/10 to-transparent blur-2xl lg:block"
        />
      )}

      <div className="relative z-10 min-w-0 flex-1">
        <h1 className="text-[2.1rem] font-extrabold leading-tight tracking-tight text-foreground">
          {head && <>{head} </>}
          <span className="gradient-word">{last}</span>
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[0.95rem] text-muted-foreground">{subtitle}</p>}
        {action && <div className="mt-4 flex flex-wrap items-center gap-3">{action}</div>}
      </div>

      {art !== false && (
        <div className="pointer-events-none absolute bottom-0 right-4 hidden select-none lg:block">
          <Sparkle className="-left-2 top-2 h-3 w-3 text-violet" delay={0.4} />
          <Sparkle className="right-1 top-0 h-3.5 w-3.5 text-violet" delay={1.1} />
          {lines && (
            <div className="hand-note absolute -left-[7.4rem] top-0 z-10 hidden w-28 2xl:block">
              {lines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          )}
          <img src={pick.src} alt="" draggable={false} className={cn("relative z-0 w-auto object-contain drop-shadow-[0_14px_20px_rgba(76,56,190,.28)]", pick.cls)} />
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────
   CARD — with variant support
───────────────────────────────────────────────── */
export function Card({
  title,
  children,
  action,
  className,
  variant = "default",
  icon: Icon,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "hero" | "glow" | "hero-gold";
  icon?: LucideIcon;
}) {
  const variantClasses = {
    default: "rounded-3xl border border-border bg-card p-6",
    hero: "card-hero rounded-3xl border p-6",
    glow: "card-glow rounded-3xl border border-border bg-card p-6",
    "hero-gold": "card-hero-gold rounded-3xl border p-6",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(variantClasses[variant], "transition-shadow duration-200 hover:shadow-[0_18px_44px_-18px_rgba(95,63,230,.35)]", className)}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <div className="flex items-center gap-3 text-lg font-extrabold text-foreground">
              {Icon && (
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet/12 text-violet">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              {title}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────
   STAT CARD — with count-up, trend, gradient number
───────────────────────────────────────────────── */
type StatColor = "violet" | "gold" | "success" | "danger" | "indigo" | "amber" | "green" | "teal" | "navy" | "red";

interface StatCardProps {
  label: string;
  value: string | number;
  caption?: string;
  color?: StatColor;
  icon?: LucideIcon;
  trend?: { pct: number; up: boolean };
  sparklineData?: number[];
}

const STAT_COLOR_MAP: Record<StatColor, { text: string; bg: string; glow: string; gradient: string }> = {
  violet: { text: "text-violet",      bg: "bg-violet/10",       glow: "glow-violet",   gradient: "text-gradient-violet" },
  gold:   { text: "text-gold",        bg: "bg-gold/10",         glow: "glow-gold",     gradient: "text-gradient-gold" },
  success:{ text: "text-success",     bg: "bg-success/10",      glow: "glow-success",  gradient: "text-gradient-success" },
  danger: { text: "text-danger",      bg: "bg-danger/10",       glow: "",              gradient: "" },
  indigo: { text: "text-violet",      bg: "bg-violet/10",       glow: "glow-violet",   gradient: "text-gradient-violet" },
  amber:  { text: "text-gold",        bg: "bg-gold/10",         glow: "glow-gold",     gradient: "text-gradient-gold" },
  green:  { text: "text-success",     bg: "bg-success/10",      glow: "glow-success",  gradient: "text-gradient-success" },
  teal:   { text: "text-teal-brand",  bg: "bg-teal-brand/10",   glow: "",              gradient: "" },
  navy:   { text: "text-foreground",  bg: "bg-muted",           glow: "",              gradient: "" },
  red:    { text: "text-danger",      bg: "bg-danger/10",       glow: "",              gradient: "" },
};

export function StatCard({ label, value, caption, color = "violet", icon: Icon, trend, sparklineData }: StatCardProps) {
  const colors = STAT_COLOR_MAP[color] ?? STAT_COLOR_MAP.violet;
  const numericValue = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10) || 0;
  const isNumeric = typeof value === "number" || /^\d+$/.test(String(value));
  const { count, containerRef } = useCountUp(numericValue, 700);

  return (
    <motion.div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_18px_44px_-18px_rgba(95,63,230,.4)]"
    >
      <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-60", colors.bg)} style={{ maskImage: "linear-gradient(to top, black, transparent)", WebkitMaskImage: "linear-gradient(to top, black, transparent)" }} />
      <div className="relative flex items-start gap-4">
        {Icon && (
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", colors.bg)}>
            <Icon className={cn("h-5 w-5", colors.text)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 text-[2.1rem] font-extrabold leading-none tabular-nums text-foreground">
            {isNumeric ? count.toLocaleString() : value}
          </div>
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="flex h-12 items-end gap-1">
            {sparklineData.map((v, i) => {
              const max = Math.max(...sparklineData);
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: "easeOut" }}
                  className={cn("w-1.5 rounded-full", colors.bg, "!opacity-100 brightness-95")}
                  style={{ minHeight: 4, background: "color-mix(in srgb, var(--color-violet) 35%, transparent)" }}
                />
              );
            })}
          </div>
        )}
      </div>
      {(trend || caption) && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                trend.up ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
              )}
            >
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.pct}% vs last week
            </span>
          )}
          {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────
   ACTION CARD — icon-in-glow-badge with color strip
───────────────────────────────────────────────── */
export function ActionCard({
  icon: Icon,
  title,
  description,
  color = "violet",
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: "indigo" | "amber" | "green" | "teal" | "violet" | "gold";
  onClick?: () => void;
}) {
  const colorMap: Record<string, { bg: string; text: string; strip: string; border: string; glow: string }> = {
    violet: { bg: "bg-violet/10", text: "text-violet", strip: "from-violet to-violet/60",   border: "hover:border-violet/30",   glow: "0 0 20px -3px oklch(0.62 0.22 293 / 40%)" },
    indigo: { bg: "bg-violet/10", text: "text-violet", strip: "from-violet to-violet/60",   border: "hover:border-violet/30",   glow: "0 0 20px -3px oklch(0.62 0.22 293 / 40%)" },
    gold:   { bg: "bg-gold/10",   text: "text-gold",   strip: "from-gold to-gold/60",       border: "hover:border-gold/30",     glow: "0 0 20px -3px oklch(0.82 0.18 84 / 40%)" },
    amber:  { bg: "bg-gold/10",   text: "text-gold",   strip: "from-gold to-gold/60",       border: "hover:border-gold/30",     glow: "0 0 20px -3px oklch(0.82 0.18 84 / 40%)" },
    green:  { bg: "bg-success/10",text: "text-success",strip: "from-success to-success/60", border: "hover:border-success/30",  glow: "0 0 20px -3px oklch(0.75 0.17 160 / 40%)" },
    teal:   { bg: "bg-teal-brand/10", text: "text-teal-brand", strip: "from-teal-brand to-teal-brand/60", border: "hover:border-teal-brand/30", glow: "" },
  };
  const c = colorMap[color] ?? colorMap.violet;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex w-full items-start gap-4 overflow-hidden rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--card-shadow)] transition-all duration-200 hover:shadow-lg",
        c.border
      )}
    >
      {/* Color accent top strip */}
      <div className={cn("absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300", c.strip)} />

      <motion.div
        whileHover={{ boxShadow: c.glow }}
        className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200", c.bg)}
      >
        <Icon className={cn("h-5 w-5", c.text)} />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-foreground">{title}</div>
          <ArrowRight className={cn("h-4 w-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100", c.text)} />
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────
   PILL — status badge
───────────────────────────────────────────────── */
type PillTone = "indigo" | "amber" | "green" | "teal" | "navy" | "slate" | "red" | "violet" | "gold" | "success" | "danger";

const PILL_STYLES: Record<PillTone, string> = {
  violet:  "bg-violet/10 text-violet",
  indigo:  "bg-violet/10 text-violet",
  gold:    "bg-gold/10 text-gold dark:text-gold",
  amber:   "bg-gold/10 text-gold dark:text-gold",
  success: "bg-success/10 text-success",
  green:   "bg-success/10 text-success",
  danger:  "bg-danger/10 text-danger",
  red:     "bg-danger/10 text-danger",
  teal:    "bg-teal-brand/10 text-teal-brand",
  navy:    "bg-foreground/10 text-foreground",
  slate:   "bg-muted text-muted-foreground",
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide", PILL_STYLES[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status: string): "success" | "gold" | "danger" | "slate" {
  switch (status) {
    case "approved":
    case "active":
      return "success";
    case "pending":
      return "gold";
    case "rejected":
    case "inactive":
      return "danger";
    default:
      return "slate";
  }
}

/* ─────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-3 font-semibold text-foreground">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   PRIMARY BUTTON — gradient fill + shimmer
───────────────────────────────────────────────── */
export function PrimaryButton({
  children,
  icon: Icon,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ boxShadow: "0 0 22px -4px oklch(0.62 0.22 293 / 55%)" }}
      whileTap={{ scale: 0.95 }}
      className="btn-shimmer btn-pill disabled:opacity-50"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────
   SKELETON CARD — moving shimmer
───────────────────────────────────────────────── */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
      <div className="skeleton h-5 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${60 + (i * 13) % 35}%` }} />
      ))}
    </div>
  );
}