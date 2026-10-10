/**
 * routes/conversations.js
 *
 * REST endpoints for student conversation history.
 * - GET /api/conversations (List student's conversations)
 * - GET /api/conversations/:id (Fetch full message history for a conversation)
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

const OBJECTID_RE = /^[0-9a-fA-F]{24}$/;

// GET /api/conversations — List student's conversations
router.get("/", softAuthenticate, async (req, res) => {
  try {
    const rawStudentId = req.user?.id || req.user?._id || null;
    const filter = {};

    if (rawStudentId && OBJECTID_RE.test(String(rawStudentId))) {
      filter.studentId = rawStudentId;
    }

    const conversations = await Conversation.find(filter)
      .populate("subjectId", "name code")
      .sort({ updatedAt: -1 })
      .lean();

    const result = conversations.map((c) => ({
      _id: c._id,
      id: c._id,
      title: c.title,
      subjectId: c.subjectId?._id || c.subjectId || null,
      subjectName: c.subjectId?.name || "General",
      subjectCode: c.subjectId?.code || "GENERAL",
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      messagesCount: c.messages?.length || 0,
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
    if (!id || !OBJECTID_RE.test(id)) {
      return res.status(400).json({ error: "Invalid conversation ID." });
    }

    const conversation = await Conversation.findById(id)
      .populate("subjectId", "name code")
      .lean();

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

    return res.json({
      _id: conversation._id,
      id: conversation._id,
      title: conversation.title,
      subjectId: conversation.subjectId?._id || conversation.subjectId || null,
      subjectName: conversation.subjectId?.name || "General",
      subjectCode: conversation.subjectId?.code || "GENERAL",
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      messages: conversation.messages || [],
    });
  } catch (err) {
    console.error("[Conversations] Get error:", err);
    return res.status(500).json({ error: "Failed to load conversation history." });
  }
});

export default router;
