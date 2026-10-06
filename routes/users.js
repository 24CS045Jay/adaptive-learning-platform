import express from "express";
import bcrypt from "bcryptjs";
import { User, AuditLog, Department } from "../models/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  isSuperAdmin,
  getDepartmentId,
  resolveDepartmentId,
} from "../middleware/department.js";
import { sendAdminWelcomeEmail } from "../lib/mailer.js";

const router = express.Router();

function publicUser(user) {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.passwordHash;
  delete value.password_hash;
  return value;
}

/**
 * Generate dummy password with format: <firstname_lowercase>password123
 * e.g. "Amit Thakkar" -> "amitpassword123", "Pooja" -> "poojapassword123"
 */
function generateDummyPassword(name) {
  const cleanFirst = (name || "student")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "");
  return `${cleanFirst || "user"}password123`;
}

// GET /api/users/logs - List user registration logs scoped by department
router.get("/logs", authenticate, requireRole("admin", "faculty"), async (req, res) => {
  try {
    const isSuper = isSuperAdmin(req.user);
    const callerDept = getDepartmentId(req.user);
    const reqDept = req.query.departmentId ? String(req.query.departmentId).trim() : null;
    const targetDept = isSuper && reqDept ? reqDept : (!isSuper && callerDept ? String(callerDept) : null);

    const filter = targetDept ? { departmentId: targetDept } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });

    // Fetch audit logs for registration/creation events if any
    let auditLogs = [];
    try {
      auditLogs = await AuditLog.find({
        action: { $in: ["USER_REGISTER", "CREATE_USER", "ADMIN_CREATE_USER", "BULK_REGISTER"] },
      }).sort({ createdAt: -1 });
    } catch (auditErr) {
      console.warn("[Users Logs] AuditLog fetch notice:", auditErr.message);
    }

    const auditMap = new Map();
    auditLogs.forEach((a) => {
      const email = a.details?.email || a.details?.targetEmail;
      if (email) auditMap.set(String(email).toLowerCase(), a);
    });

    const logs = users.map((u) => {
      const sanitized = publicUser(u);
      const audit = auditMap.get(String(u.email).toLowerCase());
      const isSelfRegistered = u.mustChangePassword === false && (!audit || audit.action === "USER_REGISTER");
      
      // Auto deduce studentId or facultyId
      const deducedStudentId = u.studentId || u.student_id || (u.role === "student" ? (u.email?.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1]?.toUpperCase()) : undefined);
      const deducedFacultyId = u.facultyId || u.faculty_id || undefined;

      return {
        ...sanitized,
        studentId: deducedStudentId,
        facultyId: deducedFacultyId,
        registrationMethod: isSelfRegistered ? "Self-Registered (OTP)" : "Admin Enrolled",
        registeredAt: u.createdAt || u.created_at || new Date().toISOString(),
        actorId: audit?.actorId || (isSelfRegistered ? (u.id || u._id) : "Admin"),
        batch: u.batch || audit?.details?.batch,
        semester: u.semester || audit?.details?.semester,
      };
    });

    return res.json(logs);
  } catch (error) {
    console.error("[Get User Logs Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch user logs." });
  }
});

// GET /api/users - List users from Supabase / DB
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

// POST /api/users/send-welcome-email - Send welcome email with credentials
router.post("/send-welcome-email", async (req, res) => {
  try {
    const { toEmail, userName, role, rawPassword, department } = req.body;
    if (!toEmail || !rawPassword) {
      return res.status(400).json({ error: "toEmail and rawPassword are required." });
    }

    const cleanEmail = toEmail.trim().toLowerCase();
    const mailResult = await sendAdminWelcomeEmail({
      toEmail: cleanEmail,
      userName: (userName || "User").trim(),
      role: (role || "student").toLowerCase(),
      rawPassword: String(rawPassword).trim(),
      department: department || "CSE",
    });

    return res.json({
      success: mailResult.success,
      messageId: mailResult.messageId,
      error: mailResult.error,
    });
  } catch (error) {
    console.error("[Mailer] Send welcome email endpoint error:", error);
    return res.status(500).json({ error: error.message || "Failed to send welcome email." });
  }
});

// POST /api/users/bulk-enroll - Bulk enroll students via spreadsheet list
router.post("/bulk-enroll", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { students, departmentId } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: "List of students is required." });
    }

    const callerDeptRaw = getDepartmentId(req.user);
    const targetDeptRaw = departmentId ? String(departmentId).trim() : callerDeptRaw || "CSE";

    const results = [];

    for (const s of students) {
      const name = (s.name || s.fullName || "").trim();
      const email = (s.email || "").trim().toLowerCase();
      const studentId = (s.studentId || s.enrollmentNo || s.rollNo || s.id || (role === "student" ? email.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1] : "") || "").trim().toUpperCase();
      const facultyId = (s.facultyId || s.employeeId || s.empId || (role === "faculty" ? s.id : "") || "").trim().toUpperCase();
      const batch = s.batch || (s.startYear && s.endYear ? `${s.startYear}-${s.endYear}` : "2024-2028");
      const semester = s.semester ? Number(s.semester) : undefined;
      const role = (s.role || "student").toLowerCase();

      if (!name || !email) {
        results.push({ email, name, success: false, error: "Name and email are required." });
        continue;
      }

      try {
        const existing = await User.findOne({ email });
        if (existing) {
          results.push({
            email,
            name,
            studentId,
            facultyId,
            success: false,
            error: "User already exists.",
            userId: existing.id || existing._id,
          });
          continue;
        }

        const dummyPassword = generateDummyPassword(name);
        const passwordHash = await bcrypt.hash(dummyPassword, await bcrypt.genSalt(10));

        const userDoc = {
          name,
          email,
          passwordHash,
          role,
          departmentId: targetDeptRaw,
          mustChangePassword: true,
        };
        if (studentId) userDoc.studentId = studentId;
        if (facultyId) userDoc.facultyId = facultyId;

        const createdUser = await User.create(userDoc);

        try {
          await AuditLog.create({
            actorId: req.user.id || req.user._id,
            action: "CREATE_USER",
            details: {
              createdUserId: createdUser.id || createdUser._id,
              name,
              email,
              role,
              studentId,
              facultyId,
              batch,
              semester,
              departmentId: targetDeptRaw,
              method: "bulk_admin_enrolled",
            },
          });
        } catch {}

        // Send Welcome email with auto-generated credentials
        const mailResult = await sendAdminWelcomeEmail({
          toEmail: email,
          userName: name,
          role,
          rawPassword: dummyPassword,
          department: targetDeptRaw,
        });

        results.push({
          email,
          name,
          studentId,
          facultyId,
          role,
          batch,
          semester,
          success: true,
          userId: createdUser.id || createdUser._id,
          generatedPassword: dummyPassword,
          emailSent: mailResult.success,
        });
      } catch (userErr) {
        results.push({ email, name, studentId, success: false, error: userErr.message });
      }
    }

    const successfulCount = results.filter((r) => r.success).length;
    return res.status(201).json({
      message: `Bulk enrollment completed. ${successfulCount} of ${students.length} accounts created.`,
      successfulCount,
      totalCount: students.length,
      results,
    });
  } catch (err) {
    console.error("[Bulk Enroll Error]:", err);
    return res.status(500).json({ error: err.message || "Failed to process bulk enrollment." });
  }
});

// POST /api/users - Admin adds student/faculty (Auto dummy password + Welcome Email)
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, role, departmentId, studentId, facultyId, batch, semester } = req.body;
    if (!name || !email || !role)
      return res.status(400).json({ error: "Name, email, and role are required." });

    const roleLower = String(role).toLowerCase().trim();
    if (!["student", "faculty", "admin"].includes(roleLower)) {
      return res.status(400).json({ error: "Role must be student, faculty, or admin." });
    }

    const requestedDeptRaw = departmentId ? String(departmentId).trim() : null;
    const callerDeptRaw = getDepartmentId(req.user);
    const targetDeptRaw = requestedDeptRaw || callerDeptRaw || "CSE";

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing)
      return res.status(400).json({ error: "User with this email already exists." });

    // Auto-generate dummy password with name: <firstname>password123
    const dummyPassword = generateDummyPassword(name);
    const passwordHash = await bcrypt.hash(dummyPassword, await bcrypt.genSalt(10));

    // Auto-extract studentId / facultyId
    const cleanStudentId = (studentId || (roleLower === "student" ? cleanEmail.match(/^([0-9]{2}[a-zA-Z]{2,4}[0-9]{2,4})/)?.[1] : undefined) || "").trim().toUpperCase() || undefined;
    const cleanFacultyId = (facultyId || "").trim().toUpperCase() || undefined;

    const userDoc = {
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: roleLower,
      departmentId: targetDeptRaw,
      mustChangePassword: true,
    };
    if (cleanStudentId) userDoc.studentId = cleanStudentId;
    if (cleanFacultyId) userDoc.facultyId = cleanFacultyId;

    const user = await User.create(userDoc);

    try {
      await AuditLog.create({
        actorId: req.user.id || req.user._id,
        action: "CREATE_USER",
        details: {
          createdUserId: user.id || user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: cleanStudentId,
          facultyId: cleanFacultyId,
          batch,
          semester,
          departmentId: targetDeptRaw,
        },
      });
    } catch {}

    // Send Welcome Email with auto-generated credentials directly to user's inbox
    const mailResult = await sendAdminWelcomeEmail({
      toEmail: cleanEmail,
      userName: name.trim(),
      role: roleLower,
      rawPassword: dummyPassword,
      department: targetDeptRaw,
    });

    return res.status(201).json({
      ...publicUser(user),
      studentId: cleanStudentId,
      facultyId: cleanFacultyId,
      generatedPassword: dummyPassword,
      emailSent: mailResult.success,
      message: `Account created successfully. Welcome email sent with password: ${dummyPassword}`,
    });
  } catch (error) {
    console.error("[User Error] Create error:", error);
    return res.status(500).json({ error: error.message || "Failed to create user in database." });
  }
});

// PUT /api/users/profile - Update current user profile (Student/Faculty/Admin)
router.put("/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { name, studentId, facultyId, departmentId } = req.body;

    const updates = {};
    if (name) updates.name = String(name).trim();
    if (studentId !== undefined) updates.studentId = String(studentId).trim().toUpperCase();
    if (facultyId !== undefined) updates.facultyId = String(facultyId).trim().toUpperCase();
    if (departmentId !== undefined) updates.departmentId = String(departmentId).trim().toUpperCase();

    const user = await User.findByIdAndUpdate(userId, updates);
    if (!user) return res.status(404).json({ error: "User not found." });

    try {
      await AuditLog.create({
        actorId: userId,
        action: "UPDATE_PROFILE",
        details: { name: user.name, role: user.role, studentId, facultyId, departmentId },
      });
    } catch {}

    return res.json({
      ...publicUser(user),
      studentId: user.studentId || user.student_id || studentId,
      facultyId: user.facultyId || user.faculty_id || facultyId,
      departmentId: user.departmentId || user.department_id || departmentId,
    });
  } catch (error) {
    console.error("[User Error] Profile update error:", error);
    return res.status(500).json({ error: error.message || "Failed to update profile." });
  }
});

// PUT /api/users/:id - Update user (Admin or user updating own profile)
router.put("/:id", authenticate, async (req, res) => {
  try {
    const callerId = String(req.user.id || req.user._id);
    const targetId = String(req.params.id);
    const isAdmin = String(req.user.role || "").toLowerCase() === "admin";

    if (!isAdmin && callerId !== targetId) {
      return res.status(403).json({ error: "Forbidden: You can only update your own account." });
    }

    const updates = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.passwordHash;
    delete updates.password_hash;
    if (!isAdmin) {
      delete updates.role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates);
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(publicUser(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to update user." });
  }
});

// DELETE /api/users/:idOrEmail - Remove user from database/Supabase
router.delete("/:idOrEmail", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const param = req.params.idOrEmail;
    let user = null;

    // Check if param is email or ID
    if (param.includes("@")) {
      user = await User.findOne({ email: param.trim().toLowerCase() });
      if (user) {
        await User.findByIdAndDelete(user.id || user._id);
      }
    } else {
      user = await User.findByIdAndDelete(param);
    }

    if (!user) return res.status(404).json({ error: "User not found or already removed." });

    try {
      await AuditLog.create({
        actorId: req.user.id || req.user._id,
        action: "DELETE_USER",
        details: {
          deletedUserId: user.id || user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch {}

    return res.json({ ok: true, message: `User ${user.email} removed successfully.` });
  } catch (error) {
    console.error("[User Error] Delete error:", error);
    return res.status(500).json({ error: "Failed to delete user." });
  }
});

export default router;
