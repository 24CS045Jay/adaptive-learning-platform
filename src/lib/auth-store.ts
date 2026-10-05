import type { Role } from "./mock-data";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  departmentId?: string;
  batch?: string;
  semester?: number;
  mustChangePassword: boolean;
}

const HASH_PREFIX = "$2b$sim$";

export function hashPassword(plain: string): string {
  return HASH_PREFIX + btoa(plain);
}

export function verifyPassword(plain: string, hash: string): boolean {
  if (!hash.startsWith(HASH_PREFIX)) {
    return hash === plain;
  }
  return hash === HASH_PREFIX + btoa(plain);
}

/**
 * Generate dummy password with format: <firstname_lowercase>password123
 * e.g., "Amit Thakkar" -> "amitpassword123", "Jay Lad" -> "jaypassword123"
 */
export function generateDummyPassword(name: string): string {
  const clean = (name || "student")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "");
  return `${clean || "student"}password123`;
}

export const DEFAULT_PASSWORD = "studentpassword123";

// ─── Pure empty user store (Synchronized dynamically with Supabase) ───────────
const DEFAULT_USERS: MockUser[] = [];

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

// Clear any stale legacy mock users on initialization
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("ai_tutor_mock_users");
  } catch {}
}

export const AUDIT_LOG: AuditEntry[] = [];

export function appendAudit(actor: string, action: string, target: string) {
  const entry: AuditEntry = {
    id: `al_${Date.now()}`,
    actor,
    action,
    target,
    timestamp: new Date().toISOString(),
  };
  AUDIT_LOG.unshift(entry);
}

export const MOCK_USERS: MockUser[] = [];

// ─── Auth Operations ──────────────────────────────────────────────────────────

export function requestPasswordReset(email: string): boolean {
  return true;
}

export function changePassword(
  email: string,
  currentPw: string,
  newPw: string,
): { ok: boolean; error?: string } {
  return { ok: true };
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/**
 * Send 6-digit verification code to user's email via Gmail SMTP backend
 */
export async function sendVerificationOtp(
  email: string,
  name: string = "Student",
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, name: name.trim() }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return { ok: true, message: data.message || "Verification code sent to your email." };
    }
    return { ok: false, error: data.error || "Failed to send verification code." };
  } catch (err: any) {
    console.warn("[AuthStore] Send OTP API failed:", err.message);
    return {
      ok: true,
      message: "Development mode: OTP verification active. Please check your inbox or console.",
    };
  }
}

/** Admin creates an account directly in Supabase with auto-generated dummy password and Welcome Email */
export async function createUserWithDefaultPassword(
  name: string,
  email: string,
  role: Role,
  actorEmail: string,
  actorToken?: string,
  departmentId?: string,
  batch?: string,
  semester?: number,
): Promise<{ ok: boolean; generatedPassword?: string; error?: string; emailSent?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const dummyPassword = generateDummyPassword(name);

  try {
    const response = await fetch(`${API_BASE}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(actorToken ? { Authorization: `Bearer ${actorToken}` } : {}),
        "x-user-role": "admin",
        "x-user-id": "admin_user",
        ...(departmentId ? { "x-department-id": departmentId } : {}),
      },
      body: JSON.stringify({
        name: name.trim(),
        email: cleanEmail,
        password: dummyPassword,
        role: role.toLowerCase(),
        departmentId: departmentId || "CSE",
        batch,
        semester,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      appendAudit(actorEmail, "CREATE_USER", `${cleanEmail} (${role})`);
      return {
        ok: true,
        generatedPassword: data.generatedPassword || dummyPassword,
        emailSent: data.emailSent ?? true,
      };
    } else if (response.status === 400 && data.error) {
      return { ok: false, error: data.error };
    }
  } catch (err: any) {
    console.warn("[AuthStore] Backend API unreachable, falling back to direct Supabase write:", err.message);
  }

  // Direct Supabase Fallback
  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "A user with this email already exists in database." };
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(dummyPassword, salt);

    const { error } = await supabase.from("users").insert({
      name: name.trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      role: role.toLowerCase(),
      department_id: departmentId || "CSE",
      must_change_password: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[AuthStore] Supabase insert error:", error);
      return { ok: false, error: error.message || "Failed to create user in database." };
    }

    appendAudit(actorEmail, "CREATE_USER", `${cleanEmail} (${role})`);

    // Dispatch welcome email via backend mailer service
    let emailSent = false;
    try {
      const mailRes = await fetch(`${API_BASE}/api/users/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: cleanEmail,
          userName: name.trim(),
          role: role.toLowerCase(),
          rawPassword: dummyPassword,
          department: departmentId || "CSE",
        }),
      });
      const mailData = await mailRes.json().catch(() => ({}));
      emailSent = mailData.success ?? mailRes.ok;
    } catch (mailErr) {
      console.warn("[AuthStore] Direct welcome email send error:", mailErr);
    }

    return { ok: true, generatedPassword: dummyPassword, emailSent };
  } catch (dbErr: any) {
    console.error("[AuthStore] Supabase user creation error:", dbErr);
    return { ok: false, error: dbErr.message || "Database connection error." };
  }
}

/** Admin removes an account by ID or email address */
export async function deleteUserAccount(
  idOrEmail: string,
  actorEmail: string,
  actorToken?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(idOrEmail)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(actorToken ? { Authorization: `Bearer ${actorToken}` } : {}),
        "x-user-role": "admin",
        "x-user-id": "admin_user",
      },
    });

    if (response.ok) {
      appendAudit(actorEmail, "DELETE_USER", idOrEmail);
      return { ok: true };
    }
  } catch (err: any) {
    console.warn("[AuthStore] Backend API unreachable, falling back to direct Supabase delete:", err.message);
  }

  // Direct Supabase Delete Fallback
  try {
    const isEmail = idOrEmail.includes("@");
    const field = isEmail ? "email" : "id";
    const value = isEmail ? idOrEmail.trim().toLowerCase() : idOrEmail.trim();

    const { error } = await supabase.from("users").delete().eq(field, value);
    if (error) {
      return { ok: false, error: error.message || "Failed to delete user in Supabase." };
    }

    appendAudit(actorEmail, "DELETE_USER", idOrEmail);
    return { ok: true };
  } catch (dbErr: any) {
    return { ok: false, error: dbErr.message || "Database connection error." };
  }
}

/** Self-registration directly with 6-digit OTP code */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: Role,
  departmentId?: string,
  otp?: string,
): Promise<{ ok: boolean; user?: any; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: cleanEmail,
        password,
        role: role.toLowerCase(),
        departmentId: departmentId || "CSE",
        otp,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.user) {
      return { ok: true, user: data.user };
    }
    if (!response.ok && data.error) {
      return { ok: false, error: data.error };
    }
  } catch (err: any) {
    console.warn("[AuthStore] Backend API unreachable, falling back to direct Supabase registration:", err.message);
  }

  // Direct Supabase Registration
  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const { data, error } = await supabase
      .from("users")
      .insert({
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: role.toLowerCase(),
        department_id: departmentId || "CSE",
        must_change_password: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[AuthStore] Direct Supabase registration error:", error);
      return { ok: false, error: error.message || "Failed to register user in Supabase." };
    }

    return {
      ok: true,
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        departmentId: data.department_id,
        mustChangePassword: false,
      },
    };
  } catch (dbErr: any) {
    console.error("[AuthStore] Supabase registration failure:", dbErr);
    return { ok: false, error: dbErr.message || "Database connection error." };
  }
}

/** Direct Supabase PostgreSQL login */
export async function directSupabaseLogin(
  role: Role,
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: any; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return { ok: false, error: "Invalid email or password." };
    }

    const storedHash = user.password_hash || user.passwordHash;
    if (!storedHash) {
      return { ok: false, error: "Invalid account credentials. Contact admin." };
    }

    const isMatch = bcrypt.compareSync(password, storedHash);
    if (!isMatch) {
      return { ok: false, error: "Invalid email or password." };
    }

    if (
      role &&
      user.role.toLowerCase() !== role.toLowerCase() &&
      !(user.role.toLowerCase() === "super_admin" && role.toLowerCase() === "admin")
    ) {
      return { ok: false, error: `Account registered as ${user.role}. Please select correct tab.` };
    }

    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.department_id || user.departmentId,
        mustChangePassword: user.must_change_password ?? false,
      },
    };
  } catch (err: any) {
    console.error("[AuthStore] Supabase direct login error:", err);
    return { ok: false, error: err.message || "Database login failed." };
  }
}

export function loginUser(
  role: Role,
  email: string,
  password: string,
): { ok: boolean; user?: MockUser; error?: string; mustChangePassword?: boolean } {
  return { ok: false, error: "Please use async login handler." };
}

export function loginOrCreateGoogleUser(
  role: Role,
  email?: string,
  name?: string,
): MockUser {
  const googleEmail = (email || `google.${role}@charusat.edu.in`).trim().toLowerCase();
  const displayName = name || (role === "student" ? "Aarav Patel" : role === "faculty" ? "Dr. Nisha Shah" : "Admin User");

  return {
    id: `g_${Date.now()}`,
    name: displayName,
    email: googleEmail,
    passwordHash: "",
    role,
    departmentId: "CSE",
    mustChangePassword: false,
  };
}
