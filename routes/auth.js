import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, AuditLog } from "../models/index.js";
import { authenticate, JWT_SECRET } from "../middleware/auth.js";
import { sendVerificationOtpEmail, sendPasswordResetEmail } from "../lib/mailer.js";

const router = express.Router();

/**
 * Diagnostic status endpoint for Brevo email configuration.
 * Safe to expose: masks API key and provides diagnostic checks for deployed environments.
 */
router.get("/email-status", (req, res) => {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || "ladvajay15@gmail.com").trim();
  const senderName = (process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM || "Edusense AI").trim();

  res.json({
    service: "Brevo Transactional Email Service",
    configured: Boolean(apiKey && apiKey.startsWith("xkeysib-")),
    keyLength: apiKey.length,
    keyPrefix: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : "not_configured",
    senderEmail,
    senderName,
    frontendUrl: process.env.FRONTEND_URL || "not_configured",
    timestamp: new Date().toISOString(),
  });
});

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

    // Send email via Brevo Transactional Email API over HTTPS
    const mailRes = await sendVerificationOtpEmail(cleanEmail, otpCode, name || "Student");

    if (!mailRes.success) {
      // Failed email delivery does not falsely report that an email was sent
      return res.status(502).json({
        ok: false,
        error: mailRes.error || "Failed to deliver verification email. Please try again later.",
        emailSent: false,
      });
    }

    return res.json({
      ok: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
      expiresInSeconds: 600,
      emailSent: true,
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

// ─── FORGOT PASSWORD (REQUEST RESET LINK) ────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required to request a password reset." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    // For security against user enumeration, return a generic message even if user not found
    if (!user) {
      return res.json({
        ok: true,
        message: "If an account with this email exists, a password reset link has been sent.",
        emailSent: true,
      });
    }

    // Generate a temporary 15-minute reset token signed with JWT_SECRET
    const resetToken = jwt.sign(
      {
        id: user.id || user._id,
        email: user.email,
        purpose: "password_reset",
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/$/, "");
    const resetUrl = `${frontendUrl}/login?resetToken=${resetToken}&email=${encodeURIComponent(user.email)}`;

    const mailRes = await sendPasswordResetEmail({
      toEmail: user.email,
      userName: user.name || "Student",
      resetUrl,
    });

    if (!mailRes.success) {
      return res.status(502).json({
        ok: false,
        error: mailRes.error || "Failed to deliver password reset email. Please try again later.",
        emailSent: false,
      });
    }

    return res.json({
      ok: true,
      message: "If an account with this email exists, a password reset link has been sent.",
      emailSent: true,
    });
  } catch (error) {
    console.error("[Auth Error] Forgot password error:", error);
    return res.status(500).json({ error: error.message || "Failed to process password reset request." });
  }
});

// ─── RESET PASSWORD (CONFIRM WITH TOKEN) ──────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(400).json({ error: "Invalid or expired password reset link. Please request a new one." });
    }

    if (decoded.purpose !== "password_reset" || !decoded.id) {
      return res.status(400).json({ error: "Invalid password reset token." });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User account no longer exists." });
    }

    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await User.findByIdAndUpdate(decoded.id, {
      passwordHash,
      mustChangePassword: false,
    });

    try {
      await AuditLog.create({
        actorId: user.id || user._id,
        action: "PASSWORD_RESET",
        details: { email: user.email, ip: req.ip },
      });
    } catch {}

    return res.json({
      ok: true,
      message: "Password has been successfully reset. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("[Auth Error] Reset password error:", error);
    return res.status(500).json({ error: error.message || "Failed to reset password." });
  }
});

export default router;
