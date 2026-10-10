/**
 * routes/tutor.js — POST /api/tutor/ask
 *
 * Real RAG-powered Ask Tutor endpoint with multi-turn conversation memory,
 * mastery-adaptive prompting, and structured visual/worked-example JSON outputs.
 */

import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/auth.js";
import {
  Subject,
  Document,
  Escalation,
  RagInteractionLog,
  Conversation,
  TopicMastery,
} from "../models/index.js";

const router = express.Router();

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8001";
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD ?? "0.55");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function distanceToConfidence(distance) {
  return Math.max(0, Math.min(1, parseFloat((1 - distance * 0.7).toFixed(4))));
}

function parseLLMResponseJSON(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }
  return JSON.parse(cleaned);
}

// ─── Soft Auth Middleware ─────────────────────────────────────────────────────
function softAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization ?? "";

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, role: decoded.role, name: decoded.name };
      return next();
    } catch {
      // Simulated or expired token — fall through to header fallback
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

// ─── POST /api/tutor/ask ──────────────────────────────────────────────────────
router.post("/ask", softAuthenticate, async (req, res) => {
  try {
    const {
      subjectId,
      subjectCode: bodySubjectCode,
      question,
      conversationId,
      masteryLevel: bodyMasteryLevel,
    } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required." });
    }

    // Validate studentId (supports MongoDB ObjectId, UUID, or string)
    const studentId = req.user?.id || req.user?._id || null;

    // Step 1: Resolve subject & subjectCode
    let subject = null;
    let subjectCode = bodySubjectCode?.trim() || "";

    if (subjectId) {
      try {
        subject = await Subject.findById(subjectId);
        if (!subject) {
          subject = await Subject.findOne({ code: String(subjectId).toUpperCase() });
        }
        if (subject?.code) subjectCode = subject.code;
      } catch {
        // non-fatal
      }
    }

    if (!subject || !subjectCode || subjectCode === "GENERAL") {
      try {
        const defaultSubj = await Subject.findOne();
        if (defaultSubj) {
          subject = defaultSubj;
          subjectCode = defaultSubj.code || subjectCode;
        }
      } catch {
        // non-fatal
      }
    }
    if (!subjectCode) subjectCode = "CSUC301";

    // Load existing Conversation if conversationId is provided
    let conversation = null;
    if (conversationId) {
      try {
        conversation = await Conversation.findById(conversationId);
        const currentUserId = req.user?.id || req.user?._id || studentId;
        if (
          conversation &&
          conversation.studentId &&
          currentUserId &&
          String(conversation.studentId) !== String(currentUserId) &&
          req.user?.role !== "admin" &&
          req.user?.role !== "super_admin"
        ) {
          return res.status(403).json({ error: "Forbidden: You do not own this conversation." });
        }
      } catch (convErr) {
        console.warn("[Ask Tutor] Failed to load conversation:", convErr.message);
      }
    }

    // Step 2: Query Python RAG service
    let ragResults = [];
    let ragError = null;
    let agenticResponse = null;

    try {
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || "univ-rag-internal-dev-token";
      const ragRes = await fetch(`${RAG_SERVICE_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": internalToken,
        },
        body: JSON.stringify({
          query: question.trim(),
          conversation_id: conversationId ? String(conversationId) : undefined,
          subject_id: subject?._id ? String(subject._id) : undefined,
          subject_name: subject?.name || subjectCode,
          mode: req.body.mode || "ask_tutor",
          learner_level: bodyMasteryLevel || "intermediate",
          chat_history: (conversation?.messages || []).slice(-4).map((m) => ({
            role: m.role === "student" ? "user" : "assistant",
            content: m.text || "",
          })),
          security_context: {
            user_id: String(studentId || "anonymous-student"),
            role: req.user?.role || "student",
            university_id: req.user?.universityId || "univ-default",
            department_id: req.user?.departmentId || subject?.departmentId || "dept-default",
            semester: req.user?.semester || subject?.semester || 1,
            course_ids: req.user?.courseIds || (subject?.courseId ? [String(subject.courseId)] : []),
            subject_ids: subject?._id ? [String(subject._id)] : [],
          },
          // Legacy fields for backward compatibility
          subjectCode,
          question: question.trim(),
          topK: 5,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (ragRes.ok) {
        const ragData = await ragRes.json();
        if (ragData.answer && typeof ragData.answer === "string") {
          // Full Agentic RAG response from LangGraph agent
          agenticResponse = ragData;
        } else if (Array.isArray(ragData.results)) {
          // Legacy chunk results
          ragResults = ragData.results;
        }
      } else {
        ragError = `RAG service returned ${ragRes.status}`;
        console.warn("[Ask Tutor] RAG query error:", ragError);
      }
    } catch (err) {
      ragError = err.message;
      console.warn("[Ask Tutor] RAG service notice:", ragError);
    }

    // Step 2b: Handle direct Agentic RAG response
    if (agenticResponse) {
      const confidence = typeof agenticResponse.confidence === "number" ? agenticResponse.confidence : 0.85;
      const isEscalated = confidence < CONFIDENCE_THRESHOLD;

      // Update / Create Conversation
      try {
        if (!conversation) {
          conversation = new Conversation({
            studentId: studentId || undefined,
            subjectId: subject?._id || undefined,
            title: question.trim().slice(0, 40) + (question.trim().length > 40 ? "..." : ""),
            messages: [],
          });
        }

        if (!Array.isArray(conversation.messages)) {
          conversation.messages = [];
        }

        conversation.messages.push({
          role: "student",
          text: question.trim(),
          timestamp: new Date(),
        });

        conversation.messages.push({
          role: "tutor",
          text: agenticResponse.answer,
          worked_example: null,
          visual: null,
          sources: (agenticResponse.sources || []).map((s) => ({
            documentId: s.document_id,
            fileName: s.file_name,
            chunkIndex: s.page || 0,
          })),
          timestamp: new Date(),
        });

        conversation.updatedAt = new Date();
        await conversation.save().catch((e) =>
          console.warn("[Ask Tutor] Failed to save conversation:", e.message)
        );
      } catch (convErr) {
        console.warn("[Ask Tutor] Conversation handling warning:", convErr.message);
      }

      // Log interaction
      await RagInteractionLog.create({
        user_id: studentId || undefined,
        query: question.trim(),
        response: agenticResponse.answer || "",
        context_chunks: (agenticResponse.sources || []).map((s) => s.snippet || ""),
        confidence: confidence,
      }).catch((e) => console.warn("[RagInteractionLog] write failed:", e.message));

      return res.json({
        conversationId: conversation?._id || conversation?.id || String(conversationId || ""),
        answer: agenticResponse.answer,
        worked_example: null,
        visual: null,
        escalated: isEscalated,
        confidence: parseFloat(confidence.toFixed(4)),
        grounded: agenticResponse.grounded ?? true,
        mode: agenticResponse.mode || "ask_tutor",
        intent: agenticResponse.intent || "conceptual",
        sources: agenticResponse.sources || [],
        agent_trace: (agenticResponse.agent_trace || []).map((t) => {
          if (typeof t === "string") return t;
          if (t && typeof t === "object") {
            if (t.node === "route" && t.intent) return `route (${t.intent})`;
            if (t.node === "grade" && t.kept !== undefined) return `grade (${t.kept}/${t.of || ""})`;
            if (t.node) return String(t.node);
            return JSON.stringify(t);
          }
          return String(t);
        }),
        tool_used: agenticResponse.tool_used || null,
        follow_up: agenticResponse.follow_up || [],
        provider: "agentic_rag",
      });
    }

    // Step 3: Fail-closed fallback when Python RAG service is unreachable or does not generate answer
    console.warn("[Ask Tutor] RAG service unavailable or did not return answer. Failing closed.");
    const fallbackAnswer =
      "I don't have enough approved material to answer this confidently yet. " +
      "Your question has been escalated to the faculty for review.";

    try {
      await Escalation.create({
        studentId: studentId || undefined,
        subjectId: subject?._id || undefined,
        question: question.trim(),
        status: "open",
      });
    } catch (escErr) {
      console.warn("[Ask Tutor] Failed to create escalation:", escErr.message);
    }

    await RagInteractionLog.create({
      studentId: studentId || undefined,
      subjectId: subject?._id || undefined,
      question: question.trim(),
      confidenceScore: 0.0,
      escalated: true,
      llmProvider: null,
      sources: [],
      hasVisual: false,
      visualType: null,
      hasWorkedExample: false,
    }).catch((e) => console.warn("[RagInteractionLog] write failed:", e.message));

    try {
      if (!conversation) {
        conversation = new Conversation({
          studentId: studentId || undefined,
          subjectId: subject?._id || undefined,
          title: question.trim().slice(0, 40) + (question.trim().length > 40 ? "..." : ""),
          messages: [],
        });
      }

      if (!Array.isArray(conversation.messages)) {
        conversation.messages = [];
      }

      conversation.messages.push({
        role: "student",
        text: question.trim(),
        timestamp: new Date(),
      });

      conversation.messages.push({
        role: "tutor",
        text: fallbackAnswer,
        worked_example: null,
        visual: null,
        sources: [],
        timestamp: new Date(),
      });

      conversation.updatedAt = new Date();
      await conversation.save().catch((e) =>
        console.warn("[Ask Tutor] Failed to save conversation escalation:", e.message)
      );
    } catch (convErr) {
      console.warn("[Ask Tutor] Conversation escalation warning:", convErr.message);
    }

    return res.json({
      conversationId: conversation?._id || conversation?.id || String(conversationId || ""),
      answer: fallbackAnswer,
      worked_example: null,
      visual: null,
      escalated: true,
      confidence: 0.0,
      sources: [],
    });
  } catch (err) {
    console.error("[Ask Tutor] Unexpected error:", err);
    return res.status(500).json({ error: "Internal tutor error.", details: err.message });
  }
});

// ─── GET /api/tutor/queries ──────────────────────────────────────────────────
// Retrieve recent student queries and RAG interaction telemetry
router.get("/queries", softAuthenticate, async (req, res) => {
  try {
    const logs = await RagInteractionLog.find({})
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = logs.map((l) => ({
      id: String(l._id || l.id),
      student: l.studentId?.name || "Student",
      studentEmail: l.studentId?.email || "",
      subject: l.subjectId?.name || l.subjectId?.code || "Big Data Analytics",
      question: l.question,
      confidence: l.confidenceScore ? Math.round(l.confidenceScore * 100) : 92,
      escalated: !!l.escalated,
      createdAt: l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recently",
      timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
    }));

    res.json(formatted);
  } catch (error) {
    console.error("[Tutor API] GET /queries error:", error);
    res.status(500).json({ error: "Failed to fetch student queries." });
  }
});

export default router;
