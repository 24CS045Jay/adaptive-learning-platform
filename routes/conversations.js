/**
 * routes/conversations.js
 *
 * REST endpoints for student conversation history.
 * - GET /api/conversations (List student's conversations)
 * - GET /api/conversations/:id (Fetch full message history for a conversation)
 * - DELETE /api/conversations/:id (Delete a conversation permanently)
 */

import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/auth.js";
import { Conversation } from "../models/index.js";

const router = express.Router();

function softAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, role: decoded.role, name: decoded.name };
      return next();
    } catch {
      // fallback to header
    }
  }

  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"] || "student";
  if (userId) {
    req.user = { id: userId, role: userRole };
    return next();
  }

  req.user = null;
  return next();
}

function isValidId(id) {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const OBJECTID_RE = /^[0-9a-fA-F]{24}$/;
  return UUID_RE.test(trimmed) || OBJECTID_RE.test(trimmed) || /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed);
}

// GET /api/conversations — List student's conversations
router.get("/", softAuthenticate, async (req, res) => {
  try {
    const rawStudentId = req.user?.id || req.user?._id || null;
    const filter = {};

    if (rawStudentId && isValidId(String(rawStudentId))) {
      filter.studentId = String(rawStudentId);
    }

    let conversations = await Conversation.find(filter)
      .populate("subjectId", "name code")
      .sort({ updatedAt: -1 });

    // Fallback if older rows have null studentId
    if ((!conversations || conversations.length === 0) && rawStudentId) {
      conversations = await Conversation.find({})
        .populate("subjectId", "name code")
        .sort({ updatedAt: -1 });
      conversations = (conversations || []).filter(
        (c) => !c.studentId || String(c.studentId) === String(rawStudentId)
      );
    }

    const result = (conversations || []).map((c) => ({
      _id: c._id || c.id,
      id: c.id || c._id,
      title: c.title,
      subjectId: c.subjectId?._id || c.subjectId || null,
      subjectName: c.subjectId?.name || "General",
      subjectCode: c.subjectId?.code || "GENERAL",
      updatedAt: c.updatedAt || c.createdAt,
      createdAt: c.createdAt,
      messagesCount: Array.isArray(c.messages)
        ? c.messages.length
        : typeof c.messages === "string"
        ? JSON.parse(c.messages || "[]").length
        : 0,
    }));

    return res.json(result);
  } catch (err) {
    console.error("[Conversations] List error:", err);
    return res.status(500).json({ error: "Failed to load conversations." });
  }
});

// GET /api/conversations/:id — Get full conversation with messages
router.get("/:id", softAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Invalid conversation ID." });
    }

    const conversation = await Conversation.findById(id).populate("subjectId", "name code");

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const currentUserId = req.user?.id || req.user?._id;
    if (
      currentUserId &&
      conversation.studentId &&
      String(conversation.studentId) !== String(currentUserId) &&
      req.user?.role !== "admin" &&
      req.user?.role !== "super_admin"
    ) {
      return res.status(403).json({ error: "Forbidden: You do not own this conversation." });
    }

    let messages = conversation.messages || [];
    if (typeof messages === "string") {
      try {
        messages = JSON.parse(messages);
      } catch {
        messages = [];
      }
    }

    return res.json({
      _id: conversation._id || conversation.id,
      id: conversation.id || conversation._id,
      title: conversation.title,
      subjectId: conversation.subjectId?._id || conversation.subjectId || null,
      subjectName: conversation.subjectId?.name || "General",
      subjectCode: conversation.subjectId?.code || "GENERAL",
      updatedAt: conversation.updatedAt || conversation.createdAt,
      createdAt: conversation.createdAt,
      messages,
    });
  } catch (err) {
    console.error("[Conversations] Get error:", err);
    return res.status(500).json({ error: "Failed to load conversation history." });
  }
});

// DELETE /api/conversations/:id — Delete a conversation permanently from database
router.delete("/:id", softAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: "Invalid conversation ID." });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const currentUserId = req.user?.id || req.user?._id;
    if (
      currentUserId &&
      conversation.studentId &&
      String(conversation.studentId) !== String(currentUserId) &&
      req.user?.role !== "admin" &&
      req.user?.role !== "super_admin"
    ) {
      return res.status(403).json({ error: "Forbidden: You do not own this conversation." });
    }

    await Conversation.findByIdAndDelete(id);
    console.log(`[Conversations] Permanently deleted conversation: ${id}`);

    return res.json({
      success: true,
      message: "Conversation deleted permanently.",
      id,
    });
  } catch (err) {
    console.error("[Conversations] Delete error:", err);
    return res.status(500).json({ error: "Failed to delete conversation." });
  }
});

export default router;
