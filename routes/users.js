import express from "express";
import bcrypt from "bcryptjs";
import { User, AuditLog, Department } from "../models/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  isSuperAdmin,
  getDepartmentId,
  resolveDepartmentId,
} from "../middleware/department.js";

const router = express.Router();

function publicUser(user) {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.passwordHash;
  delete value.password_hash;
  return value;
}

// GET /api/users - List users from Supabase
router.get("/", authenticate, requireRole("admin", "faculty"), async (req, res) => {
  try {
    const isSuper = isSuperAdmin(req.user);
    const deptId = getDepartmentId(req.user);
    const filter = isSuper || !deptId ? {} : { departmentId: String(deptId) };
    
    const users = await User.find(filter).sort({ createdAt: -1 });
    const sanitized = users.map((u) => publicUser(u));
    return res.json(sanitized);
  } catch (error) {
    console.error("[Get Users Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch users." });
  }
});

// GET /api/users/:id - Lookup user
router.get("/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(publicUser(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user." });
  }
});

// POST /api/users - Create user directly in Supabase
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !role)
      return res.status(400).json({ error: "Name, email, and role are required." });

    const roleLower = String(role).toLowerCase().trim();
    if (!["student", "faculty", "admin"].includes(roleLower)) {
      return res.status(400).json({ error: "Role must be student, faculty, or admin." });
    }

    const requestedDeptRaw = req.body.departmentId ? String(req.body.departmentId).trim() : null;
    const callerDeptRaw = getDepartmentId(req.user);
    const targetDeptRaw = requestedDeptRaw || callerDeptRaw || "CE";

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing)
      return res.status(400).json({ error: "User with this email already exists." });

    const defaultPassword = password || "password1234";
    const passwordHash = await bcrypt.hash(defaultPassword, await bcrypt.genSalt(10));
    
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: roleLower,
      departmentId: targetDeptRaw,
      mustChangePassword: true,
    });

    try {
      await AuditLog.create({
        actorId: req.user.id || req.user._id,
        action: "CREATE_USER",
        details: {
          createdUserId: user.id || user._id,
          email: user.email,
          role: user.role,
          departmentId: targetDeptRaw,
        },
      });
    } catch {}

    return res.status(201).json(publicUser(user));
  } catch (error) {
    console.error("[User Error] Create error:", error);
    return res.status(500).json({ error: error.message || "Failed to create user in Supabase." });
  }
});

// PUT /api/users/:id - Update user
router.put("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.passwordHash;

    const user = await User.findByIdAndUpdate(req.params.id, updates);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(publicUser(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to update user." });
  }
});

// DELETE /api/users/:id - Delete user from Supabase
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ message: "User deleted successfully." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete user." });
  }
});

export default router;
