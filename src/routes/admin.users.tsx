import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  UserPlus,
  UserMinus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  GraduationCap,
  UserRound,
  ShieldCheck,
  Mail,
  KeyRound,
  Trash2,
  Search,
  Sparkles,
  FileSpreadsheet,
  Download,
  RefreshCw,
  IdCard,
  FileUp,
  ClipboardPaste,
  Edit3,
  Calendar,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { Card, PageHeader } from "@/components/app-shell";
import { Users as UsersIcon, Zap, Landmark } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import {
  createUserWithDefaultPassword,
  deleteUserAccount,
  generateDummyPassword,
} from "@/lib/auth-store";
import { DEPARTMENTS, getDepartmentCode, getDepartmentLabel } from "@/lib/department-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management · AI Tutor Admin" },
      { name: "description", content: "Enroll students and faculty, bulk upload from Excel/CSV/PDF, or remove users." },
    ],
  }),
  component: UserManagementPage,
});

type Mode = "single" | "bulk" | "remove";
type AccountRole = "Student" | "Faculty" | "Admin";

// Dynamic Future-Proof Academic Years (e.g. 10 years in past to 25 years into future)
const CURRENT_YEAR = new Date().getFullYear();
const DYNAMIC_YEARS = Array.from({ length: 36 }, (_, i) => CURRENT_YEAR - 10 + i);

interface ParsedUserRow {
  id: string;
  name: string;
  email: string;
  studentId?: string;
  facultyId?: string;
  role: "Student" | "Faculty" | "Admin";
  startYear: number;
  endYear: number;
  batch: string;
  semester: number;
  status: "pending" | "loading" | "success" | "error";
  errorMsg?: string;
  generatedPassword?: string;
  validationErrors?: {
    name?: string;
    email?: string;
    id?: string;
  };
}

function validateRow(r: Partial<ParsedUserRow>): { name?: string; email?: string; id?: string } {
  const errs: { name?: string; email?: string; id?: string } = {};
  if (!r.name || r.name.trim().length < 2) {
    errs.name = "Full name required (min 2 chars)";
  }
  if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
    errs.email = "Valid institutional email required";
  }
  if (r.role === "Student" && (!r.studentId || r.studentId.trim().length < 2)) {
    errs.id = "Student ID / Roll number required";
  }
  return errs;
}

function UserManagementPage() {
  const { users, refreshUsers } = useAppData();
  const { user: adminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Mode>("single");

  // Admin Department Detection
  const adminDeptCode = getDepartmentCode(adminUser?.departmentId) || "CSE";
  const isSuperAdmin = String(adminUser?.role ?? "").toLowerCase() === "super_admin" || (!adminUser?.departmentId || adminUser?.departmentId === "all");

  // ─── Single User Enrollment State ───
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [role, setRole] = useState<AccountRole>("Student");
  const [departmentCode, setDepartmentCode] = useState<string>(adminDeptCode);
  const [startYear, setStartYear] = useState<number>(CURRENT_YEAR);
  const [endYear, setEndYear] = useState<number>(CURRENT_YEAR + 4);
  const [semester, setSemester] = useState("1");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<{
    name: string;
    email: string;
    studentId?: string;
    facultyId?: string;
    role: string;
    department: string;
    password: string;
    emailSent?: boolean;
  } | null>(null);

  // Formulated Batch string
  const batchString = `${startYear}-${endYear}`;

  // ─── Bulk Upload & Staging State ───
  const [bulkRows, setBulkRows] = useState<ParsedUserRow[]>([]);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [bulkGlobalLoading, setBulkGlobalLoading] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; enrolled: number; failed: number } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // ─── Remove User State ───
  const [removeQuery, setRemoveQuery] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState<string | null>(null);
  const [selectedUserToRemove, setSelectedUserToRemove] = useState<any | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Dynamic dummy password calculation
  const previewDummyPassword = generateDummyPassword(name);

  // Auto-detect studentId or facultyId when typing email
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (role === "Student" && (!studentId || studentId.length < 3)) {
      const match = val.trim().match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/);
      if (match) {
        setStudentId(match[1].toUpperCase());
        // Try to infer start year from roll number (e.g. 24 -> 2024)
        const yrPrefix = match[1].substring(0, 2);
        const parsedYear = 2000 + parseInt(yrPrefix, 10);
        if (parsedYear >= 2000 && parsedYear <= 2099) {
          setStartYear(parsedYear);
          setEndYear(parsedYear + 4);
        }
      }
    }
  };

  // Handle start year change
  const handleStartYearChange = (newStart: number) => {
    setStartYear(newStart);
    setEndYear(newStart + 4);
  };

  // ─── Handle Single Add User ───
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setCreatedSuccess(null);

    if (!name.trim() || !email.trim()) {
      setAddError("Please fill out full name and institutional email.");
      return;
    }

    setAddLoading(true);

    const targetDept = isSuperAdmin ? departmentCode : adminDeptCode;
    const roleForStore = role === "Student" ? "student" : role === "Faculty" ? "faculty" : "admin";
    const cleanStudentId = role === "Student" ? (studentId.trim().toUpperCase() || undefined) : undefined;
    const cleanFacultyId = role === "Faculty" ? (facultyId.trim().toUpperCase() || undefined) : undefined;

    const result = await createUserWithDefaultPassword(
      name.trim(),
      email.trim(),
      roleForStore as any,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
      targetDept,
      role === "Student" ? batchString : undefined,
      role === "Student" ? Number(semester) : undefined,
      cleanStudentId,
      cleanFacultyId,
    );

    setAddLoading(false);

    if (!result.ok) {
      setAddError(result.error ?? "Failed to create user.");
      return;
    }

    // Immediately refresh records
    await refreshUsers();

    setCreatedSuccess({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      studentId: result.studentId || cleanStudentId,
      facultyId: result.facultyId || cleanFacultyId,
      role,
      department: targetDept,
      password: result.generatedPassword || previewDummyPassword,
      emailSent: result.emailSent ?? true,
    });

    // Reset fields
    setName("");
    setEmail("");
    setStudentId("");
    setFacultyId("");
  };

  // ─── Extract Users from Raw Text (from PDF, Word, or Clipboard) ───
  const parseRawTextRoster = (raw: string) => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedUserRow[] = [];

    lines.forEach((line, idx) => {
      // Look for an email in the line
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const rowEmail = emailMatch ? emailMatch[1].toLowerCase() : "";

      // Extract remaining parts
      const parts = line.replace(rowEmail, "").trim().split(/[\t,;|]+/);
      let rowName = parts[0]?.trim() || "";
      if (!rowName || rowName.length < 2) {
        rowName = rowEmail ? rowEmail.split("@")[0].replace(/[0-9._]/g, " ").trim() : "";
      }

      const rollMatch = line.match(/\b([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})\b/i);
      const studentIdVal = rollMatch ? rollMatch[1].toUpperCase() : (rowEmail.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1]?.toUpperCase() || "");
      
      const yrPrefix = studentIdVal.substring(0, 2);
      const rowStart = yrPrefix && !isNaN(Number(yrPrefix)) ? 2000 + Number(yrPrefix) : CURRENT_YEAR;
      const rowEnd = rowStart + 4;

      const isFac = line.toLowerCase().includes("faculty") || line.toLowerCase().includes("prof") || line.toLowerCase().includes("dr.");
      const roleVal: "Student" | "Faculty" = isFac ? "Faculty" : "Student";

      const rowItem: ParsedUserRow = {
        id: `paste_${idx}_${Date.now()}`,
        name: rowName,
        email: rowEmail,
        studentId: roleVal === "Student" ? studentIdVal : undefined,
        facultyId: roleVal === "Faculty" ? parts[1]?.trim() || undefined : undefined,
        role: roleVal,
        startYear: rowStart,
        endYear: rowEnd,
        batch: `${rowStart}-${rowEnd}`,
        semester: 1,
        status: "pending",
      };
      rowItem.validationErrors = validateRow(rowItem);
      parsed.push(rowItem);
    });

    if (parsed.length > 0) {
      setBulkRows(parsed);
      setShowPasteBox(false);
      setPasteText("");
    }
  };

  // ─── Bulk Upload Handlers (Excel / CSV) ───
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFile(file);
    setBulkSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        const parsed: ParsedUserRow[] = rows.map((r, idx) => {
          const rawName = r["Full Name"] || r["Name"] || r["name"] || r["full_name"] || r["Student Name"] || r["Faculty Name"] || "";
          const rawEmail = r["Institutional Email"] || r["Email"] || r["email"] || r["email_address"] || "";
          const rawRole: AccountRole = String(r["Role"] || r["role"] || "Student").toLowerCase().includes("fac") ? "Faculty" : "Student";
          
          const rawStudentId = r["Student ID"] || r["Student Id"] || r["Roll Number"] || r["Roll No"] || r["roll_no"] || r["student_id"] || (rawEmail.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1] || "");
          const rawFacultyId = r["Faculty ID"] || r["Faculty Id"] || r["Employee ID"] || r["Emp ID"] || r["emp_id"] || r["faculty_id"] || "";
          
          const rawStart = parseInt(r["Start Year"] || r["start_year"] || r["Admission Year"] || String(CURRENT_YEAR), 10) || CURRENT_YEAR;
          const rawEnd = parseInt(r["End Year"] || r["end_year"] || r["Graduation Year"] || String(rawStart + 4), 10) || (rawStart + 4);
          const rawSem = parseInt(r["Current Semester"] || r["Semester"] || r["semester"] || "1", 10) || 1;

          const rowData: ParsedUserRow = {
            id: `row_${idx}_${Date.now()}`,
            name: String(rawName).trim(),
            email: String(rawEmail).trim().toLowerCase(),
            studentId: rawRole === "Student" ? String(rawStudentId || "").trim().toUpperCase() : undefined,
            facultyId: rawRole === "Faculty" ? String(rawFacultyId || "").trim().toUpperCase() : undefined,
            role: rawRole,
            startYear: rawStart,
            endYear: rawEnd,
            batch: `${rawStart}-${rawEnd}`,
            semester: rawSem,
            status: "pending" as const,
          };
          rowData.validationErrors = validateRow(rowData);
          return rowData;
        }).filter((r) => r.name || r.email || r.studentId || r.facultyId);

        setBulkRows(parsed);
      } catch (err: any) {
        console.error("Excel/CSV parse error:", err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Inline Spreadsheet Cell Editing Handler
  const handleUpdateBulkCell = (rowId: string, field: keyof ParsedUserRow, value: any) => {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (field === "startYear") {
          const sYr = Number(value) || CURRENT_YEAR;
          updated.startYear = sYr;
          updated.endYear = sYr + 4;
          updated.batch = `${sYr}-${sYr + 4}`;
        }
        if (field === "role") {
          if (value === "Faculty") {
            updated.facultyId = updated.facultyId || updated.studentId || "";
            updated.studentId = undefined;
          } else {
            updated.studentId = updated.studentId || updated.facultyId || "";
            updated.facultyId = undefined;
          }
        }
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
  };

  // Remove Row from Bulk Staging
  const handleDeleteBulkRow = (rowId: string) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Batch Correction: Apply Active Batch & Semester to All Rows
  const handleApplyDefaultBatchToAll = () => {
    setBulkRows((prev) =>
      prev.map((r) => {
        const updated = {
          ...r,
          startYear,
          endYear,
          batch: `${startYear}-${endYear}`,
          semester: Number(semester) || 1,
        };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
  };

  // Pre-fill a row into the Single Registration form for manual review/editing
  const handleLoadRowIntoForm = (row: ParsedUserRow) => {
    setName(row.name);
    setEmail(row.email);
    setRole(row.role);
    if (row.role === "Student") {
      setStudentId(row.studentId || "");
      setFacultyId("");
      setStartYear(row.startYear);
      setEndYear(row.endYear);
      setSemester(String(row.semester));
    } else if (row.role === "Faculty") {
      setFacultyId(row.facultyId || "");
      setStudentId("");
    }
    setActiveTab("single");
  };

  // Register single student/faculty from extracted list
  const handleRegisterSingleBulkRow = async (rowId: string) => {
    const targetRow = bulkRows.find((r) => r.id === rowId);
    if (!targetRow || targetRow.status === "loading" || targetRow.status === "success") return;

    // Validate before submitting
    const errs = validateRow(targetRow);
    if (Object.keys(errs).length > 0) {
      setBulkRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, validationErrors: errs } : r))
      );
      return;
    }

    setBulkRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, status: "loading", errorMsg: undefined } : r))
    );

    const targetDept = isSuperAdmin ? departmentCode : adminDeptCode;
    const res = await createUserWithDefaultPassword(
      targetRow.name,
      targetRow.email,
      targetRow.role.toLowerCase() as any,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
      targetDept,
      targetRow.role === "Student" ? targetRow.batch : undefined,
      targetRow.role === "Student" ? targetRow.semester : undefined,
      targetRow.studentId,
      targetRow.facultyId,
    );

    setBulkRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              status: res.ok ? "success" : "error",
              errorMsg: res.ok ? undefined : res.error,
              generatedPassword: res.generatedPassword,
            }
          : r
      )
    );

    if (res.ok) await refreshUsers();
  };

  // Register all valid students/faculty from extracted list
  const handleRegisterAllBulk = async () => {
    if (bulkRows.length === 0 || bulkGlobalLoading) return;

    // Revalidate all rows
    const revalidated = bulkRows.map((r) => ({ ...r, validationErrors: validateRow(r) }));
    setBulkRows(revalidated);

    const validRows = revalidated.filter(
      (r) => Object.keys(r.validationErrors || {}).length === 0 && r.status !== "success"
    );

    if (validRows.length === 0) {
      alert("No valid rows to register. Please resolve highlighted errors first.");
      return;
    }

    setBulkGlobalLoading(true);

    let enrolledCount = 0;
    let failedCount = 0;
    const targetDept = isSuperAdmin ? departmentCode : adminDeptCode;

    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i];
      if (row.status === "success") {
        enrolledCount++;
        continue;
      }

      if (row.validationErrors && Object.keys(row.validationErrors).length > 0) {
        continue;
      }

      setBulkRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "loading" } : r))
      );

      const res = await createUserWithDefaultPassword(
        row.name,
        row.email,
        row.role.toLowerCase() as any,
        adminUser?.email ?? "admin@charusat.edu.in",
        adminUser?.token,
        targetDept,
        row.role === "Student" ? row.batch : undefined,
        row.role === "Student" ? row.semester : undefined,
        row.studentId,
        row.facultyId,
      );

      if (res.ok) {
        enrolledCount++;
        setBulkRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "success", generatedPassword: res.generatedPassword } : r
          )
        );
      } else {
        failedCount++;
        setBulkRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", errorMsg: res.error } : r
          )
        );
      }
    }

    await refreshUsers();
    setBulkGlobalLoading(false);
    setBulkSummary({ total: bulkRows.length, enrolled: enrolledCount, failed: failedCount });
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const headers = ["Full Name", "Institutional Email", "Role", "Student ID", "Faculty ID", "Start Year", "End Year", "Current Semester"];
    const sampleRows = [
      ["Amit Thakkar", "24cs045@charusat.edu.in", "Student", "24CS045", "", "2024", "2028", "3"],
      ["Dr. Sanjay Garg", "sanjaygarg.cse@charusat.edu.in", "Faculty", "", "CSE-FAC-01", "", "", ""],
      ["Priya Sharma", "24cs046@charusat.edu.in", "Student", "24CS046", "", "2024", "2028", "3"],
      ["Rohan Mehta", "23cs012@charusat.edu.in", "Student", "23CS012", "", "2023", "2027", "5"],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...sampleRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enrollment_template_${adminDeptCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Department Scoped Users for Remove Tab ───
  const scopedDepartmentUsers = useMemo(() => {
    return users.filter((u) => {
      if (isSuperAdmin) return true;
      const uDept = (u.departmentId || "").toLowerCase();
      const target = adminDeptCode.toLowerCase();
      return uDept === target || uDept.includes(target) || target.includes(uDept);
    });
  }, [users, adminDeptCode, isSuperAdmin]);

  // ─── Handle Search for User to Remove ───
  const handleSearchRemove = (e: React.FormEvent) => {
    e.preventDefault();
    setRemoveError(null);
    setRemoveSuccess(null);
    setSelectedUserToRemove(null);

    const query = removeQuery.trim().toLowerCase();
    if (!query) {
      setRemoveError("Please enter a student or faculty email address, Student/Faculty ID, or Name.");
      return;
    }

    const found = scopedDepartmentUsers.find(
      (u) =>
        u.email.toLowerCase() === query ||
        u.id.toLowerCase() === query ||
        u.name.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query))
    );

    if (!found) {
      setRemoveError(`No user found matching "${removeQuery}" in ${getDepartmentLabel(adminDeptCode)} department.`);
      return;
    }

    setSelectedUserToRemove(found);
  };

  // ─── Handle Confirm Delete ───
  const handleConfirmDelete = async () => {
    if (!selectedUserToRemove) return;

    setRemoveLoading(true);
    setRemoveError(null);

    const res = await deleteUserAccount(
      selectedUserToRemove.id,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
    );

    setRemoveLoading(false);

    if (res.ok) {
      setRemoveSuccess(`Successfully deleted user ${selectedUserToRemove.name} (${selectedUserToRemove.email}).`);
      setSelectedUserToRemove(null);
      setConfirmModalOpen(false);
      setRemoveQuery("");
      await refreshUsers();
    } else {
      setRemoveError(res.error ?? "Failed to delete user.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle={`Create and manage user accounts for ${getDepartmentLabel(adminDeptCode)} (${adminDeptCode}).`}
        note={["Add", "Learners", "Build", "Opportunities!"]}
        art="boy-books"
      />

      {/* Tabs + totals */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="seg max-w-full overflow-x-auto">
          <button
            type="button"
            aria-pressed={activeTab === "single"}
            onClick={() => {
              setActiveTab("single");
              setAddError(null);
              setCreatedSuccess(null);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Single Enrollment
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "bulk"}
            onClick={() => {
              setActiveTab("bulk");
              setBulkSummary(null);
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Upload &amp; Extraction (Excel / CSV / PDF)
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "remove"}
            onClick={() => {
              setActiveTab("remove");
              setRemoveError(null);
              setRemoveSuccess(null);
              setSelectedUserToRemove(null);
            }}
          >
            <UserMinus className="h-4 w-4" />
            Remove User
          </button>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-2xs">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <UsersIcon className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-muted-foreground">Total Enrolled Accounts</div>
            <div className="text-2xl font-extrabold text-foreground tracking-tight">{users.length}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {users.filter((u) => u.role === "Faculty").length} faculty · {users.filter((u) => u.role === "Admin").length} admin · {users.filter((u) => u.role === "Student").length} student
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: SINGLE USER ENROLLMENT */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "single" && (
        <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
          {/* Left info panel */}
          <aside className="relative hidden rounded-xl border border-border bg-card p-6 shadow-2xs xl:block">
            <h3 className="text-base font-bold text-foreground">Account Provisioning</h3>
            <p className="mt-1 text-xs text-muted-foreground">Enroll students or faculty members with automated institutional credentials.</p>
            <ul className="mt-5 space-y-4">
              {[
                { i: Zap, t: "Instant Provisioning", d: "Account active immediately upon submission", c: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
                { i: UsersIcon, t: "Role-Based Permissions", d: "Student, Faculty or Department Admin", c: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
                { i: Landmark, t: "Departmental Scoping", d: "Locked to verified academic branch", c: "text-slate-700 bg-slate-100 dark:bg-slate-800" },
                { i: Mail, t: "Automated Welcome Dispatch", d: "Credentials emailed to institutional inbox", c: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
              ].map((f) => (
                <li key={f.t} className="flex items-start gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm", f.c)}>
                    <f.i className="h-4 w-4" />
                  </span>
                  <div className="leading-tight pt-0.5">
                    <div className="text-xs font-bold text-foreground">{f.t}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0">
          {createdSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <div className="font-serif text-base font-bold text-foreground">
                    Account Created Successfully!
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    User account is created, pre-verified, and active.
                  </p>

                  <div className="mt-3 rounded-xl border border-border bg-card p-3 font-mono text-xs space-y-1 text-foreground">
                    <div><span className="text-muted-foreground">Name:</span> {createdSuccess.name}</div>
                    <div><span className="text-muted-foreground">Email:</span> {createdSuccess.email}</div>
                    {createdSuccess.studentId && (
                      <div><span className="text-muted-foreground">Student ID:</span> <strong className="text-primary font-bold">{createdSuccess.studentId}</strong></div>
                    )}
                    {createdSuccess.facultyId && (
                      <div><span className="text-muted-foreground">Faculty ID:</span> <strong className="text-primary font-bold">{createdSuccess.facultyId}</strong></div>
                    )}
                    <div><span className="text-muted-foreground">Role:</span> {createdSuccess.role} ({createdSuccess.department})</div>
                    <div className="pt-1 border-t border-border flex items-center justify-between">
                      <span>
                        <span className="text-muted-foreground">Auto-generated Password:</span>{" "}
                        <strong className="text-primary font-bold">{createdSuccess.password}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Mail className="h-4 w-4" />
                    <span>
                      Welcome email with login password sent directly to <strong>{createdSuccess.email}</strong>.
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatedSuccess(null)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      Add Another User
                    </button>
                    <Link
                      to="/admin/user-logs"
                      className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-accent"
                    >
                      View in User Logs
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Enroll Student or Faculty</h3>
                <p className="text-xs text-muted-foreground">
                  Enrolls a user to <strong className="text-foreground">{getDepartmentLabel(adminDeptCode)}</strong>, generates dummy password (<code className="text-primary font-semibold">{previewDummyPassword}</code>), and dispatches welcome email.
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            {addError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amit Thakkar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Institutional Email Address */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Institutional Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. 24cs045@charusat.edu.in"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Role Selector */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Role</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["Student", "Faculty", "Admin"] as AccountRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition",
                        role === r
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-card text-muted-foreground hover:border-slate-400 hover:text-foreground",
                      )}
                    >
                      {r === "Student" && <GraduationCap className="h-4 w-4" />}
                      {r === "Faculty" && <UserRound className="h-4 w-4" />}
                      {r === "Admin" && <ShieldCheck className="h-4 w-4" />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student ID / Roll Number (For Students) */}
              {role === "Student" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Student ID / Roll Number</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Format: Year + Dept + Number (e.g. 24CS045)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 24CS045"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                    />
                    <IdCard className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Faculty ID / Employee Code (For Faculty) */}
              {role === "Faculty" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Faculty ID / Employee Code</span>
                    <span className="text-[10px] text-muted-foreground font-normal">e.g. CSE-FAC-01, EMP045, FAC102</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. CSE-FAC-01 or EMP045"
                      value={facultyId}
                      onChange={(e) => setFacultyId(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                    />
                    <IdCard className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Department (Auto-locked for Department Admin) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Department
                </label>
                {!isSuperAdmin ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs font-semibold text-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{getDepartmentLabel(adminDeptCode)} ({adminDeptCode})</span>
                    <span className="ml-auto text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border font-medium">
                      Locked to your department
                    </span>
                  </div>
                ) : (
                  <select
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.label} ({dept.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dynamic Calendar-like Start Year & End Year + Semester (For Students) */}
              {role === "Student" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>Starting Year & Ending Year</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setStartYear(CURRENT_YEAR);
                          setEndYear(CURRENT_YEAR + 4);
                        }}
                        className="text-[10px] text-primary hover:underline font-medium"
                      >
                        Reset to Current ({CURRENT_YEAR})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative w-1/2">
                        <select
                          value={startYear}
                          onChange={(e) => handleStartYearChange(Number(e.target.value))}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          {DYNAMIC_YEARS.map((y) => (
                            <option key={`start_${y}`} value={y}>
                              {y} {y === CURRENT_YEAR ? "(Current)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-muted-foreground font-bold">to</span>

                      <div className="relative w-1/2">
                        <select
                          value={endYear}
                          onChange={(e) => setEndYear(Number(e.target.value))}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          {DYNAMIC_YEARS.map((y) => (
                            <option key={`end_${y}`} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Batch: <strong className="text-primary font-mono">{batchString}</strong></span>
                      <span>Duration: <strong>{endYear - startYear} Years</strong></span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Current Semester
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={String(s)}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Password Preview */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span>Auto-Generated Password:</span>
                </div>
                <span className="font-mono font-bold text-primary">{previewDummyPassword}</span>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition active:scale-[0.99] disabled:opacity-50"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Creating Account & Dispatching Welcome Email...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Add User & Dispatch Welcome Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </Card>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK UPLOAD & EXTRACTION (EXCEL / CSV / PDF) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "bulk" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Bulk User Enrollment & File Extraction</h3>
                <p className="text-xs text-muted-foreground">
                  Upload Excel/CSV file or paste text extracted from PDF roster to automatically register students or faculty for <strong className="text-foreground">{getDepartmentLabel(adminDeptCode)}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
                >
                  <ClipboardPaste className="h-4 w-4 text-primary" />
                  <span>{showPasteBox ? "Hide Paste Box" : "Paste Roster Text"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition shadow-xs"
                >
                  <Download className="h-4 w-4 text-primary" />
                  <span>Download Sample Template</span>
                </button>
              </div>
            </div>

            {/* Paste Box for PDF / Text Extraction */}
            {showPasteBox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Paste Student / Faculty Roster Text (from PDF, Word, or Spreadsheet)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">One line per user</span>
                </div>
                <textarea
                  rows={4}
                  placeholder={`Example lines:\nAmit Thakkar\t24cs045@charusat.edu.in\t24CS045\nPriya Sharma\t24cs046@charusat.edu.in\t24CS046\nDr. Sanjay Garg\tsanjaygarg.cse@charusat.edu.in\tFaculty`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => parseRawTextRoster(pasteText)}
                    disabled={!pasteText.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    Extract & Load Staging List
                  </button>
                </div>
              </motion.div>
            )}

            {/* Upload Dropzone */}
            <div className="mt-6">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-8 text-center hover:border-primary transition cursor-pointer group">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 group-hover:scale-105 transition">
                  <FileUp className="h-5 w-5" />
                </div>
                <div className="mt-3 font-semibold text-sm text-foreground">
                  {bulkFile ? bulkFile.name : "Click to browse or drag & drop Excel / CSV file"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports .xlsx, .xls, and .csv formats (Columns: Full Name, Institutional Email, Role, Student ID, Faculty ID, Start Year, End Year, Semester)
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Bulk Summary Alert */}
            {bulkSummary && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>
                    Bulk Enrollment Finished: <strong>{bulkSummary.enrolled}</strong> of <strong>{bulkSummary.total}</strong> accounts successfully registered! {bulkSummary.failed > 0 && `(${bulkSummary.failed} failed)`}
                  </span>
                </div>
                <Link to="/admin/user-logs" className="underline font-bold">
                  View in User Logs
                </Link>
              </div>
            )}

            {/* Extracted Users Staging Table Preview & Interactive Spreadsheet Editor */}
            {bulkRows.length > 0 && (() => {
              const validRowCount = bulkRows.filter(
                (r) => (!r.validationErrors || Object.keys(r.validationErrors).length === 0) && r.status !== "error"
              ).length;
              const errorRowCount = bulkRows.filter(
                (r) => (r.validationErrors && Object.keys(r.validationErrors).length > 0) || r.status === "error"
              ).length;
              const displayedRows = showErrorsOnly
                ? bulkRows.filter((r) => (r.validationErrors && Object.keys(r.validationErrors).length > 0) || r.status === "error")
                : bulkRows;

              return (
                <div className="mt-6 space-y-4">
                  {/* Summary Bar & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-accent/20 p-3.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground">Staging Review:</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 font-bold font-mono text-muted-foreground border border-border">
                        {bulkRows.length} Total
                      </span>
                      <span className="rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 px-2 py-0.5 font-bold font-mono">
                        {validRowCount} Valid & Ready
                      </span>
                      {errorRowCount > 0 && (
                        <span className="rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 px-2 py-0.5 font-bold font-mono">
                          {errorRowCount} Require Attention
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {errorRowCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                          className={cn(
                            "rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition",
                            showErrorsOnly
                              ? "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {showErrorsOnly ? "Show All Rows" : `Show Errors Only (${errorRowCount})`}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyDefaultBatchToAll}
                        title={`Fill batch ${batchString} and Sem ${semester} for all rows`}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition"
                      >
                        Apply Batch ({batchString}, Sem {semester}) to All
                      </button>

                      <button
                        type="button"
                        onClick={() => setBulkRows([])}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                      >
                        Clear List
                      </button>

                      <button
                        type="button"
                        onClick={handleRegisterAllBulk}
                        disabled={bulkGlobalLoading || validRowCount === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover transition active:scale-95 disabled:opacity-50"
                      >
                        {bulkGlobalLoading ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Registering All...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Register All Valid ({validRowCount})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Spreadsheet Grid with Inline Cell Correction */}
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-3 w-10">#</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Full Name</th>
                          <th className="py-2.5 px-3 min-w-[210px]">Institutional Email</th>
                          <th className="py-2.5 px-3 min-w-[100px]">Role</th>
                          <th className="py-2.5 px-3 min-w-[130px]">ID / Roll No</th>
                          <th className="py-2.5 px-3 min-w-[140px]">Batch & Sem</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Status</th>
                          <th className="py-2.5 px-3 text-right min-w-[110px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {displayedRows.map((r, idx) => {
                          const hasNameErr = Boolean(r.validationErrors?.name);
                          const hasEmailErr = Boolean(r.validationErrors?.email);
                          const hasIdErr = Boolean(r.validationErrors?.id);

                          return (
                            <tr
                              key={r.id}
                              className={cn(
                                "transition",
                                r.status === "error" || hasNameErr || hasEmailErr || hasIdErr
                                  ? "bg-rose-50/20 dark:bg-rose-950/10"
                                  : "hover:bg-accent/25"
                              )}
                            >
                              <td className="py-2 px-3 text-muted-foreground font-mono">{idx + 1}</td>

                              {/* Editable Full Name */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={r.name}
                                  placeholder="Full name"
                                  onChange={(e) => handleUpdateBulkCell(r.id, "name", e.target.value)}
                                  className={cn(
                                    "w-full rounded px-2 py-1 text-xs border outline-none bg-background transition",
                                    hasNameErr
                                      ? "border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600"
                                      : "border-border/60 focus:border-primary"
                                  )}
                                />
                                {hasNameErr && (
                                  <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {r.validationErrors?.name}
                                  </div>
                                )}
                              </td>

                              {/* Editable Institutional Email */}
                              <td className="py-2 px-3">
                                <input
                                  type="email"
                                  value={r.email}
                                  placeholder="user@charusat.edu.in"
                                  onChange={(e) => handleUpdateBulkCell(r.id, "email", e.target.value)}
                                  className={cn(
                                    "w-full rounded px-2 py-1 text-xs border outline-none bg-background transition",
                                    hasEmailErr
                                      ? "border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600"
                                      : "border-border/60 focus:border-primary"
                                  )}
                                />
                                {hasEmailErr && (
                                  <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {r.validationErrors?.email}
                                  </div>
                                )}
                              </td>

                              {/* Editable Role */}
                              <td className="py-2 px-3">
                                <select
                                  value={r.role}
                                  onChange={(e) => handleUpdateBulkCell(r.id, "role", e.target.value as AccountRole)}
                                  className="w-full rounded px-2 py-1 text-xs border border-border/60 bg-background outline-none focus:border-primary font-medium"
                                >
                                  <option value="Student">Student</option>
                                  <option value="Faculty">Faculty</option>
                                </select>
                              </td>

                              {/* Editable Student / Faculty ID */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={r.role === "Student" ? (r.studentId || "") : (r.facultyId || "")}
                                  placeholder={r.role === "Student" ? "24CS045" : "CSE-FAC-01"}
                                  onChange={(e) =>
                                    handleUpdateBulkCell(
                                      r.id,
                                      r.role === "Student" ? "studentId" : "facultyId",
                                      e.target.value.toUpperCase()
                                    )
                                  }
                                  className={cn(
                                    "w-full rounded px-2 py-1 text-xs font-mono uppercase border outline-none bg-background transition",
                                    hasIdErr
                                      ? "border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-600"
                                      : "border-border/60 focus:border-primary"
                                  )}
                                />
                                {hasIdErr && (
                                  <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {r.validationErrors?.id}
                                  </div>
                                )}
                              </td>

                              {/* Editable Batch & Semester */}
                              <td className="py-2 px-3">
                                {r.role === "Student" ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      value={r.startYear}
                                      onChange={(e) => handleUpdateBulkCell(r.id, "startYear", e.target.value)}
                                      className="w-16 rounded px-1.5 py-1 text-xs font-mono border border-border/60 bg-background outline-none focus:border-primary"
                                    />
                                    <span className="text-muted-foreground text-[10px]">Sem</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={8}
                                      value={r.semester}
                                      onChange={(e) => handleUpdateBulkCell(r.id, "semester", Number(e.target.value))}
                                      className="w-10 rounded px-1 py-1 text-xs font-mono border border-border/60 bg-background outline-none focus:border-primary"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs italic">N/A (Faculty)</span>
                                )}
                              </td>

                              {/* Real-time Status Badge */}
                              <td className="py-2 px-3">
                                {r.status === "pending" && (
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                    Ready
                                  </span>
                                )}
                                {r.status === "loading" && (
                                  <span className="flex items-center gap-1 text-primary font-medium text-[10px]">
                                    <RefreshCw className="h-3 w-3 animate-spin" /> Enrolling...
                                  </span>
                                )}
                                {r.status === "success" && (
                                  <span className="rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                    ✓ Registered ({r.generatedPassword})
                                  </span>
                                )}
                                {r.status === "error" && (
                                  <span className="rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300 dark:border-rose-800 px-2 py-0.5 text-[10px] font-semibold" title={r.errorMsg}>
                                    ✕ {r.errorMsg || "Failed"}
                                  </span>
                                )}
                              </td>

                              {/* Row Action Buttons */}
                              <td className="py-2 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadRowIntoForm(r)}
                                    title="Load details into Single Form"
                                    className="rounded-lg border border-border bg-card p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBulkRow(r.id)}
                                    title="Remove row from staging"
                                    className="rounded-lg border border-border bg-card p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  {r.status !== "success" && (
                                    <button
                                      type="button"
                                      onClick={() => handleRegisterSingleBulkRow(r.id)}
                                      disabled={r.status === "loading" || bulkGlobalLoading || Boolean(r.validationErrors && Object.keys(r.validationErrors).length > 0)}
                                      className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition disabled:opacity-40"
                                    >
                                      Register
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: REMOVE USER */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "remove" && (
        <div className="mx-auto max-w-2xl">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Remove Student or Faculty</h3>
                <p className="text-xs text-muted-foreground">
                  Search and permanently delete accounts belonging to <strong className="text-foreground">{getDepartmentLabel(adminDeptCode)}</strong>.
                </p>
              </div>
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
            </div>

            {removeSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>{removeSuccess}</span>
              </div>
            )}

            {removeError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {removeError}
              </div>
            )}

            <form onSubmit={handleSearchRemove} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Search by Email, Student/Faculty ID, or Name
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 24cs045@charusat.edu.in, 24CS045, CSE-FAC-01, or Amit Thakkar"
                      value={removeQuery}
                      onChange={(e) => setRemoveQuery(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-destructive pl-9"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-card border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent transition shadow-xs"
                  >
                    Find User
                  </button>
                </div>
              </div>
            </form>

            {/* Found User Card */}
            {selectedUserToRemove && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-destructive">
                      Target Account Found
                    </div>
                    <div className="mt-1 font-serif text-base font-bold text-foreground">
                      {selectedUserToRemove.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{selectedUserToRemove.email}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {selectedUserToRemove.role}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {selectedUserToRemove.departmentId ? selectedUserToRemove.departmentId.toUpperCase() : adminDeptCode}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    className="rounded-xl bg-destructive px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-destructive/90 transition active:scale-95 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete User</span>
                  </button>
                </div>
              </motion.div>
            )}
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedUserToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 text-destructive">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-foreground">Confirm Account Deletion</h3>
            </div>

            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete the account for{" "}
              <strong className="text-foreground">{selectedUserToRemove.name}</strong> ({selectedUserToRemove.email})? This action is irreversible.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={removeLoading}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={removeLoading}
                className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-destructive/90 transition disabled:opacity-50"
              >
                {removeLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
