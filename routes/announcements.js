import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { Announcement, Subject } from "../models/index.js";

const router = express.Router();

router.use(authenticate);

// ── GET /api/announcements ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const announcements = await Announcement.find({}).sort({ createdAt: -1 });

    const list = announcements.map((a) => {
      const plain = a.toObject ? a.toObject() : { ...a };
      const rawDate = a.createdAt || a.created_at || new Date().toISOString();
      return {
        id: String(a._id || a.id),
        title: a.title || "Announcement",
        message: a.message || "",
        scope: a.scope || "Institution",
        postedBy: a.postedBy || a.posted_by || "Administrator",
        departmentId: a.departmentId || a.department_id || "CE",
        createdAt: typeof rawDate === "string" ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0],
      };
    });

    res.json(list);
  } catch (error) {
    console.error("[Announcements API] GET error:", error);
    res.status(500).json({ error: "Failed to fetch announcements." });
  }
});

// ── POST /api/announcements ─────────────────────────────────────────────────
router.post("/", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { title, message, scope, postedBy, departmentId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required." });
    }

    const authorName = postedBy || req.user?.name || (req.user?.role === "admin" ? "Administrator" : "Faculty");
    const authorDept = departmentId || req.user?.departmentId || "CE";

    const ann = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      scope: scope || "Institution",
      postedBy: authorName,
      departmentId: authorDept,
    });

    const rawDate = ann.createdAt || ann.created_at || new Date().toISOString();

    res.status(201).json({
      id: String(ann._id || ann.id),
      title: ann.title,
      message: ann.message,
      scope: ann.scope || "Institution",
      postedBy: authorName,
      departmentId: authorDept,
      createdAt: typeof rawDate === "string" ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("[Announcements API] POST error:", error);
    res.status(500).json({ error: error.message || "Failed to create announcement." });
  }
});

// ── DELETE /api/announcements/:id ───────────────────────────────────────────
router.delete("/:id", requireRole("faculty", "admin"), async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Announcement deleted successfully.", id: req.params.id });
  } catch (error) {
    console.error("[Announcements API] DELETE error:", error);
    res.status(500).json({ error: "Failed to delete announcement." });
  }
});

export default router;
