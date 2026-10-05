import type { Role } from "./mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  departmentId?: string;
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

export const DEFAULT_PASSWORD = "password1234";
const DEFAULT_PASSWORD_HASH = hashPassword(DEFAULT_PASSWORD);

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

/** Admin creates an account directly in Supabase via backend API */
export async function createUserWithDefaultPassword(
  name: string,
  email: string,
  role: Role,
  actorEmail: string,
  actorToken?: string,
  departmentId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

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
        password: DEFAULT_PASSWORD,
        role: role.toLowerCase(),
        departmentId: departmentId || "CE",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || "Account creation failed in Supabase database." };
    }

    appendAudit(actorEmail, "CREATE_USER", `${cleanEmail} (${role})`);
    return { ok: true };
  } catch (err: any) {
    console.error("[AuthStore] Backend creation error:", err);
    return { ok: false, error: err.message || "Failed to reach backend API." };
  }
}

/** Self-registration directly in Supabase via backend API */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: Role,
  departmentId?: string,
): Promise<{ ok: boolean; error?: string }> {
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
        departmentId: departmentId || "CE",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || "Registration failed." };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[AuthStore] Backend registration error:", err);
    return { ok: false, error: err.message || "Failed to connect to backend server." };
  }
}

export function loginUser(
  role: Role,
  email: string,
  password: string,
): { ok: boolean; user?: MockUser; error?: string } {
  return { ok: false, error: "Please log in using your Supabase database account credentials." };
}

export function loginOrCreateGoogleUser(
  name: string,
  email: string,
  role: Role,
): { user: MockUser } {
  const cleanEmail = email.trim().toLowerCase();
  const user: MockUser = {
    id: `u_google_${Date.now()}`,
    name: name.trim() || cleanEmail.split("@")[0],
    email: cleanEmail,
    passwordHash: hashPassword(`google_oauth_${Date.now()}`),
    role,
    mustChangePassword: false,
  };
  return { user };
}
