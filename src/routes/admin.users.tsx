import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Users,
  UserRound,
  KeyRound,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader, Card, EmptyState, Pill } from "@/components/app-shell";
import { useAppData, type AppUser } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getDepartmentCode, getDepartmentLabel } from "@/lib/department-utils";

export const Route = createFileRoute("/admin/users")({
  component: UsersDirectoryPage,
});

const ROLE_SECTIONS: Array<{
  role: AppUser["role"];
  label: string;
  description: string;
  icon: typeof GraduationCap;
  tone: string;
  iconTone: string;
  badgeTone: "violet" | "gold" | "teal";
}> = [
  {
    role: "Student",
    label: "Students",
    description: "Learners enrolled in department courses",
    icon: GraduationCap,
    tone: "border-violet/20 bg-violet/5",
    iconTone: "bg-violet/10 text-violet",
    badgeTone: "violet",
  },
  {
    role: "Faculty",
    label: "Faculty",
    description: "Teaching staff & academic instructors",
    icon: UserRound,
    tone: "border-gold/25 bg-gold/5",
    iconTone: "bg-gold/10 text-gold",
    badgeTone: "gold",
  },
  {
    role: "Admin",
    label: "Admins",
    description: "Department administrators & HODs",
    icon: ShieldCheck,
    tone: "border-teal-brand/20 bg-teal-brand/5",
    iconTone: "bg-teal-brand/10 text-teal-brand",
    badgeTone: "teal",
  },
];

function UsersDirectoryPage() {
  const { users } = useAppData();
  const { user: adminUser } = useAuth();
  const [search, setSearch] = useState("");

  const adminDeptRaw = adminUser?.departmentId;
  const isSuperAdmin = String(adminUser?.role ?? "").toLowerCase() === "super_admin";
  const deptScopeLabel = isSuperAdmin
    ? "All Departments"
    : getDepartmentLabel(adminDeptRaw);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      const userDept = u.departmentId ? String(u.departmentId).toLowerCase() : "";
      const adminDept = adminDeptRaw ? String(adminDeptRaw).toLowerCase() : "";

      const sameDepartment =
        isSuperAdmin ||
        !adminDept ||
        !userDept ||
        userDept === adminDept;

      const matchesSearch =
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query);

      return sameDepartment && matchesSearch;
    });
  }, [adminDeptRaw, isSuperAdmin, search, users]);

  const counts = ROLE_SECTIONS.map(({ role }) => ({
    role,
    count: visibleUsers.filter((u) => u.role === role).length,
  }));

  return (
    <div>
      <PageHeader
        title="Users Directory"
        subtitle={`${visibleUsers.length} visible accounts · ${deptScopeLabel}`}
        action={
          <Link
            to="/admin/users/add"
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-violet/90"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Link>
        }
      />

      <Card className="mb-6 border-violet/15 bg-card/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet/10 text-violet">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-foreground">
                {isSuperAdmin ? "System User Directory" : `${getDepartmentCode(adminDeptRaw)} Department Directory`}
              </h2>
              <p className="text-sm text-muted-foreground">
                Structured view of all accounts scoped to your department. Use Add User page to enroll new members.
              </p>
            </div>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search users by name or email"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/15"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {counts.map(({ role, count }) => {
            const section = ROLE_SECTIONS.find((item) => item.role === role)!;
            return (
              <div
                key={role}
                className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-3"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="mt-0.5 text-2xl font-bold text-foreground">{count}</div>
                </div>
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", section.iconTone)}>
                  <section.icon className="h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Structured 3-column layout by Role */}
      <div className="grid gap-6 xl:grid-cols-3">
        {ROLE_SECTIONS.map(({ role, label, description, icon: Icon, tone, iconTone, badgeTone }) => {
          const sectionUsers = visibleUsers.filter((u) => u.role === role);
          return (
            <motion.section
              key={role}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("flex flex-col rounded-3xl border p-4 shadow-sm", tone)}
            >
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", iconTone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-bold text-foreground">{label}</h2>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Pill tone={badgeTone}>{sectionUsers.length}</Pill>
              </div>

              {sectionUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={`No ${label.toLowerCase()} found`}
                  description={
                    search
                      ? "Try adjusting your search query."
                      : "No user accounts in this category yet."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {sectionUsers.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm transition hover:border-violet/30"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                            iconTone,
                          )}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold text-foreground">
                              {u.name}
                            </span>
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                u.status === "active" ? "bg-success" : "bg-muted-foreground/40",
                              )}
                              title={u.status === "active" ? "Active Account" : "Inactive Account"}
                            />
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium text-foreground">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {getDepartmentCode(u.departmentId)}
                            </span>

                            {u.passwordStatus === "default" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                                <KeyRound className="h-3 w-3" />
                                Default Password
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Verified Password
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
