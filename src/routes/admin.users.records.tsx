import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GraduationCap,
  Search,
  ShieldCheck,
  Users,
  UserRound,
  Building2,
  Calendar,
  BookOpen,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader, Card, EmptyState, Pill } from "@/components/app-shell";
import { useAppData, type AppUser } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, getDepartmentCode, getDepartmentLabel } from "@/lib/department-utils";

export const Route = createFileRoute("/admin/users/records")({
  head: () => ({
    meta: [
      { title: "Users Record · AI Tutor Admin" },
      { name: "description", content: "View-only user directory and records." },
    ],
  }),
  component: UsersRecordsPage,
});

const ROLE_TABS = [
  { key: "all", label: "All Users", icon: Users },
  { key: "Student", label: "Students", icon: GraduationCap },
  { key: "Faculty", label: "Faculty", icon: UserRound },
  { key: "Admin", label: "Admins", icon: ShieldCheck },
] as const;

const BATCH_OPTIONS = [
  "All Batches",
  "2021-2025",
  "2022-2026",
  "2023-2027",
  "2024-2028",
  "2025-2029",
];

const SEMESTER_OPTIONS = [
  { value: "all", label: "All Semesters" },
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
  { value: "3", label: "Semester 3" },
  { value: "4", label: "Semester 4" },
  { value: "5", label: "Semester 5" },
  { value: "6", label: "Semester 6" },
  { value: "7", label: "Semester 7" },
  { value: "8", label: "Semester 8" },
];

function UsersRecordsPage() {
  const { users } = useAppData();
  const { user: adminUser } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<"all" | "Student" | "Faculty" | "Admin">("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<string>("All Batches");
  const [selectedSem, setSelectedSem] = useState<string>("all");

  const adminDeptRaw = adminUser?.departmentId;
  const isSuperAdmin = String(adminUser?.role ?? "").toLowerCase() === "super_admin";

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      // Role filter
      if (selectedRole !== "all" && u.role !== selectedRole) return false;

      // Department filter
      if (selectedDept !== "all") {
        const uDept = (u.departmentId || "").toUpperCase();
        if (uDept !== selectedDept.toUpperCase()) return false;
      }

      // Batch filter (if student has batch)
      if (selectedBatch !== "All Batches") {
        const anyUser = u as any;
        if (anyUser.batch && anyUser.batch !== selectedBatch) return false;
      }

      // Semester filter
      if (selectedSem !== "all") {
        const anyUser = u as any;
        if (anyUser.semester && String(anyUser.semester) !== selectedSem) return false;
      }

      // Search query filter
      if (query) {
        const matchName = u.name.toLowerCase().includes(query);
        const matchEmail = u.email.toLowerCase().includes(query);
        const matchId = (u.id || "").toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchId) return false;
      }

      return true;
    });
  }, [users, selectedRole, selectedDept, selectedBatch, selectedSem, search]);

  const studentCount = users.filter((u) => u.role === "Student").length;
  const facultyCount = users.filter((u) => u.role === "Faculty").length;
  const adminCount = users.filter((u) => u.role === "Admin").length;

  return (
    <div>
      <PageHeader
        title="Users Record"
        subtitle="Complete view-only academic roster for all batches, student cohorts, and faculty members."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Eye className="h-3.5 w-3.5 text-violet" />
              Read-Only View
            </span>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-hover transition"
            >
              Manage Users (Add / Remove) →
            </Link>
          </div>
        }
      />

      {/* Summary KPI stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Total Users</div>
          <div className="mt-1 font-serif text-2xl font-bold text-foreground">{users.length}</div>
        </div>
        <div className="rounded-2xl border border-violet/20 bg-violet/5 p-4 shadow-sm">
          <div className="text-xs font-medium text-violet">Enrolled Students</div>
          <div className="mt-1 font-serif text-2xl font-bold text-violet">{studentCount}</div>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 shadow-sm">
          <div className="text-xs font-medium text-gold">Faculty Members</div>
          <div className="mt-1 font-serif text-2xl font-bold text-gold">{facultyCount}</div>
        </div>
        <div className="rounded-2xl border border-teal-brand/20 bg-teal-brand/5 p-4 shadow-sm">
          <div className="text-xs font-medium text-teal-brand">Department Admins</div>
          <div className="mt-1 font-serif text-2xl font-bold text-teal-brand">{adminCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Role pills */}
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TABS.map((tab) => {
              const active = selectedRole === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedRole(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-violet text-white shadow-sm"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or ID..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-violet"
            />
          </div>
        </div>

        {/* Secondary filters: Dept, Batch, Semester */}
        <div className="mt-3 grid grid-cols-1 gap-2 pt-3 border-t border-border sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase">
              Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase">
              Batch Cohort
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet"
            >
              {BATCH_OPTIONS.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase">
              Semester
            </label>
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-violet"
            >
              {SEMESTER_OPTIONS.map((sem) => (
                <option key={sem.value} value={sem.value}>
                  {sem.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Users Data Table */}
      {filteredUsers.length === 0 ? (
        <Card className="py-12">
          <EmptyState
            icon={Users}
            title="No user records match your criteria"
            description="Try clearing search keywords or selecting different department and batch filters."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Batch / Sem</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const anyU = u as any;
                  const isStudent = u.role === "Student";
                  const isFaculty = u.role === "Faculty";

                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition">
                      {/* Name and Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs",
                              isStudent
                                ? "bg-violet/15 text-violet"
                                : isFaculty
                                  ? "bg-gold/15 text-gold"
                                  : "bg-teal-brand/15 text-teal-brand",
                            )}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{u.name}</div>
                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <Pill
                          tone={
                            isStudent
                              ? "violet"
                              : isFaculty
                                ? "gold"
                                : "teal"
                          }
                        >
                          {u.role}
                        </Pill>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-foreground">
                          {getDepartmentCode(u.departmentId) || u.departmentId || "CSE"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {getDepartmentLabel(u.departmentId)}
                        </span>
                      </td>

                      {/* Batch / Semester */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {isStudent ? (
                          <span>
                            {anyU.batch || "2023-2027"}
                            {anyU.semester ? ` · Sem ${anyU.semester}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {u.status || "Active"}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {u.joinedAt
                          ? new Date(u.joinedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Recently"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border bg-muted/10 px-5 py-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> total records
            </span>
            <span>All records synchronized with database</span>
          </div>
        </Card>
      )}
    </div>
  );
}
