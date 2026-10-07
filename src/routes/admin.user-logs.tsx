import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  History,
  Search,
  Download,
  Filter,
  Users,
  GraduationCap,
  UserCheck,
  Building2,
  Calendar,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Copy,
  Clock,
  Shield,
  Layers,
} from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS, getDepartmentCode, getDepartmentLabel } from "@/lib/department-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/user-logs")({
  head: () => ({
    meta: [
      { title: "User Logs · AI Tutor Admin" },
      { name: "description", content: "Department-wise user registration and enrollment logs." },
    ],
  }),
  component: UserLogsPage,
});

export interface UserLogItem {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  facultyId?: string;
  role: "Student" | "Faculty" | "Admin";
  departmentId: string;
  batch?: string;
  semester?: number;
  yearLabel: string;
  registrationMethod: "Self-Registered (OTP)" | "Admin Enrolled" | "Google SSO";
  registeredAt: string;
  status: "Active" | "Pending Password Reset";
  actorEmail?: string;
}

// Map student email or batch to academic year
export function determineAcademicYear(email: string, role: string, explicitBatch?: string): { yearLabel: string; batch: string } {
  const r = role.toLowerCase();
  if (r === "faculty") {
    return { yearLabel: "Faculty Member", batch: "Faculty" };
  }
  if (r === "admin" || r === "super_admin") {
    return { yearLabel: "Administrator", batch: "Admin" };
  }

  // Check explicit batch if provided (e.g. "2024-2028")
  if (explicitBatch && explicitBatch.includes("-")) {
    const parts = explicitBatch.trim().split("-");
    const startYr = parseInt(parts[0], 10);
    if (!isNaN(startYr)) {
      const yearDiff = 2026 - startYr;
      let yrName = "1st Year";
      if (yearDiff === 1) yrName = "2nd Year";
      else if (yearDiff === 2) yrName = "3rd Year";
      else if (yearDiff >= 3) yrName = "4th Year";
      return { yearLabel: `${yrName} (${explicitBatch.trim()})`, batch: explicitBatch.trim() };
    }
  }

  // Parse student roll code from email (e.g. 25cs045@charusat.edu.in, 24ce012, 23it089, 22ec010)
  const prefixMatch = email.toLowerCase().match(/^([0-9]{2})/);
  if (prefixMatch) {
    const prefixYear = prefixMatch[1];
    const fullStart = 2000 + parseInt(prefixYear, 10);
    const fullEnd = fullStart + 4;
    const batchFormatted = `${fullStart}-${fullEnd}`;
    if (prefixYear === "25") return { yearLabel: `1st Year (${batchFormatted})`, batch: batchFormatted };
    if (prefixYear === "24") return { yearLabel: `2nd Year (${batchFormatted})`, batch: batchFormatted };
    if (prefixYear === "23") return { yearLabel: `3rd Year (${batchFormatted})`, batch: batchFormatted };
    if (prefixYear === "22") return { yearLabel: `4th Year (${batchFormatted})`, batch: batchFormatted };
    if (prefixYear === "21") return { yearLabel: `4th Year (${batchFormatted})`, batch: batchFormatted };
    return { yearLabel: `Batch ${batchFormatted}`, batch: batchFormatted };
  }

  // Default fallback for student
  return { yearLabel: "3rd Year (2023-2027)", batch: "2023-2027" };
}

const YEAR_FILTERS = [
  { id: "all", label: "All Years & Roles" },
  { id: "1st", label: "1st Year (2025-2029)" },
  { id: "2nd", label: "2nd Year (2024-2028)" },
  { id: "3rd", label: "3rd Year (2023-2027)" },
  { id: "4th", label: "4th Year (2022-2026)" },
  { id: "faculty", label: "Faculty Only" },
];

function UserLogsPage() {
  const { user: adminUser } = useAuth();
  const [logs, setLogs] = useState<UserLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYearFilter, setSelectedYearFilter] = useState("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportBanner, setExportBanner] = useState(false);

  const adminDeptCode = getDepartmentCode(adminUser?.departmentId) || "CSE";
  const isSuperAdmin = adminUser?.role === "admin" && (!adminUser?.departmentId || adminUser?.departmentId.toLowerCase() === "all");

  const [departmentFilter, setDepartmentFilter] = useState<string>(isSuperAdmin ? "all" : adminDeptCode);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Try fetching from Backend API
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminUser?.token) headers["Authorization"] = `Bearer ${adminUser.token}`;
      headers["x-user-role"] = adminUser?.role || "admin";
      if (adminDeptCode) headers["x-department-id"] = adminDeptCode;

      const res = await fetch(`${API_BASE}/api/users/logs`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: UserLogItem[] = data.map((u: any) => {
            const rawRole = String(u.role || "student").toLowerCase();
            const role: "Student" | "Faculty" | "Admin" =
              rawRole === "faculty" ? "Faculty" : rawRole === "admin" ? "Admin" : "Student";
            const yearInfo = determineAcademicYear(u.email, role, u.batch);
            const deducedStudentId = u.studentId || u.student_id || (role === "Student" ? u.email?.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1]?.toUpperCase() : undefined);
            const deducedFacultyId = u.facultyId || u.faculty_id || undefined;

            return {
              id: String(u.id || u._id || Math.random()),
              name: u.name || "User",
              email: u.email,
              studentId: deducedStudentId,
              facultyId: deducedFacultyId,
              role,
              departmentId: (u.departmentId || u.department_id || adminDeptCode || "CSE").toUpperCase(),
              batch: yearInfo.batch,
              semester: u.semester,
              yearLabel: yearInfo.yearLabel,
              registrationMethod: u.registrationMethod || (u.mustChangePassword ? "Admin Enrolled" : "Self-Registered (OTP)"),
              registeredAt: u.registeredAt || u.createdAt || u.created_at || new Date().toISOString(),
              status: u.mustChangePassword ? "Pending Password Reset" : "Active",
              actorEmail: u.actorEmail,
            };
          });

          setLogs(mapped);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[UserLogs] Backend fetch error, querying Supabase directly:", err);
    }

    // 2. Direct Supabase Query Fallback
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped: UserLogItem[] = data.map((u: any) => {
          const rawRole = String(u.role || "student").toLowerCase();
          const role: "Student" | "Faculty" | "Admin" =
            rawRole === "faculty" ? "Faculty" : rawRole === "admin" ? "Admin" : "Student";
          const yearInfo = determineAcademicYear(u.email, role, u.batch);
          const deducedStudentId = u.student_id || (role === "Student" ? u.email?.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1]?.toUpperCase() : undefined);
          const deducedFacultyId = u.faculty_id || undefined;

          return {
            id: String(u.id),
            name: u.name || "User",
            email: u.email,
            studentId: deducedStudentId,
            facultyId: deducedFacultyId,
            role,
            departmentId: (u.department_id || adminDeptCode || "CSE").toUpperCase(),
            batch: yearInfo.batch,
            yearLabel: yearInfo.yearLabel,
            registrationMethod: u.must_change_password ? "Admin Enrolled" : "Self-Registered (OTP)",
            registeredAt: u.created_at || new Date().toISOString(),
            status: u.must_change_password ? "Pending Password Reset" : "Active",
          };
        });

        setLogs(mapped);
      }
    } catch (sbErr) {
      console.error("[UserLogs] Supabase query error:", sbErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [adminUser]);

  // Department Scoped Logs
  const departmentLogs = useMemo(() => {
    return logs.filter((l) => {
      if (departmentFilter === "all") return true;
      const cleanFilter = departmentFilter.trim().toLowerCase();
      const cleanDept = (l.departmentId || "").trim().toLowerCase();
      return cleanDept === cleanFilter || cleanDept.includes(cleanFilter) || cleanFilter.includes(cleanDept);
    });
  }, [logs, departmentFilter]);

  // Filtered Logs by Search, Year, Role, and Method
  const filteredLogs = useMemo(() => {
    return departmentLogs.filter((l) => {
      // Academic Year Filter
      if (selectedYearFilter !== "all") {
        if (selectedYearFilter === "1st" && !l.yearLabel.includes("1st Year")) return false;
        if (selectedYearFilter === "2nd" && !l.yearLabel.includes("2nd Year")) return false;
        if (selectedYearFilter === "3rd" && !l.yearLabel.includes("3rd Year")) return false;
        if (selectedYearFilter === "4th" && !l.yearLabel.includes("4th Year")) return false;
        if (selectedYearFilter === "faculty" && l.role !== "Faculty") return false;
      }

      // Role Filter
      if (selectedRoleFilter !== "all" && l.role.toLowerCase() !== selectedRoleFilter.toLowerCase()) {
        return false;
      }

      // Registration Method Filter
      if (selectedMethodFilter !== "all") {
        if (selectedMethodFilter === "self" && !l.registrationMethod.includes("Self-Registered")) return false;
        if (selectedMethodFilter === "admin" && !l.registrationMethod.includes("Admin Enrolled")) return false;
      }

      // Keyword Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.departmentId.toLowerCase().includes(q) ||
          l.yearLabel.toLowerCase().includes(q) ||
          (l.batch && l.batch.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [departmentLogs, selectedYearFilter, selectedRoleFilter, selectedMethodFilter, searchTerm]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const total = departmentLogs.length;
    const students = departmentLogs.filter((l) => l.role === "Student");
    const faculty = departmentLogs.filter((l) => l.role === "Faculty");
    const y1 = departmentLogs.filter((l) => l.yearLabel.includes("1st Year")).length;
    const y2 = departmentLogs.filter((l) => l.yearLabel.includes("2nd Year")).length;
    const y3 = departmentLogs.filter((l) => l.yearLabel.includes("3rd Year")).length;
    const y4 = departmentLogs.filter((l) => l.yearLabel.includes("4th Year")).length;
    const selfReg = departmentLogs.filter((l) => l.registrationMethod.includes("Self-Registered")).length;
    const adminCreated = departmentLogs.filter((l) => l.registrationMethod.includes("Admin Enrolled")).length;

    return {
      total,
      studentCount: students.length,
      facultyCount: faculty.length,
      y1,
      y2,
      y3,
      y4,
      selfReg,
      adminCreated,
    };
  }, [departmentLogs]);

  // Copy Email to Clipboard
  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["User Name", "Email", "ID / Roll No", "Role", "Department", "Academic Year", "Batch", "Registration Method", "Registered Date & Time", "Account Status"];
    const rows = filteredLogs.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.email}"`,
      `"${l.studentId || l.facultyId || ""}"`,
      `"${l.role}"`,
      `"${l.departmentId}"`,
      `"${l.yearLabel}"`,
      `"${l.batch || ""}"`,
      `"${l.registrationMethod}"`,
      `"${new Date(l.registeredAt).toLocaleString()}"`,
      `"${l.status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `user_logs_${departmentFilter}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportBanner(true);
    setTimeout(() => setExportBanner(false), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="User Registration & Enrollment Logs"
        subtitle={`Audit logs of all student and faculty registrations in ${getDepartmentLabel(departmentFilter)} (${departmentLogs.length} total users).`}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="btn-pill-ghost disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-violet")} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-pill"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* CSV Export Success Banner */}
      {exportBanner && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>User logs successfully exported to CSV file.</span>
        </div>
      )}

      {/* Department Context & Scope Pill */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--card-shadow)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet/12 text-violet">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Department Scope</div>
            <div className="text-base font-bold text-foreground">
              {getDepartmentLabel(departmentFilter)} ({departmentFilter.toUpperCase()})
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Select Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label} ({d.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total Users", v: stats.total, cap: "Registered in Dept", Icon: Users, c: "violet", tone: "text-violet bg-violet/12", stroke: "#7c5cf0" },
          { label: "1st Year", v: stats.y1, cap: "Batch 2025-2026", Icon: GraduationCap, c: "emerald", tone: "text-emerald-500 bg-emerald-500/12", stroke: "#10b981" },
          { label: "2nd Year", v: stats.y2, cap: "Batch 2024-2025", Icon: GraduationCap, c: "sky", tone: "text-sky-500 bg-sky-500/12", stroke: "#0ea5e9" },
          { label: "3rd Year", v: stats.y3, cap: "Batch 2023-2024", Icon: GraduationCap, c: "indigo", tone: "text-indigo-500 bg-indigo-500/12", stroke: "#6366f1" },
          { label: "4th Year", v: stats.y4, cap: "Batch 2022-2023", Icon: GraduationCap, c: "amber", tone: "text-amber-500 bg-amber-500/14", stroke: "#f59e0b" },
          { label: "Faculty", v: stats.facultyCount, cap: "Staff & Instructors", Icon: Shield, c: "rose", tone: "text-rose-500 bg-rose-500/12", stroke: "#f43f5e" },
        ].map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-[var(--card-shadow)] transition hover:-translate-y-1">
            <div className="relative z-10 flex items-center gap-3">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", c.tone)}>
                <c.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</div>
                <div className="text-3xl font-extrabold">{c.v}</div>
              </div>
            </div>
            <div className="relative z-10 mt-1 text-[11px] text-muted-foreground">{c.cap}</div>
            <svg viewBox="0 0 120 30" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 w-full opacity-70" aria-hidden>
              <path d="M0 24C15 8 25 28 45 18S80 4 100 14s16 6 20 2V30H0z" fill={c.stroke} fillOpacity=".12" />
              <path d="M0 24C15 8 25 28 45 18S80 4 100 14s16 6 20 2" fill="none" stroke={c.stroke} strokeOpacity=".55" strokeWidth="1.6" />
            </svg>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--card-shadow)] space-y-4">
        {/* Search & Top Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] rounded-full border border-border bg-background px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, email, student ID, roll number, or batch..."
              className="w-full text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Role:</span>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Registration Method Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Method:</span>
              <select
                value={selectedMethodFilter}
                onChange={(e) => setSelectedMethodFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet"
              >
                <option value="all">All Methods</option>
                <option value="self">Self-Registered (OTP)</option>
                <option value="admin">Admin Enrolled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Academic Year Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filter by Academic Year:
          </span>
          {YEAR_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedYearFilter(f.id)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs",
                selectedYearFilter === f.id
                  ? "bg-violet text-white shadow-violet/20"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">ID / Roll No</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Academic Year / Batch</th>
                <th className="py-3 px-4">Registration Method</th>
                <th className="py-3 px-4">Registered On</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-violet" />
                      <span>Loading user registration logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History className="h-8 w-8 text-muted-foreground/50" />
                      <div className="font-semibold text-foreground">No user logs found</div>
                      <p className="text-xs text-muted-foreground">Try adjusting your year or search filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const initials = (l.name || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  const isSelf = l.registrationMethod.includes("Self-Registered");

                  return (
                    <tr key={l.id} className="hover:bg-accent/40 transition">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet/10 font-bold text-xs text-violet">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                              {l.name}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>{l.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(l.email, l.id)}
                                title="Copy Email"
                                className="text-muted-foreground hover:text-foreground transition ml-1 cursor-pointer"
                              >
                                {copiedId === l.id ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Student / Faculty ID */}
                      <td className="py-3.5 px-4">
                        {l.studentId || l.facultyId ? (
                          <span className="font-mono text-xs font-bold text-violet bg-violet/10 px-2 py-0.5 rounded-md border border-violet/20">
                            {l.studentId || l.facultyId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">-</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                            l.role === "Student"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : l.role === "Faculty"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          )}
                        >
                          {l.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground bg-muted/60 px-2 py-1 rounded-md">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {l.departmentId}
                        </span>
                      </td>

                      {/* Academic Year & Batch */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs text-foreground flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5 text-violet shrink-0" />
                            {l.yearLabel}
                          </span>
                          {l.batch && l.batch !== "Faculty" && l.batch !== "Admin" && (
                            <span className="text-[11px] text-muted-foreground">Batch: {l.batch}</span>
                          )}
                        </div>
                      </td>

                      {/* Registration Method */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                            isSelf
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          )}
                        >
                          {isSelf ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <UserCheck className="h-3 w-3 text-indigo-600" />
                          )}
                          {l.registrationMethod}
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(l.registeredAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          <span className="text-[10px] text-muted-foreground/70">
                            {new Date(l.registeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Pill tone={l.status === "Active" ? "green" : "amber"}>
                          {l.status}
                        </Pill>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of{" "}
            <span className="font-semibold text-foreground">{departmentLogs.length}</span> entries in {getDepartmentLabel(departmentFilter)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Synchronized with Supabase Auth & Audit Logs
          </div>
        </div>
      </Card>
    </div>
  );
}
