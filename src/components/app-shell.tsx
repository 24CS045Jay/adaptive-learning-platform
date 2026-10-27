import { useState, useEffect } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Bell,
  Search,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Menu,
  X,
  type LucideIcon,
  MessageCircle,
  ListChecks,
  CalendarClock,
  Home,
} from "lucide-react";
import type { Role } from "@/lib/mock-data";
import { currentUsers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useAppData } from "@/lib/app-data-context";
import { useCountUp } from "@/hooks/use-count-up";
import { Logo } from "@/components/brand";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  section?: string;
};

/* ─────────────────────────────────────────────────
   APP SHELL — Trustworthy, Production-Quality Academic Layout
───────────────────────────────────────────────── */
export function AppShell({ role, nav }: { role: Role; nav: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const { notifications, markNotificationsAsRead } = useAppData();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowNotifications(false);
    setShowUserMenu(false);
  }, [pathname]);

  const mockUser = currentUsers[role];
  const displayName = authUser?.name ?? mockUser.name;
  const displayEmail = authUser?.email ?? mockUser.email;
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  // Group nav items by section if defined, or group into logical default categories
  const groupedNav = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const roleBadgeLabel = role === "admin" ? "Institutional Admin" : role === "faculty" ? "Academic Faculty" : "Student Portal";

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* ── Mobile Drawer Backdrop ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Desktop & Mobile Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 lg:z-30",
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" showSubtitle={false} />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Pill indicator */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Context</span>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
            {roleBadgeLabel}
          </span>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-4">
          {Object.entries(groupedNav).map(([sectionTitle, items]) => (
            <div key={sectionTitle} className="space-y-1">
              {sectionTitle !== "General" && (
                <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  {sectionTitle}
                </div>
              )}
              {items.map((item) => {
                const active = pathname === item.to || (item.to !== `/${role}` && pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={cn(
                          "h-[1.15rem] w-[1.15rem] shrink-0 transition-colors",
                          active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer User Info & Sign out */}
        <div className="border-t border-slate-200 bg-slate-50/50 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg p-2">
            <Link
              to={`/${role}/profile`}
              className="flex min-w-0 flex-1 items-center gap-2.5 transition hover:opacity-80"
              title="View profile settings"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-xs text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold text-slate-900">{displayName}</div>
                <div className="truncate text-[11px] text-slate-500">{displayEmail}</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-red-600 transition"
              title="Sign out of account"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        {/* ── Top Header Bar ── */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 sm:px-6 lg:px-8 backdrop-blur-xs">
          {/* Mobile Hamburger & Logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo size="xs" showSubtitle={false} />
          </div>

          {/* Global Quick Search Input */}
          <div className="hidden flex-1 max-w-lg items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 sm:flex">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search ${role === "admin" ? "students, subjects, system logs" : role === "faculty" ? "course documents, student queries" : "enrolled subjects, concepts, lecture notes"}…`}
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
            />
            <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 md:inline-block">
              /
            </kbd>
          </div>

          {/* Right Header Utilities: Notifications & Profile Menu */}
          <div className="ml-auto flex items-center gap-2.5">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications((v) => !v);
                  setShowUserMenu(false);
                }}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900",
                  showNotifications && "bg-slate-100 border-slate-300"
                )}
                aria-label="View notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                      <div className="text-xs font-bold text-slate-800">
                        Notifications ({notifications.length})
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markNotificationsAsRead}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "rounded-lg border p-2.5 text-xs transition",
                              n.read
                                ? "border-slate-100 bg-slate-50/50 text-slate-500"
                                : "border-blue-100 bg-blue-50/40 text-slate-800 font-medium"
                            )}
                          >
                            <div className="flex justify-between font-semibold">
                              <span className="truncate pr-2">{n.title}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                                {n.timestamp}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600 text-[11px] leading-snug">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu((v) => !v);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 font-bold text-[10px] text-white">
                  {initials}
                </div>
                <span className="hidden sm:inline-block max-w-[100px] truncate">{displayName.split(" ")[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-50 text-xs"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <div className="font-semibold text-slate-900 truncate">{displayName}</div>
                      <div className="text-[10.5px] text-slate-500 truncate">{displayEmail}</div>
                    </div>
                    <Link
                      to={`/${role}/profile`}
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center px-3 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      Account Profile
                    </Link>
                    <Link
                      to="/change-password"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center px-3 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      Change Password
                    </Link>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-20 lg:pb-10">
          <Outlet />
        </main>

        {/* ── Mobile Bottom Navigation Bar (for Students on Mobile Devices) ── */}
        {role === "student" && (
          <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 lg:hidden">
            <Link
              to="/student"
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] font-semibold transition",
                pathname === "/student" ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/student/ask"
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] font-semibold transition",
                pathname.startsWith("/student/ask") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Ask Tutor</span>
            </Link>
            <Link
              to="/student/quizzes"
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] font-semibold transition",
                pathname.startsWith("/student/quizzes") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ListChecks className="h-4 w-4" />
              <span>Quizzes</span>
            </Link>
            <Link
              to="/student/planner"
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] font-semibold transition",
                pathname.startsWith("/student/planner") ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <CalendarClock className="h-4 w-4" />
              <span>Planner</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <Menu className="h-4 w-4" />
              <span>Menu</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   ACADEMIC PAGE HEADER — Clean, Trustworthy & Distraction-Free
───────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: string;
  note?: any;
  art?: any;
}) {
  return (
    <div className="mb-6 pb-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <div className="mb-1 text-xs font-semibold text-blue-700 tracking-wide">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   CARD — Restrained Academic Surface
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
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs transition-shadow duration-150 hover:shadow-xs",
        className
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {title && (
            <div className="flex items-center gap-2.5 text-base font-bold text-slate-900">
              {Icon && (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              {title}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   STAT CARD — Clear, Tabular, High-Trust Metrics
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

export function StatCard({ label, value, caption, icon: Icon, trend }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10) || 0;
  const isNumeric = typeof value === "number" || /^\d+$/.test(String(value));
  const { count, containerRef } = useCountUp(numericValue, 600);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-slate-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
        {isNumeric ? count.toLocaleString() : value}
      </div>

      {(trend || caption) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                trend.up ? "text-emerald-700" : "text-rose-700"
              )}
            >
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.pct}%
            </span>
          )}
          {caption && <span className="text-slate-500 text-[11px]">{caption}</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   ACTION CARD — Clean Interactive Tile
───────────────────────────────────────────────── */
export function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-blue-300 hover:bg-slate-50/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition">{title}</div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
        </div>
        <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────
   PILL — Semantic Status Badge
───────────────────────────────────────────────── */
type PillTone = "indigo" | "amber" | "green" | "teal" | "navy" | "slate" | "red" | "violet" | "gold" | "success" | "danger";

const PILL_STYLES: Record<PillTone, string> = {
  violet:  "bg-blue-50 text-blue-700 border-blue-200",
  indigo:  "bg-blue-50 text-blue-700 border-blue-200",
  gold:    "bg-amber-50 text-amber-800 border-amber-200",
  amber:   "bg-amber-50 text-amber-800 border-amber-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  green:   "bg-emerald-50 text-emerald-800 border-emerald-200",
  danger:  "bg-rose-50 text-rose-800 border-rose-200",
  red:     "bg-rose-50 text-rose-800 border-rose-200",
  teal:    "bg-sky-50 text-sky-800 border-sky-200",
  navy:    "bg-slate-100 text-slate-800 border-slate-200",
  slate:   "bg-slate-100 text-slate-700 border-slate-200",
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide", PILL_STYLES[tone])}>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-3 text-sm font-bold text-slate-900">{title}</div>
      <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   PRIMARY BUTTON — University Academic Blue
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────────────── */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-slate-100 animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
      ))}
    </div>
  );
}