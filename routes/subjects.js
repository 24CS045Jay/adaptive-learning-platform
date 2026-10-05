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
  return /^[0-9a-fA-F]{24}$/.test(id) ? { _id: id } : { code: id.toUpperCase() };
}

async function validateFaculty(facultyId, departmentId) {
  if (!facultyId) return true;
  const faculty = await User.findOne({ _id: facultyId, role: "faculty", departmentId }).select(
    "_id",
  );
  return Boolean(faculty);
}

// GET /api/subjects - department-scoped list, including populated faculty only from that department.
router.get("/", authenticate, async (req, res) => {
  try {
    const filter = scopedResourceFilter(req, res);
    if (!filter) return;
    const subjects = await Subject.find(filter)
      .populate("facultyId", "name email role departmentId")
      .sort({ code: 1 });
    return res.json(subjects);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subjects." });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const filter = scopedResourceFilter(req, res, resourceKey(req.params.id));
    if (!filter) return;
    const subject = await Subject.findOne(filter).populate(
      "facultyId",
      "name email role departmentId",
    );
    if (!subject) return res.status(404).json({ error: "Subject not found." });
    return res.json(subject);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subject." });
  }
});

router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, code, semester, facultyId, syllabus } = req.body;
    if (!name || !code || !semester)
      return res.status(400).json({ error: "Name, code, and semester are required." });

    const requestedDeptRaw = req.body.departmentId ? String(req.body.departmentId).trim() : null;
    const callerDeptRaw = getDepartmentId(req.user);
    const targetDeptRaw = isSuperAdmin(req.user) ? requestedDeptRaw || callerDeptRaw : callerDeptRaw;

    const departmentId = await resolveDepartmentId(targetDeptRaw);
    if (!departmentId)
      return res
        .status(400)
        .json({ error: "departmentId is required for department-scoped subjects." });

    if (facultyId && !(await validateFaculty(facultyId, departmentId)))
      return res
        .status(403)
        .json({ error: "Assigned faculty must belong to the subject's department." });

    const normalizedCode = code.trim().toUpperCase();
    if (await Subject.findOne({ code: normalizedCode }))
      return res
        .status(400)
        .json({ error: `Subject with code '${normalizedCode}' already exists.` });

    const subject = await Subject.create({
      name: name.trim(),
      code: normalizedCode,
      semester: Number(semester),
      departmentId,
      facultyId: facultyId || null,
      syllabus: syllabus || "",
    });

    await AuditLog.create({
      actorId: req.user.id || req.user._id,
      action: "CREATE_SUBJECT",
      details: { subjectId: subject._id, code: subject.code, departmentId },
    });
    return res.status(201).json(subject);
  } catch (error) {
    console.error("[Subject Error] Create error:", error);
    return res.status(500).json({ error: "Failed to create subject." });
  }
});

router.put("/:id", authenticate, requireRole("admin", "faculty"), async (req, res) => {
  try {
    const filter = scopedResourceFilter(req, res, resourceKey(req.params.id));
    if (!filter) return;
    const target = await Subject.findOne(filter);
    if (!target) return res.status(404).json({ error: "Subject not found." });

    const { name, code, semester, facultyId, syllabus } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (code) updates.code = code.trim().toUpperCase();
    if (semester != null) updates.semester = Number(semester);
    if (facultyId !== undefined) {
      if (facultyId && !(await validateFaculty(facultyId, target.departmentId)))
        return res
          .status(403)
          .json({ error: "Assigned faculty must belong to the subject's department." });
      updates.facultyId = facultyId || null;
    }
    if (syllabus !== undefined) updates.syllabus = syllabus;

    const updated = await Subject.findOneAndUpdate(filter, updates, { new: true }).populate(
      "facultyId",
      "name email role departmentId",
    );
    await AuditLog.create({
      actorId: req.user.id || req.user._id,
      action: "UPDATE_SUBJECT",
      details: { subjectId: updated._id, code: updated.code },
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update subject." });
  }
});

async function updateEnrollment(req, res, operation) {
  const filter = scopedResourceFilter(req, res, resourceKey(req.params.id));
  if (!filter) return;
  const { userId } = req.body;
  const studentId = userId || req.user._id || req.user.id;
  const subject = await Subject.findOne(filter);
  if (!subject) return res.status(404).json({ error: "Subject not found." });

  const student = await User.findOne({
    _id: studentId,
    role: "student",
    departmentId: subject.departmentId,
  }).select("_id");
  if (!student)
    return res.status(403).json({ error: "Student must belong to the subject's department." });

  const update =
    operation === "enroll"
      ? { $addToSet: { enrolledStudentIds: studentId } }
      : { $pull: { enrolledStudentIds: studentId } };
  return res.json(await Subject.findOneAndUpdate(filter, update, { new: true }));
}

router.post("/:id/enroll", authenticate, (req, res) =>
  updateEnrollment(req, res, "enroll").catch(() =>
    res.status(500).json({ error: "Failed to enroll student." }),
  ),
);

router.post("/:id/unenroll", authenticate, (req, res) =>
  updateEnrollment(req, res, "unenroll").catch(() =>
    res.status(500).json({ error: "Failed to unenroll student." }),
  ),
);

router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const filter = scopedResourceFilter(req, res, resourceKey(req.params.id));
    if (!filter) return;
    const deleted = await Subject.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ error: "Subject not found." });
    await AuditLog.create({
      actorId: req.user.id || req.user._id,
      action: "DELETE_SUBJECT",
      details: { subjectId: deleted._id, code: deleted.code, departmentId: deleted.departmentId },
    });
    return res.json({ message: "Subject deleted successfully.", id: String(deleted._id) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete subject." });
  }
});

export default router;
