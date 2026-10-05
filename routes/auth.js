import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, AuditLog } from "../models/index.js";
import { authenticate, JWT_SECRET } from "../middleware/auth.js";

const router = express.Router();

function tokenFor(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || user.department_id || "CE",
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function publicUser(user) {
  return {
    id: user.id || user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId || user.department_id || "CE",
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !(await bcrypt.compare(password, user.passwordHash || user.password_hash)))
      return res.status(401).json({ error: "Invalid email or password." });

    if (
      role &&
      user.role !== role.toLowerCase() &&
      !(user.role === "super_admin" && role.toLowerCase() === "admin")
    ) {
      return res
        .status(403)
        .json({ error: `Account is registered as ${user.role}. Select correct tab.` });
    }

    const token = tokenFor(user);
    try {
      await AuditLog.create({
        actorId: user.id || user._id,
        action: "USER_LOGIN",
        details: { email: user.email, role: user.role, departmentId: user.departmentId, ip: req.ip },
      });
    } catch {}

    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error("[Auth Error] Login error:", error);
    return res.status(500).json({ error: error.message || "Internal server error during login." });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, departmentId } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: "Name, email, password, and role are required." });

    const roleLower = String(role).trim().toLowerCase();
    if (!["student", "faculty", "admin"].includes(roleLower))
      return res.status(400).json({ error: "Role must be student, faculty, or admin." });

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    const targetDept = departmentId ? String(departmentId).trim() : "CE";
    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: roleLower,
      departmentId: targetDept,
      mustChangePassword: false,
    });

    const token = tokenFor(user);
    try {
      await AuditLog.create({
        actorId: user.id || user._id,
        action: "USER_REGISTER",
        details: { email: user.email, role: user.role, departmentId: user.departmentId, ip: req.ip },
      });
    } catch {}

    return res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    console.error("[Auth Error] Register error:", error);
    return res.status(500).json({ error: error.message || "Internal server error during registration." });
  }
});

router.get("/me", authenticate, async (req, res) => res.json({ user: req.user }));

export default router;
