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

import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/** Admin creates an account directly in Supabase via backend API with direct Supabase fallback */
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
    if (response.ok) {
      appendAudit(actorEmail, "CREATE_USER", `${cleanEmail} (${role})`);
      return { ok: true };
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
      return { ok: false, error: "A user with this email already exists in Supabase." };
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, salt);

    const { error } = await supabase.from("users").insert({
      name: name.trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      role: role.toLowerCase(),
      department_id: departmentId || "CE",
      must_change_password: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[AuthStore] Supabase insert error:", error);
      return { ok: false, error: error.message || "Failed to create user in Supabase." };
    }

    appendAudit(actorEmail, "CREATE_USER", `${cleanEmail} (${role})`);
    return { ok: true };
  } catch (dbErr: any) {
    console.error("[AuthStore] Supabase user creation error:", dbErr);
    return { ok: false, error: dbErr.message || "Database connection error." };
  }
}

/** Self-registration directly in Supabase with backend API and direct Supabase fallback */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: Role,
  departmentId?: string,
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
        departmentId: departmentId || "CE",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.user) {
      return { ok: true, user: data.user };
    }
    if (!response.ok && data.error && !data.error.includes("Failed to fetch")) {
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

    const { data: created, error } = await supabase
      .from("users")
      .insert({
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: role.toLowerCase(),
        department_id: departmentId || "CE",
        must_change_password: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[AuthStore] Supabase direct registration error:", error);
      return { ok: false, error: error.message || "Registration failed in Supabase." };
    }

    return {
      ok: true,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        departmentId: created.department_id,
      },
    };
  } catch (dbErr: any) {
    console.error("[AuthStore] Direct registration error:", dbErr);
    return { ok: false, error: dbErr.message || "Database connection error." };
  }
}

/** Direct Supabase Login */
export async function directSupabaseLogin(
  role: Role,
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: any; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data: userRow, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      console.error("[AuthStore] Supabase query error:", error);
      return { ok: false, error: "Database query error: " + error.message };
    }

    if (!userRow) {
      return { ok: false, error: "Invalid email or password." };
    }

    // Verify bcrypt password
    const hash = userRow.password_hash || userRow.passwordHash;
    const isMatch = hash ? bcrypt.compareSync(password, hash) : false;

    if (!isMatch) {
      return { ok: false, error: "Invalid email or password." };
    }

    // Role check
    const userRole = userRow.role?.toLowerCase();
    const requestedRole = role.toLowerCase();
    if (userRole !== requestedRole && !(userRole === "super_admin" && requestedRole === "admin")) {
      return {
        ok: false,
        error: `Account is registered as ${userRole}. Please switch to the ${userRole} tab.`,
      };
    }

    return {
      ok: true,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        departmentId: userRow.department_id || userRow.departmentId || "CE",
        mustChangePassword: userRow.must_change_password ?? false,
      },
    };
  } catch (err: any) {
    console.error("[AuthStore] Direct login exception:", err);
    return { ok: false, error: err.message || "Failed to log in." };
  }
}

export function loginUser(
  role: Role,
  email: string,
  password: string,
): { ok: boolean; user?: MockUser; error?: string } {
  return { ok: false, error: "Please check your email and password." };
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
