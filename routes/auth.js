import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, AuditLog } from "../models/index.js";
import { authenticate, JWT_SECRET } from "../middleware/auth.js";
import { sendVerificationOtpEmail } from "../lib/mailer.js";

const router = express.Router();

// In-memory OTP storage with 10-minute expiration
// Key: clean email, Value: { code: string, expiresAt: number, name: string }
const otpStore = new Map();

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

// ─── LOGIN ────────────────────────────────────────────────────────────────────
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

// ─── SEND VERIFICATION OTP ───────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required to send verification code." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Generate secure 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanEmail, {
      code: otpCode,
      expiresAt,
      name: (name || "Student").trim(),
    });

    console.log(`[OTP] Generated 6-digit code for ${cleanEmail}: ${otpCode}`);

    // Send email via Gmail SMTP
    const mailRes = await sendVerificationOtpEmail(cleanEmail, otpCode, name || "Student");

    return res.json({
      ok: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
      expiresInSeconds: 600,
      emailSent: mailRes.success,
    });
  } catch (error) {
    console.error("[Auth Error] Send OTP error:", error);
    return res.status(500).json({ error: error.message || "Failed to send verification email." });
  }
});

// ─── VERIFY OTP & REGISTER ────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, departmentId, otp } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ error: "Name, email, password, and role are required." });

    const roleLower = String(role).trim().toLowerCase();
    if (!["student", "faculty", "admin"].includes(roleLower))
      return res.status(400).json({ error: "Role must be student, faculty, or admin." });

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    // Verify 6-digit OTP code if provided (or check store)
    if (otp) {
      const stored = otpStore.get(cleanEmail);
      if (!stored) {
        return res.status(400).json({
          error: "Verification code expired or not requested. Please request a new code.",
        });
      }
      if (Date.now() > stored.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({
          error: "Verification code has expired. Please request a new code.",
        });
      }
      if (String(stored.code).trim() !== String(otp).trim()) {
        return res.status(400).json({
          error: "Invalid 6-digit verification code. Please check your email and try again.",
        });
      }
      // OTP verified successfully -> clear from memory
      otpStore.delete(cleanEmail);
    }

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
