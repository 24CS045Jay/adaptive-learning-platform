import express from "express";
import { Subject, User, AuditLog } from "../models/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  isSuperAdmin,
  getDepartmentId,
  scopedResourceFilter,
  resolveDepartmentId,
} from "../middleware/department.js";

const router = express.Router();

function resourceKey(id) {
  if (!id) return {};
  const str = String(id).trim();
  // Match MongoDB ObjectId (24 hex) or Supabase UUID (36 chars with hyphens) or any long hyphenated ID
  if (/^[0-9a-fA-F]{24}$/.test(str) || /^[0-9a-fA-F-]{32,}$/.test(str) || str.includes("-")) {
    return { _id: str };
  }
  return { code: str.toUpperCase() };
}

async function validateFaculty(facultyId, departmentId) {
  if (!facultyId) return true;
  try {
    const faculty = await User.findOne({ _id: facultyId });
    return Boolean(faculty);
  } catch {
    return true;
  }
}

// GET /api/subjects - list all active subjects with faculty details
router.get("/", authenticate, async (req, res) => {
  try {
    const subjects = await Subject.find({})
      .populate("facultyId", "name email role departmentId")
      .sort({ code: 1 });
    return res.json(subjects);
  } catch (error) {
    console.error("[Subject API] GET error:", error);
    return res.status(500).json({ error: "Failed to fetch subjects." });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const key = resourceKey(req.params.id);
    let subject = await Subject.findOne(key).populate(
      "facultyId",
      "name email role departmentId",
    );
    if (!subject && key._id) {
      subject = await Subject.findById(key._id);
    }
    if (!subject) return res.status(404).json({ error: "Subject not found." });
    return res.json(subject);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subject." });
  }
});

router.post("/", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { name, code, semester, facultyId, syllabus } = req.body;
    if (!name || !code || !semester)
      return res.status(400).json({ error: "Name, code, and semester are required." });

    const departmentId = req.body.departmentId || req.user?.departmentId || "CE";
    const normalizedCode = code.trim().toUpperCase();
    
    const existing = await Subject.findOne({ code: normalizedCode });
    if (existing) {
      return res
        .status(400)
        .json({ error: `Subject with code '${normalizedCode}' already exists.` });
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: normalizedCode,
      semester: Number(semester),
      departmentId,
      facultyId: facultyId || null,
      syllabus: syllabus || "",
      enrolledStudentIds: [],
    });

    await AuditLog.create({
      actorId: req.user.id || req.user._id,
      action: "CREATE_SUBJECT",
      details: { subjectId: subject.id || subject._id, code: subject.code, departmentId },
    }).catch(() => {});

    return res.status(201).json(subject);
  } catch (error) {
    console.error("[Subject Error] Create error:", error);
    return res.status(500).json({ error: "Failed to create subject." });
  }
});

router.put("/:id", authenticate, requireRole("admin", "super_admin", "faculty"), async (req, res) => {
  try {
    const key = resourceKey(req.params.id);
    let target = await Subject.findOne(key);
    if (!target && key._id) {
      target = await Subject.findById(key._id);
    }
    if (!target) return res.status(404).json({ error: "Subject not found." });

    const { name, code, semester, facultyId, syllabus, faculty } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (code) updates.code = code.trim().toUpperCase();
    if (semester != null) updates.semester = Number(semester);
    if (facultyId !== undefined) updates.facultyId = facultyId || null;
    if (syllabus !== undefined) updates.syllabus = syllabus;
    if (faculty !== undefined && !updates.facultyId) {
      // If faculty name string was supplied, resolve faculty ID if possible
      const facUser = await User.findOne({ name: faculty });
      if (facUser) updates.facultyId = facUser.id || facUser._id;
    }

    const updated = await Subject.findByIdAndUpdate(target.id || target._id, updates);
    return res.json(updated || { ...target, ...updates });
  } catch (error) {
    console.error("[Subject API] Update error:", error);
    return res.status(500).json({ error: "Failed to update subject." });
  }
});

async function updateEnrollment(req, res, operation) {
  const rawId = req.params.id;
  const key = resourceKey(rawId);
  let subject = await Subject.findOne(key);
  if (!subject && key._id) {
    subject = await Subject.findById(key._id);
  }
  if (!subject) return res.status(404).json({ error: "Subject not found." });

  const studentId = String(req.body.userId || req.user?._id || req.user?.id || "");
  const studentEmail = req.user?.email ? String(req.user.email).toLowerCase() : "";
  const studentRoll = req.user?.studentId ? String(req.user.studentId) : "";

  let currentList = [];
  if (Array.isArray(subject.enrolledStudentIds)) {
    currentList = [...subject.enrolledStudentIds];
  } else if (typeof subject.enrolledStudentIds === "string") {
    try {
      currentList = JSON.parse(subject.enrolledStudentIds);
    } catch {
      currentList = [];
    }
  }

  let updatedList = [...currentList];
  if (operation === "enroll") {
    if (studentId && !updatedList.includes(studentId)) updatedList.push(studentId);
    if (studentEmail && !updatedList.includes(studentEmail)) updatedList.push(studentEmail);
    if (studentRoll && !updatedList.includes(studentRoll)) updatedList.push(studentRoll);
  } else {
    updatedList = updatedList.filter(
      (id) => id !== studentId && id !== studentEmail && id !== studentRoll
    );
  }

  const updatedSubject = await Subject.findByIdAndUpdate(subject.id || subject._id, {
    enrolledStudentIds: updatedList,
  });

  return res.json(updatedSubject || { ...subject, enrolledStudentIds: updatedList });
}

router.post("/:id/enroll", authenticate, (req, res) =>
  updateEnrollment(req, res, "enroll").catch((err) => {
    console.error("[Subject API] Enroll error:", err);
    res.status(500).json({ error: "Failed to enroll student." });
  }),
);

router.post("/:id/unenroll", authenticate, (req, res) =>
  updateEnrollment(req, res, "unenroll").catch((err) => {
    console.error("[Subject API] Unenroll error:", err);
    res.status(500).json({ error: "Failed to unenroll student." });
  }),
);

router.delete("/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const key = resourceKey(req.params.id);
    let target = await Subject.findOne(key);
    if (!target && key._id) {
      target = await Subject.findById(key._id);
    }
    if (!target) return res.status(404).json({ error: "Subject not found." });
    
    await Subject.findByIdAndDelete(target.id || target._id);
    return res.json({ message: "Subject deleted successfully.", id: String(target.id || target._id) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete subject." });
  }
});

export default router;
