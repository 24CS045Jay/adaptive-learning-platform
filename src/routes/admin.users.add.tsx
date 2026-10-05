import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, UserPlus, ArrowRight, ShieldCheck, Building2 } from "lucide-react";
import { useState } from "react";
import { PageHeader, Card, PrimaryButton } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { createUserWithDefaultPassword } from "@/lib/auth-store";
import { DEPARTMENTS, getDepartmentLabel, getDepartmentCode } from "@/lib/department-utils";

export const Route = createFileRoute("/admin/users/add")({
  component: AddUserPage,
});

type AccountRole = "Student" | "Faculty" | "Admin";

function AddUserPage() {
  const { refreshUsers } = useAppData();
  const { user: adminUser } = useAuth();
  const adminDeptRaw = adminUser?.departmentId;
  const isSuperAdmin = String(adminUser?.role ?? "").toLowerCase() === "super_admin";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("Student");
  const [departmentCode, setDepartmentCode] = useState<string>(
    getDepartmentCode(adminDeptRaw) || "CSE",
  );
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessEmail(null);
    setLoading(true);

    const departmentTarget = isSuperAdmin ? departmentCode : adminDeptRaw;
    if (!departmentTarget) {
      setError(
        "Your admin account is not assigned to a department. Ask a super admin to assign one.",
      );
      setLoading(false);
      return;
    }

    const roleForStore = role === "Student" ? "student" : role === "Faculty" ? "faculty" : "admin";
    const result = await createUserWithDefaultPassword(
      name.trim(),
      email.trim(),
      roleForStore,
      adminUser?.email ?? "admin@charusat.edu.in",
      adminUser?.token,
      departmentTarget,
    );

    if (!result.ok) {
      setError(result.error ?? "Account creation failed.");
      setLoading(false);
      return;
    }

    // Refetch reactive users list immediately
    await refreshUsers();
    setSuccessEmail(email.trim().toLowerCase());
    setName("");
    setEmail("");
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Add New User"
        subtitle="Create a department-scoped student, faculty member, or admin account."
        action={
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:border-violet/40 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users Management
          </Link>
        }
      />

      <div className="mx-auto max-w-2xl">
        {successEmail && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                <div>
                  <div className="font-serif text-base font-bold text-foreground">
                    Account Created Successfully!
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    <strong className="text-foreground">{successEmail}</strong> has been enrolled and a welcome email was sent to their inbox.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end border-t border-emerald-500/20 pt-3">
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Back to Users
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        <Card>
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-foreground">New Account Form</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Enter account details below to generate a department-scoped account.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
              Full Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Priya Sharma"
                required
                className="rounded-xl border border-border bg-background px-3.5 py-3 font-normal outline-none transition hover:border-violet/40 focus:border-violet focus:ring-2 focus:ring-violet/15"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
              Email Address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e.g. priya@charusat.edu.in"
                required
                className="rounded-xl border border-border bg-background px-3.5 py-3 font-normal outline-none transition hover:border-violet/40 focus:border-violet focus:ring-2 focus:ring-violet/15"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
                Account Role
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as AccountRole)}
                  className="rounded-xl border border-border bg-background px-3.5 py-3 font-normal outline-none transition hover:border-violet/40 focus:border-violet"
                >
                  <option value="Student">Student (Learner)</option>
                  <option value="Faculty">Faculty (Instructor)</option>
                  <option value="Admin">Admin (HOD / Dept Admin)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
                Department Scope
                {isSuperAdmin ? (
                  <select
                    value={departmentCode}
                    onChange={(event) => setDepartmentCode(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3.5 py-3 font-normal outline-none transition hover:border-violet/40 focus:border-violet"
                  >
                    {DEPARTMENTS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} · {item.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3.5 py-3 font-medium text-foreground">
                    <Building2 className="h-4 w-4 text-violet" />
                    <span>{getDepartmentLabel(adminDeptRaw)}</span>
                  </div>
                )}
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-violet" />
                <span>Default Password: <code className="font-mono text-foreground font-bold">password1234</code></span>
              </div>
              <PrimaryButton type="submit" icon={UserPlus} disabled={loading}>
                {loading ? "Creating Account…" : "Create Account"}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
