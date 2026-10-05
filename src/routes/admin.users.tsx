import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  UserPlus,
  UserMinus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  GraduationCap,
  UserRound,
  ShieldCheck,
  ArrowRight,
  Mail,
  KeyRound,
  Trash2,
  Search,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, Card, PrimaryButton } from "@/components/app-shell";
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
      { name: "description", content: "Add or remove student and faculty accounts." },
    ],
  }),
  component: UserManagementPage,
});

type Mode = "add" | "remove";
type AccountRole = "Student" | "Faculty" | "Admin";

const BATCH_OPTIONS = [
  "2021-2025",
  "2022-2026",
  "2023-2027",
  "2024-2028",
  "2025-2029",
];

function UserManagementPage() {
  const { users, refreshUsers } = useAppData();
  const { user: adminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Mode>("add");

  // ─── Add User State ───
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("Student");
  const [departmentCode, setDepartmentCode] = useState<string>(
    getDepartmentCode(adminUser?.departmentId) || "CSE",
  );
  const [batch, setBatch] = useState("2023-2027");
  const [semester, setSemester] = useState("5");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<{
    name: string;
    email: string;
    role: string;
    department: string;
    password: string;
    emailSent?: boolean;
  } | null>(null);

  // ─── Remove User State ───
  const [removeQuery, setRemoveQuery] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState<string | null>(null);
  const [selectedUserToRemove, setSelectedUserToRemove] = useState<any | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Dynamic dummy password calculation
  const previewDummyPassword = generateDummyPassword(name);

  // ─── Handle Add User ───
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setCreatedSuccess(null);

    if (!name.trim() || !email.trim()) {
      setAddError("Please fill out name and email.");
      return;
    }

    setAddLoading(true);

    const roleForStore = role === "Student" ? "student" : role === "Faculty" ? "faculty" : "admin";
    const result = await createUserWithDefaultPassword(
      name.trim(),
      email.trim(),
      roleForStore as any,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
      departmentCode,
      role === "Student" ? batch : undefined,
      role === "Student" ? Number(semester) : undefined,
    );

    setAddLoading(false);

    if (!result.ok) {
      setAddError(result.error ?? "Failed to create user.");
      return;
    }

    // Immediately refresh records for Users Record view
    await refreshUsers();

    setCreatedSuccess({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      department: departmentCode,
      password: result.generatedPassword || previewDummyPassword,
      emailSent: result.emailSent ?? true,
    });

    // Reset fields
    setName("");
    setEmail("");
  };

  // ─── Handle Search for User to Remove ───
  const handleSearchRemove = (e: React.FormEvent) => {
    e.preventDefault();
    setRemoveError(null);
    setRemoveSuccess(null);
    setSelectedUserToRemove(null);

    const query = removeQuery.trim().toLowerCase();
    if (!query) {
      setRemoveError("Please enter a student or faculty email address or User ID.");
      return;
    }

    const found = users.find(
      (u) =>
        u.email.toLowerCase() === query ||
        u.id.toLowerCase() === query ||
        u.name.toLowerCase() === query,
    );

    if (!found) {
      setRemoveError(`No user found matching "${removeQuery}". Please check the email or ID.`);
      return;
    }

    setSelectedUserToRemove(found);
  };

  // ─── Handle Confirm Delete ───
  const handleConfirmDelete = async () => {
    if (!selectedUserToRemove) return;
    setRemoveLoading(true);
    setRemoveError(null);

    const identifier = selectedUserToRemove.email || selectedUserToRemove.id;
    const result = await deleteUserAccount(
      identifier,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
    );

    setRemoveLoading(false);
    setConfirmModalOpen(false);

    if (!result.ok) {
      setRemoveError(result.error ?? "Failed to remove user.");
      return;
    }

    await refreshUsers();
    setRemoveSuccess(
      `User ${selectedUserToRemove.name} (${selectedUserToRemove.email}) was successfully removed.`,
    );
    setSelectedUserToRemove(null);
    setRemoveQuery("");
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Add new students and faculty members or remove accounts. (To view directory, see Users Record)."
        action={
          <Link
            to="/admin/users/records"
            className="inline-flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-3.5 py-2 text-xs font-semibold text-violet transition hover:bg-violet/20"
          >
            <span>View Users Record</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {/* Tabs for Add vs Remove */}
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab("add");
            setAddError(null);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            activeTab === "add"
              ? "bg-violet text-white shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <UserPlus className="h-4 w-4" />
          Add Student / Faculty
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("remove");
            setRemoveError(null);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            activeTab === "remove"
              ? "bg-destructive text-destructive-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <UserMinus className="h-4 w-4" />
          Remove User
        </button>
      </div>

      {/* ─── ADD USER SECTION ─── */}
      {activeTab === "add" && (
        <div className="mx-auto max-w-2xl">
          {createdSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <div className="font-serif text-base font-bold text-foreground">
                    Account Created Successfully!
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    User account is created, pre-verified, and saved in database.
                  </p>

                  <div className="mt-3 rounded-xl border border-border bg-card p-3 font-mono text-xs space-y-1 text-foreground">
                    <div>
                      <span className="text-muted-foreground">Name:</span> {createdSuccess.name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span> {createdSuccess.email}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Role:</span> {createdSuccess.role} (
                      {createdSuccess.department})
                    </div>
                    <div className="pt-1 border-t border-border flex items-center justify-between">
                      <span>
                        <span className="text-muted-foreground">Auto-generated Password:</span>{" "}
                        <strong className="text-violet">{createdSuccess.password}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Mail className="h-4 w-4" />
                    <span>
                      Welcome email with login password sent directly to{" "}
                      <strong>{createdSuccess.email}</strong>.
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      to="/admin/users/records"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      View in Users Record →
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCreatedSuccess(null)}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Add Another User
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">
                  Enroll Student or Faculty
                </h3>
                <p className="text-xs text-muted-foreground">
                  Generates an auto dummy password (
                  <code className="text-violet font-semibold">namepassword123</code>) and sends a
                  welcome email.
                </p>
              </div>
              <div className="rounded-full bg-violet/10 p-2 text-violet">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            {addError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Name */}
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
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Institutional Email Address <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. 24cs045@charusat.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Student", "Faculty", "Admin"] as AccountRole[]).map((r) => {
                    const active = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition",
                          active
                            ? "border-violet bg-violet/10 text-violet"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r === "Student" && <GraduationCap className="h-3.5 w-3.5" />}
                        {r === "Faculty" && <UserRound className="h-3.5 w-3.5" />}
                        {r === "Admin" && <ShieldCheck className="h-3.5 w-3.5" />}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Department</label>
                <select
                  value={departmentCode}
                  onChange={(e) => setDepartmentCode(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch & Semester (if student) */}
              {role === "Student" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Batch Year
                    </label>
                    <select
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                    >
                      {BATCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Current Semester
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
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

              {/* Dynamic dummy password preview banner */}
              <div className="rounded-xl border border-violet/25 bg-violet/5 p-3.5 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="h-4 w-4 text-violet" />
                  <span>Auto-Generated Password:</span>
                </div>
                <code className="font-mono font-bold text-violet bg-background px-2 py-1 rounded border border-violet/20">
                  {previewDummyPassword}
                </code>
              </div>

              {/* Notice */}
              <p className="text-[11px] text-muted-foreground">
                ℹ When added, this account will immediately appear in the{" "}
                <Link to="/admin/users/records" className="text-violet underline">
                  Users Record
                </Link>{" "}
                section and receive a welcome email with their password.
              </p>

              <PrimaryButton type="submit" disabled={addLoading} className="w-full">
                {addLoading ? "Creating Account & Sending Email…" : "Add User & Dispatch Welcome Email"}
              </PrimaryButton>
            </form>
          </Card>
        </div>
      )}

      {/* ─── REMOVE USER SECTION ─── */}
      {activeTab === "remove" && (
        <div className="mx-auto max-w-2xl">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-destructive">
                  Remove Student or Faculty Account
                </h3>
                <p className="text-xs text-muted-foreground">
                  Search by institutional email or ID to permanently delete an account.
                </p>
              </div>
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <UserMinus className="h-5 w-5" />
              </div>
            </div>

            {removeSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                ✓ {removeSuccess}
              </div>
            )}

            {removeError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                ⚠ {removeError}
              </div>
            )}

            <form onSubmit={handleSearchRemove} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Enter User Email or ID
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="e.g. 24cs045@charusat.edu.in or student name"
                      value={removeQuery}
                      onChange={(e) => setRemoveQuery(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2.5 text-xs text-foreground outline-none focus:border-destructive"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent transition"
                  >
                    Look Up
                  </button>
                </div>
              </div>
            </form>

            {/* Selected User to Delete Card */}
            {selectedUserToRemove && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-destructive mb-2">
                  User Found
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-foreground">
                      {selectedUserToRemove.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedUserToRemove.email}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {selectedUserToRemove.role}
                      </span>
                      <span>·</span>
                      <span>{selectedUserToRemove.departmentId || "CSE"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground shadow hover:bg-destructive/90 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Account
                  </button>
                </div>
              </motion.div>
            )}
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModalOpen && selectedUserToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-destructive mb-3">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="font-serif text-lg font-bold text-foreground">
                  Confirm Account Removal
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to permanently remove{" "}
                <strong className="text-foreground">{selectedUserToRemove.name}</strong> (
                {selectedUserToRemove.email}) from the platform? This will delete their access and
                associated records.
              </p>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={removeLoading}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {removeLoading ? "Removing…" : "Yes, Permanently Remove"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
