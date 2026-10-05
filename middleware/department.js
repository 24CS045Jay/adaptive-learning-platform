import { Department } from "../models/Department.js";

/**
 * Build the filter for the authenticated user's department.
 * Department-scoped users, including HOD/admin accounts, are never allowed
 * to omit or override this predicate. Only super_admin is unrestricted.
 */
export function isSuperAdmin(user) {
  return String(user?.role || "").toLowerCase() === "super_admin";
}

export function getDepartmentId(user) {
  const dept = user?.departmentId ?? user?.department ?? null;
  if (dept && typeof dept === "object" && (dept.id || dept._id)) {
    return dept.id || dept._id;
  }
  return dept;
}

/**
 * Resolves a department code string (e.g. "CSE", "IT") or ID string
 * into a valid Department ID.
 */
export async function resolveDepartmentId(input) {
  if (!input) return null;
  const raw = String(input).trim();

  // Try finding by direct ID
  const deptById = await Department.findById(raw);
  if (deptById) return deptById.id || deptById._id;

  // Look up by department code (e.g. "CSE", "CE", "IT", "EC", "AIML")
  const deptByCode = await Department.findOne({ code: raw.toUpperCase() });
  if (deptByCode) return deptByCode.id || deptByCode._id;

  return raw;
}

export function departmentFilter(user, extra = {}) {
  if (isSuperAdmin(user)) return { ...extra };
  const rawDeptId = getDepartmentId(user);
  if (!rawDeptId) return null;

  return { ...extra, departmentId: String(rawDeptId) };
}

export function assertSameDepartment(user, targetDepartmentId) {
  if (isSuperAdmin(user)) return true;
  const ownDeptId = getDepartmentId(user);
  if (!ownDeptId || !targetDepartmentId) return false;

  return String(ownDeptId).toLowerCase() === String(targetDepartmentId).toLowerCase();
}

export function requireDepartmentScope(req, res, next) {
  if (isSuperAdmin(req.user) || getDepartmentId(req.user)) return next();
  return res
    .status(403)
    .json({ error: "A department-scoped account requires a department assignment." });
}

export function scopedResourceFilter(req, res, extra = {}) {
  const filter = departmentFilter(req.user, extra);
  if (!filter) {
    res
      .status(403)
      .json({ error: "A department-scoped account requires a department assignment." });
    return null;
  }
  return filter;
}
