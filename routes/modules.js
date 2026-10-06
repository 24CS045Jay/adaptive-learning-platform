import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { Module, Resource, Subject } from "../models/index.js";

const router = express.Router();

router.use(authenticate);

// ── GET /api/modules ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) {
      filter.subjectId = subjectId;
    }

    const modules = await Module.find(filter).sort({ createdAt: 1 });
    const list = modules.map((m) => {
      const plain = m.toObject ? m.toObject() : { ...m };
      return {
        ...plain,
        id: String(m._id || m.id),
        name: m.title || m.name || "Module",
        title: m.title || m.name || "Module",
        unitNumber: m.unitNumber || m.unit_number || m.order || 1,
        order: m.unitNumber || m.unit_number || m.order || 1,
        subjectId: String(m.subjectId || m.subject_id || ""),
      };
    });

    res.json(list);
  } catch (error) {
    console.error("[Modules API] GET error:", error);
    res.status(500).json({ error: "Failed to fetch modules." });
  }
});

// ── POST /api/modules ───────────────────────────────────────────────────────
router.post("/", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { subjectId, name, title, order, unitNumber, description } = req.body;
    const moduleTitle = title || name;
    if (!subjectId || !moduleTitle) {
      return res.status(400).json({ error: "subjectId and module title are required." });
    }

    const unitNum = unitNumber ?? order ?? 1;

    const newModule = await Module.create({
      subjectId,
      title: moduleTitle.trim(),
      unitNumber: Number(unitNum),
      description: description || "",
    });

    res.status(201).json({
      id: String(newModule._id || newModule.id),
      name: newModule.title || moduleTitle,
      title: newModule.title || moduleTitle,
      unitNumber: Number(unitNum),
      order: Number(unitNum),
      subjectId: String(newModule.subjectId || subjectId),
    });
  } catch (error) {
    console.error("[Modules API] POST error:", error);
    res.status(500).json({ error: error.message || "Failed to create module." });
  }
});

// ── DELETE /api/modules/:id ────────────────────────────────────────────────
router.delete("/:id", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const mod = await Module.findByIdAndDelete(req.params.id);
    if (!mod) {
      return res.status(404).json({ error: "Module not found." });
    }
    // Also remove resources belonging to this module
    await Resource.deleteMany({ moduleId: req.params.id });

    res.json({ message: "Module and its associated resources deleted successfully." });
  } catch (error) {
    console.error("[Modules API] DELETE error:", error);
    res.status(500).json({ error: "Failed to delete module." });
  }
});

export default router;
