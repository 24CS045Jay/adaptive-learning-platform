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
import { callLLM } from "../lib/llm.js";

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
    let subjectCode = bodySubjectCode?.trim() || "GENERAL";

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

    // Load existing Conversation if conversationId is provided
    let conversation = null;
    if (conversationId) {
      try {
        conversation = await Conversation.findById(conversationId);
      } catch (convErr) {
        console.warn("[Ask Tutor] Failed to load conversation:", convErr.message);
      }
    }

    // Step 2: Query Python RAG service
    let ragResults = [];
    let ragError = null;

    try {
      const ragRes = await fetch(`${RAG_SERVICE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectCode, question: question.trim(), topK: 5 }),
        signal: AbortSignal.timeout(4_000),
      });

      if (ragRes.ok) {
        const ragData = await ragRes.json();
        ragResults = ragData.results ?? [];
      } else {
        ragError = `RAG service returned ${ragRes.status}`;
        console.warn("[Ask Tutor] RAG query error:", ragError);
      }
    } catch (err) {
      ragError = err.message;
      console.warn("[Ask Tutor] RAG service unreachable:", ragError);
    }

    // Step 3: Compute confidence
    const bestDistance = ragResults.length > 0 ? ragResults[0].distance : 2;
    const confidence = distanceToConfidence(bestDistance);

    // Step 4a: Escalation (low confidence or no chunks)
    if (confidence < CONFIDENCE_THRESHOLD || ragResults.length === 0) {
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
        confidenceScore: confidence,
        escalated: true,
        llmProvider: null,
        sources: [],
        hasVisual: false,
        visualType: null,
        hasWorkedExample: false,
      }).catch((e) => console.warn("[RagInteractionLog] write failed:", e.message));

      const fallbackAnswer =
        "I don't have enough approved material to answer this confidently yet. " +
        "Your question has been escalated to the faculty for review.";

      // Append to conversation history if thread exists or create new
      if (!conversation) {
        conversation = new Conversation({
          studentId: studentId || undefined,
          subjectId: subject?._id || undefined,
          title: question.trim().slice(0, 40) + (question.trim().length > 40 ? "..." : ""),
          messages: [],
        });
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

      return res.json({
        conversationId: conversation._id,
        answer: fallbackAnswer,
        worked_example: null,
        visual: null,
        escalated: true,
        confidence: parseFloat(confidence.toFixed(4)),
        sources: [],
      });
    }

    // Step 4b: Determine student topic mastery level
    let masteryLabel = bodyMasteryLevel || "average";
    if (studentId && subject?._id) {
      try {
        const masteryRecord = await TopicMastery.findOne({
          studentId,
          subjectId: subject._id,
        })
          .sort({ updatedAt: -1 })
          .lean();
        if (masteryRecord?.masteryLabel) {
          masteryLabel = masteryRecord.masteryLabel;
        }
      } catch (mErr) {
        console.warn("[Ask Tutor] Mastery lookup skipped:", mErr.message);
      }
    }

    // Step 4c: Load previous 4-6 messages for conversation memory
    let conversationContext = "";
    if (conversation && conversation.messages?.length > 0) {
      const pastMsgs = conversation.messages.slice(-6);
      conversationContext =
        "Earlier in this conversation:\n" +
        pastMsgs
          .map(
            (m) =>
              `${m.role === "student" ? "Student" : "Tutor"}: ${m.text.slice(0, 300)}`
          )
          .join("\n") +
        "\n\n---\n\n";
    }

    // Step 4d: Context text from retrieved chunks
    const contextText = ragResults
      .map((r, i) => `[Chunk ${i + 1}]\n${r.text}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are a helpful academic tutor.
Answer the student's question ONLY using the provided course material chunks below.
If the chunks do not fully answer the question, say so explicitly and do NOT use any outside knowledge.

Adapt your explanation style based on the student's current mastery level (${masteryLabel.toUpperCase()}):
- Weak: Provide step-by-step guidance with extra scaffolding, clear basic definitions, and simple intuitive explanations.
- Strong: Provide a concise, direct, in-depth explanation focusing on core mechanics and technical nuance.
- Average: Provide a balanced explanation with moderate detail and clear structure.

You MUST respond strictly in valid JSON matching this exact schema:
{
  "answer": "string (the main explanation text)",
  "worked_example": "string or null (a concrete numeric/code/real-life example — ONLY include when the question is conceptual/mathematical/procedural and an example would genuinely help; return null otherwise)",
  "visual": null OR one of:
    { "type": "flowchart", "steps": ["Step 1", "Step 2", ...] }
    { "type": "comparison_chart", "categories": ["Cat A", "Cat B"], "values": [10, 20], "label": "Metric Name" }
    { "type": "concept_map", "nodes": ["Node 1", "Node 2"], "edges": [{"from": "Node 1", "to": "Node 2", "relation": "connects to"}] }
}

Visual Rules:
- ONLY include a visual when the concept genuinely has a step sequence (flowchart), quantitative comparison (comparison_chart), or relationship structure (concept_map).
- Otherwise return "visual": null. Do NOT force a visual on every answer.
- Output strictly valid JSON. Do NOT wrap in markdown code blocks or add extra commentary outside JSON.`;

    const userPrompt = `${conversationContext}Course material context:\n\n${contextText}\n\n---\n\nStudent question: ${question.trim()}`;

    // Step 5: Call LLM & Parse JSON (with repair retry)
    let structuredOutput = null;
    let rawText = "";
    let llmProvider = null;

    try {
      const llmResult = await callLLM(systemPrompt, userPrompt);
      rawText = llmResult.text;
      llmProvider = llmResult.provider;

      try {
        structuredOutput = parseLLMResponseJSON(rawText);
        if (!structuredOutput || typeof structuredOutput.answer !== "string") {
          throw new Error("Missing answer field in parsed JSON");
        }
      } catch (firstParseErr) {
        console.warn(
          "[Ask Tutor] Primary JSON parse failed:",
          firstParseErr.message,
          "— attempting repair..."
        );
        try {
          const repairResult = await callLLM(
            systemPrompt,
            `The output was not valid JSON:\n${rawText}\n\nPlease fix and return ONLY valid JSON matching the schema.`
          );
          structuredOutput = parseLLMResponseJSON(repairResult.text);
          if (!structuredOutput || typeof structuredOutput.answer !== "string") {
            throw new Error("Repaired JSON still invalid");
          }
        } catch (repairErr) {
          console.warn(
            "[Ask Tutor] Repair JSON failed too:",
            repairErr.message,
            "— using fallback answer."
          );
          structuredOutput = {
            answer: rawText,
            worked_example: null,
            visual: null,
          };
        }
      }
    } catch (llmErr) {
      console.error("[Ask Tutor] LLM call failed:", llmErr.message);
      structuredOutput = {
        answer: contextText,
        worked_example: null,
        visual: null,
      };
    }

    // Step 6: Resolve source document titles
    const documentIds = [
      ...new Set(ragResults.map((r) => r.metadata?.documentId).filter(Boolean)),
    ];

    const docRecords = await Document.find({ _id: { $in: documentIds } })
      .select("fileName")
      .lean();

    const docMap = {};
    for (const d of docRecords) {
      docMap[String(d._id)] = d.fileName;
    }

    const sources = ragResults
      .map((r) => ({
        documentId: r.metadata?.documentId ?? null,
        fileName: docMap[r.metadata?.documentId] ?? "Unknown document",
        chunkIndex: parseInt(r.metadata?.chunkIndex ?? "0", 10),
      }))
      .filter((s) => s.documentId);

    // Step 7: Update Conversation in MongoDB
    if (!conversation) {
      conversation = new Conversation({
        studentId: studentId || undefined,
        subjectId: subject?._id || undefined,
        title: question.trim().slice(0, 40) + (question.trim().length > 40 ? "..." : ""),
        messages: [],
      });
    }

    conversation.messages.push({
      role: "student",
      text: question.trim(),
      timestamp: new Date(),
    });

    conversation.messages.push({
      role: "tutor",
      text: structuredOutput.answer,
      worked_example: structuredOutput.worked_example || null,
      visual: structuredOutput.visual || null,
      sources,
      timestamp: new Date(),
    });

    conversation.updatedAt = new Date();
    await conversation.save().catch((e) =>
      console.warn("[Ask Tutor] Conversation save failed:", e.message)
    );

    // Step 8: Log to RagInteractionLog
    await RagInteractionLog.create({
      studentId: studentId || undefined,
      subjectId: subject?._id || undefined,
      question: question.trim(),
      confidenceScore: confidence,
      escalated: false,
      llmProvider,
      sources,
      hasVisual: Boolean(structuredOutput.visual),
      visualType: structuredOutput.visual?.type || null,
      hasWorkedExample: Boolean(structuredOutput.worked_example),
    }).catch((e) => console.warn("[RagInteractionLog] write failed:", e.message));

    return res.json({
      conversationId: conversation._id,
      answer: structuredOutput.answer,
      worked_example: structuredOutput.worked_example || null,
      visual: structuredOutput.visual || null,
      escalated: false,
      confidence: parseFloat(confidence.toFixed(4)),
      sources,
      provider: llmProvider,
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
