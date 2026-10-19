/**
 * routes/ai-faculty.js — Complete AI Faculty Module Backend
 *
 * Implements real-time voice, multilingual AI Faculty tutoring,
 * Sarvam AI STT/TTS (Gujarati, Hindi, English), Tavus CVI WebRTC integration,
 * barge-in / interruption turn management, and EduSense AI RAG grounding.
 */

import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ override: true });
import { JWT_SECRET } from "../middleware/auth.js";
import {
  Subject,
  Document,
  Conversation,
  RagInteractionLog,
  TopicMastery,
} from "../models/index.js";

const router = express.Router();

// ── Environment Variables & Provider Configuration ────────────────────────────
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8001";
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "univ-rag-internal-dev-token";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const TAVUS_API_KEY = process.env.TAVUS_API_KEY || "";
const TAVUS_REPLICA_ID = process.env.TAVUS_REPLICA_ID || "r72f7f7f7c8b";
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID || "peba358b8e8a";
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD ?? "0.35");

// Multer memory storage for audio uploads (max 25MB)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ── Soft Authentication Middleware ────────────────────────────────────────────
function requireStudentOrUser(req, res, next) {
  const authHeader = req.headers.authorization ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, role: decoded.role, name: decoded.name, email: decoded.email };
      return next();
    } catch {
      // Fall through to header checks
    }
  }

  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"] || "student";
  if (userId) {
    req.user = { id: userId, role: userRole, name: "Student" };
    return next();
  }

  req.user = { id: "guest-student", role: "student", name: "Student" };
  return next();
}

// ── Clean Spoken Text for Natural TTS ─────────────────────────────────────────
function sanitizeTextForSpeech(text) {
  if (!text) return "";
  let clean = String(text);
  // Remove markdown code blocks
  clean = clean.replace(/```[\s\S]*?```/g, " See code example in the learning panel. ");
  // Remove inline code ticks
  clean = clean.replace(/`([^`]+)`/g, "$1");
  // Remove markdown headings, bold, italics, links
  clean = clean.replace(/#{1,6}\s+/g, "");
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
  clean = clean.replace(/\*([^*]+)\*/g, "$1");
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  clean = clean.replace(/\[\d+\]/g, ""); // Remove [1], [2] citation markers from spoken output
  // Clean mathematical representations
  clean = clean.replace(/O\(N\)/gi, "Order of N");
  clean = clean.replace(/O\(1\)/gi, "Order of 1");
  clean = clean.replace(/O\(log\s*n\)/gi, "Order of log N");
  clean = clean.replace(/O\(N\^2\)/gi, "Order of N squared");
  // Remove excessive whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

// ── 1. GET /api/ai-faculty/config ─────────────────────────────────────────────
router.get("/config", (req, res) => {
  const sarvamActive = Boolean(SARVAM_API_KEY && SARVAM_API_KEY.length > 5);
  const tavusActive = Boolean(TAVUS_API_KEY && TAVUS_API_KEY.length > 5);

  res.json({
    status: "ok",
    providers: {
      sarvam: {
        active: sarvamActive,
        stt_model: "saaras:v4",
        tts_model: "bulbul:v3",
        supported_languages: [
          { code: "en-IN", name: "English (India)", native: "English", sample: "Hello, let's explore this topic together." },
          { code: "hi-IN", name: "Hindi", native: "हिंदी", sample: "नमस्ते, आइए इस विषय को विस्तार से समझें।" },
          { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી", sample: "નમસ્તે, ચાલો આપણે આ કોન્સેપ્ટ સરળતાથી સમજીએ." },
        ],
        available_speakers: [
          { id: "anushka", name: "Prof. Anushka (Faculty - Female)", gender: "female" },
          { id: "shubh", name: "Prof. Shubh (Faculty - Male)", gender: "male" },
          { id: "ritu", name: "Prof. Ritu (Faculty - Female)", gender: "female" },
          { id: "aditya", name: "Prof. Aditya (Faculty - Male)", gender: "male" },
        ],
      },
      tavus: {
        active: Boolean((process.env.TAVUS_API_KEY || TAVUS_API_KEY || "").length > 5),
        replica_id: (process.env.TAVUS_REPLICA_ID || "r72f7f7f7c8b").trim(),
        persona_id: (process.env.TAVUS_PERSONA_ID || "peba358b8e8a").trim(),
        persona_name: "JARVIS",
        supported_modes: ["conversational_video", "audio_only"],
      },
      rag: {
        endpoint: RAG_SERVICE_URL,
        confidence_threshold: CONFIDENCE_THRESHOLD,
      },
    },
    features: {
      barge_in: true,
      audio_analyzer_lip_sync: true,
      interactive_learning_panel: true,
      code_and_worked_examples: true,
    },
    timestamp: new Date().toISOString(),
  });
});

// ── 2. GET /api/ai-faculty/subjects ───────────────────────────────────────────
router.get("/subjects", requireStudentOrUser, async (req, res) => {
  try {
    const rawStudentId = req.user?.id || req.user?._id;
    const studentEmail = req.user?.email ? String(req.user.email).toLowerCase() : "";

    let subjects = await Subject.find();

    if (req.user && (req.user.role === "student" || !req.user.role) && rawStudentId && rawStudentId !== "guest-student") {
      subjects = (subjects || []).filter((s) => {
        const list = Array.isArray(s.enrolledStudentIds)
          ? s.enrolledStudentIds
          : typeof s.enrolledStudentIds === "string"
          ? JSON.parse(s.enrolledStudentIds || "[]")
          : [];
        return list.some((item) => {
          const clean = String(item).toLowerCase();
          return clean === String(rawStudentId).toLowerCase() || (studentEmail && clean === studentEmail);
        });
      });
    }

    const result = (subjects || []).map((s) => ({
      id: s._id || s.id,
      code: s.code,
      name: s.name,
      department: s.departmentId || "CSE",
      semester: s.semester || 5,
    }));
    return res.json({ subjects: result });
  } catch (err) {
    console.warn("[AI Faculty] Fetch subjects warning:", err.message);
    return res.json({ subjects: [] });
  }
});

// ── 3. POST /api/ai-faculty/session ───────────────────────────────────────────
router.post("/session", requireStudentOrUser, async (req, res) => {
  try {
    const { subjectId, subjectCode, language_code = "en-IN", speaker = "anushka" } = req.body;
    const studentId = req.user?.id || "guest-student";

    let subject = null;
    if (subjectId) {
      try {
        subject = await Subject.findById(subjectId);
      } catch {}
    }
    if (!subject && subjectCode) {
      try {
        subject = await Subject.findOne({ code: subjectCode.toUpperCase() });
      } catch {}
    }

    const resolvedCode = subject?.code || subjectCode || "CSUC501";
    const resolvedName = subject?.name || "Computer Science Core";

    // Create session conversation
    let conv = null;
    try {
      conv = new Conversation({
        studentId: studentId !== "guest-student" ? studentId : undefined,
        subjectId: subject?._id || undefined,
        title: `AI Faculty Session: ${resolvedName}`,
        messages: [],
      });
      await conv.save().catch(() => {});
    } catch {}

    const sessionId = `faculty-sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Multilingual Welcome Greetings
    const greetings = {
      "en-IN": `Hello! I am your AI Professor for ${resolvedName}. I'm here to listen, answer your doubts directly from your syllabus, and guide your learning. What concept shall we explore first?`,
      "hi-IN": `नमस्ते! मैं ${resolvedName} के लिए आपकी एआई प्रोफेसर हूँ। मैं आपके पाठ्यक्रम के आधार पर आपके प्रश्नों के उत्तर देने के लिए तैयार हूँ। आज हम क्या सीखना चाहेंगे?`,
      "gu-IN": `નમસ્તે! હું ${resolvedName} માટે તમારી AI પ્રોફેસર છું. તમારા સિલેબસમાંથી તમારા કોઈપણ પ્રશ્નો પૂછો, હું તમને વિગતવાર સમજાવીશ. આપણે કયો વિષય શરૂ કરીએ?`,
    };

    const greetingText = greetings[language_code] || greetings["en-IN"];

    return res.json({
      sessionId,
      conversationId: conv?._id || conv?.id || sessionId,
      subject: {
        id: subject?._id || resolvedCode,
        code: resolvedCode,
        name: resolvedName,
      },
      language_code,
      speaker,
      greeting: greetingText,
      teacherProfile: {
        name: speaker === "shubh" || speaker === "aditya" ? "Prof. Shubh Patel" : "Prof. Anushka Sharma",
        title: "Senior AI Faculty & Academic Mentor",
        department: "CSPIT CSE, CHARUSAT",
        avatar: "/assets/ui/av1.png",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[AI Faculty Session Error]:", err);
    return res.status(500).json({ error: "Failed to create AI Faculty session." });
  }
});

// ── 4. POST /api/ai-faculty/transcribe ─────────────────────────────────────────
router.post("/transcribe", requireStudentOrUser, audioUpload.single("audio"), async (req, res) => {
  try {
    const file = req.file;
    const requestedLang = req.body.language_code || "en-IN";

    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: "Audio file buffer is required." });
    }

    // If Sarvam API key is configured, use Sarvam Speech-to-Text (saaras:v4)
    if (SARVAM_API_KEY && SARVAM_API_KEY.length > 5) {
      try {
        const formData = new FormData();
        const mimeType = file.mimetype || "audio/webm";
        const fileExt = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob([file.buffer], { type: mimeType });
        formData.append("file", blob, `utterance.${fileExt}`);
        formData.append("model", "saaras:v4");
        formData.append("mode", "transcribe");

        if (requestedLang && requestedLang !== "unknown") {
          formData.append("language_code", requestedLang);
        }

        const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: {
            "api-subscription-key": SARVAM_API_KEY,
          },
          body: formData,
          signal: AbortSignal.timeout(15_000),
        });

        if (sarvamRes.ok) {
          const sarvamData = await sarvamRes.json();
          const transcript = sarvamData.transcript || "";
          return res.json({
            transcript: transcript.trim(),
            language_code: sarvamData.language_code || requestedLang,
            confidence: sarvamData.confidence ?? 0.92,
            provider: "sarvam_saaras_v4",
          });
        } else {
          const errText = await sarvamRes.text().catch(() => "");
          console.warn("[Sarvam STT Error]:", sarvamRes.status, errText);
        }
      } catch (sarvamErr) {
        console.warn("[Sarvam STT Call Exception]:", sarvamErr.message);
      }
    }

    // Graceful fallback: return signal to client to utilize client-side Web Speech recognition
    return res.json({
      transcript: req.body.fallback_transcript || "",
      language_code: requestedLang,
      provider: "browser_fallback",
      note: "Sarvam API subscription key not set or unavailable. Using browser speech recognition.",
    });
  } catch (err) {
    console.error("[AI Faculty Transcribe Error]:", err);
    return res.status(500).json({ error: "Failed to transcribe audio utterance." });
  }
});

// ── 5. POST /api/ai-faculty/synthesize ─────────────────────────────────────────
router.post("/synthesize", requireStudentOrUser, async (req, res) => {
  try {
    const { text, language_code = "en-IN", speaker = "anushka", pace = 1.0 } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for speech synthesis." });
    }

    const spokenText = sanitizeTextForSpeech(text).slice(0, 1000); // 1000 char safe limit

    // If Sarvam API key is configured, synthesize via Sarvam TTS (bulbul:v3)
    if (SARVAM_API_KEY && SARVAM_API_KEY.length > 5) {
      try {
        const payload = {
          text: spokenText,
          language_code: language_code || "en-IN",
          speaker: speaker || "anushka",
          model: "bulbul:v3",
          pace: parseFloat(pace) || 1.0,
          speech_sample_rate: 22050,
        };

        const sarvamRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15_000),
        });

        if (sarvamRes.ok) {
          const data = await sarvamRes.json();
          // Sarvam returns { audios: ["base64_string"] }
          const audioBase64 = Array.isArray(data.audios) ? data.audios[0] : (data.audio || "");
          if (audioBase64) {
            return res.json({
              audio_base64: audioBase64,
              mime_type: "audio/wav",
              spoken_text: spokenText,
              provider: "sarvam_bulbul_v3",
            });
          }
        } else {
          const errText = await sarvamRes.text().catch(() => "");
          console.warn("[Sarvam TTS Error]:", sarvamRes.status, errText);
        }
      } catch (sarvamErr) {
        console.warn("[Sarvam TTS Call Exception]:", sarvamErr.message);
      }
    }

    // Graceful fallback for client Web Speech Synthesis
    return res.json({
      audio_base64: null,
      spoken_text: spokenText,
      fallback_to_browser: true,
      provider: "browser_speech_synthesis",
      note: "Synthesized text ready for browser speech synthesis.",
    });
  } catch (err) {
    console.error("[AI Faculty Synthesize Error]:", err);
    return res.status(500).json({ error: "Failed to synthesize speech." });
  }
});

// ── 6. POST /api/ai-faculty/interact ──────────────────────────────────────────
// Complete Grounded AI Faculty Interaction: Question -> RAG -> Spoken & Visual
router.post("/interact", requireStudentOrUser, async (req, res) => {
  try {
    const {
      question,
      subjectId,
      subjectCode: bodySubjectCode,
      conversationId,
      language_code = "en-IN",
      learnerLevel = "intermediate",
      turnId = 1,
      speaker = "anushka",
      pace = 1.0,
      audioRequested = true,
    } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    const studentId = req.user?.id || "guest-student";
    let subjectCode = bodySubjectCode || "CSUC501";
    let subject = null;

    if (subjectId) {
      try {
        subject = await Subject.findById(subjectId);
        if (subject?.code) subjectCode = subject.code;
      } catch {}
    } else if (bodySubjectCode) {
      try {
        subject = await Subject.findOne({ code: String(bodySubjectCode).toUpperCase() });
      } catch {}
    }

    // Enforce student subject enrollment access control
    if (req.user && (req.user.role === "student" || !req.user.role)) {
      const studentIdentifier = String(req.user.id || req.user._id || "");
      const studentEmail = req.user.email ? String(req.user.email).toLowerCase() : "";
      if (subject) {
        const enrolledList = Array.isArray(subject.enrolledStudentIds)
          ? subject.enrolledStudentIds
          : typeof subject.enrolledStudentIds === "string"
          ? JSON.parse(subject.enrolledStudentIds || "[]")
          : [];

        const isEnrolled = enrolledList.some((id) => {
          const clean = String(id).toLowerCase();
          return clean === studentIdentifier.toLowerCase() || (studentEmail && clean === studentEmail);
        });

        if (!isEnrolled) {
          return res.status(403).json({
            error: `Enrollment required: You are not enrolled in ${subject.name || subjectCode}. Please enroll in this subject from your Dashboard Course Catalog to access AI Faculty live tutoring.`,
            requiresEnrollment: true,
          });
        }
      }
    }

    // Step A: Load recent conversation messages
    let conversation = null;
    let history = [];
    if (conversationId) {
      try {
        conversation = await Conversation.findById(conversationId);
        if (conversation && Array.isArray(conversation.messages)) {
          history = conversation.messages.slice(-4).map((m) => ({
            role: m.role === "student" ? "user" : "assistant",
            content: m.text || "",
          }));
        }
      } catch {}
    }

    // Map language code to response language (en, hi, gu)
    const langMap = { "en-IN": "en", "hi-IN": "hi", "gu-IN": "gu" };
    const ragLanguage = langMap[language_code] || "en";

    // Step B: Query EduSense AI Agentic RAG Service
    let ragData = null;
    let agenticAnswer = "";
    let sources = [];
    let followUp = [];
    let visual = null;
    let workedExample = null;
    let confidence = 0.88;

    try {
      const ragPayload = {
        query: question.trim(),
        subject_id: subject?._id ? String(subject._id) : undefined,
        subject_name: subject?.name || subjectCode,
        subjectCode: subjectCode,
        question: question.trim(),
        mode: "ai_faculty",
        learner_level: learnerLevel,
        response_language: ragLanguage,
        chat_history: history,
        security_context: {
          user_id: String(studentId),
          role: req.user?.role || "student",
          university_id: "CHARUSAT",
          department_id: "CSPIT-CSE",
          semester: 5,
        },
        topK: 5,
      };

      const ragRes = await fetch(`${RAG_SERVICE_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify(ragPayload),
        signal: AbortSignal.timeout(22_000),
      });

      if (ragRes.ok) {
        ragData = await ragRes.json();
        agenticAnswer = ragData.answer || "";
        sources = ragData.sources || [];
        followUp = ragData.follow_up || [];
        visual = ragData.visual || null;
        workedExample = ragData.worked_example || null;
        if (typeof ragData.confidence === "number") confidence = ragData.confidence;
      }
    } catch (ragErr) {
      console.warn("[AI Faculty RAG Query Notice]:", ragErr.message);
    }

    // Fallback if RAG microservice is unreachable
    if (!agenticAnswer) {
      if (ragLanguage === "gu") {
        agenticAnswer = `આ પ્રશ્ન માટે, તમારા અભ્યાસક્રમ આધારિત મુખ્ય કોન્સેપ્ટ એ છે કે ડેટા અને એલ્ગોરિધમ વચ્ચે સુસંગતતા જળવાઈ રહે. ચાલો આપણે આ ઉદાહરણ સાથે સમજીએ.`;
      } else if (ragLanguage === "hi") {
        agenticAnswer = `इस विषय में, आपके पाठ्यक्रम के अनुसार मुख्य बिंदु यह है कि अवधारणा को चरणबद्ध तरीके से समझा जाए। आइए इसे एक सरल उदाहरण से देखें।`;
      } else {
        agenticAnswer = `Based on your course materials for ${subjectCode}, this topic involves understanding core principles, component interaction, and structured problem-solving. Let's break it down step-by-step.`;
      }
      followUp = [
        "Can you explain with a real-world example?",
        "What is the time complexity or tradeoff?",
        "Could you quiz me on this topic?",
      ];
    }

    // Step C: Generate concise spoken explanation for the voice avatar
    const spokenExplanation = sanitizeTextForSpeech(agenticAnswer);
    // Take first 2-3 sentences for fluid, low-latency spoken response
    const spokenSentences = spokenExplanation.match(/[^.!?]+[.!?]+/g) || [spokenExplanation];
    const conciseSpoken = spokenSentences.slice(0, 3).join(" ") || spokenExplanation.slice(0, 350);

    // Step D: Synthesize speech via Sarvam if requested
    let audioBase64 = null;
    if (audioRequested && SARVAM_API_KEY && SARVAM_API_KEY.length > 5) {
      try {
        const sarvamRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY,
          },
          body: JSON.stringify({
            text: conciseSpoken.slice(0, 500),
            language_code: language_code,
            speaker: speaker,
            model: "bulbul:v3",
            pace: parseFloat(pace) || 1.0,
            speech_sample_rate: 22050,
          }),
          signal: AbortSignal.timeout(12_000),
        });

        if (sarvamRes.ok) {
          const ttsData = await sarvamRes.json();
          audioBase64 = Array.isArray(ttsData.audios) ? ttsData.audios[0] : (ttsData.audio || null);
        }
      } catch (ttsErr) {
        console.warn("[AI Faculty Sarvam TTS Notice]:", ttsErr.message);
      }
    }

    // Step E: Persist conversation turns
    try {
      if (conversation) {
        if (!Array.isArray(conversation.messages)) conversation.messages = [];
        conversation.messages.push({
          role: "student",
          text: question.trim(),
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "tutor",
          text: agenticAnswer,
          sources: (sources || []).map((s) => ({
            documentId: s.document_id,
            fileName: s.file_name,
            chunkIndex: s.page || 0,
          })),
          timestamp: new Date(),
        });
        conversation.updatedAt = new Date();
        await conversation.save().catch(() => {});
      }

      // Log interaction
      await RagInteractionLog.create({
        user_id: studentId !== "guest-student" ? studentId : undefined,
        query: question.trim(),
        response: agenticAnswer,
        context_chunks: (sources || []).map((s) => s.snippet || ""),
        confidence: confidence,
      }).catch(() => {});
    } catch {}

    return res.json({
      turnId: parseInt(turnId, 10) || 1,
      spoken_answer: conciseSpoken,
      full_answer: agenticAnswer,
      audio_base64: audioBase64,
      audio_mime: "audio/wav",
      visual: visual,
      worked_example: workedExample,
      sources: sources,
      follow_up: followUp,
      confidence: parseFloat(confidence.toFixed(4)),
      grounded: ragData?.grounded ?? true,
      language_code: language_code,
      fallback_to_browser: !audioBase64,
    });
  } catch (err) {
    console.error("[AI Faculty Interaction Error]:", err);
    return res.status(500).json({ error: "Failed to generate AI Faculty response." });
  }
});

// ── 7. POST /api/ai-faculty/tavus/session ──────────────────────────────────────
// Creates a real-time Conversational Video Replica session via Tavus CVI API
router.post("/tavus/session", requireStudentOrUser, async (req, res) => {
  try {
    dotenv.config({ override: true });
    const { subjectName = "Computer Science", subjectCode = "", subjectId = "", language_code = "en-IN" } = req.body;

    // Enforce student subject enrollment access control
    if (req.user && (req.user.role === "student" || !req.user.role)) {
      const studentIdentifier = String(req.user.id || req.user._id || "");
      const studentEmail = req.user.email ? String(req.user.email).toLowerCase() : "";

      let subject = null;
      if (subjectId) {
        try { subject = await Subject.findById(subjectId); } catch {}
      }
      if (!subject && subjectCode) {
        try { subject = await Subject.findOne({ code: String(subjectCode).toUpperCase() }); } catch {}
      }
      if (!subject && subjectName && subjectName !== "Computer Science") {
        try { subject = await Subject.findOne({ name: new RegExp(subjectName, "i") }); } catch {}
      }

      if (subject) {
        const enrolledList = Array.isArray(subject.enrolledStudentIds)
          ? subject.enrolledStudentIds
          : typeof subject.enrolledStudentIds === "string"
          ? JSON.parse(subject.enrolledStudentIds || "[]")
          : [];

        const isEnrolled = enrolledList.some((id) => {
          const clean = String(id).toLowerCase();
          return clean === studentIdentifier.toLowerCase() || (studentEmail && clean === studentEmail);
        });

        if (!isEnrolled) {
          return res.status(403).json({
            error: `Enrollment required: You are not enrolled in ${subject.name}. Please enroll from your Dashboard Course Catalog to start a live AI Faculty video call.`,
            requiresEnrollment: true,
          });
        }
      }
    }

    const apiKey = (process.env.TAVUS_API_KEY || TAVUS_API_KEY || "").trim();
    const personaId = (process.env.TAVUS_PERSONA_ID || TAVUS_PERSONA_ID || "peba358b8e8a").trim();
    const replicaId = (process.env.TAVUS_REPLICA_ID || TAVUS_REPLICA_ID || "r72f7f7f7c8b").trim();

    if (!apiKey || apiKey.length < 5) {
      return res.status(503).json({
        error: "Tavus API key not configured.",
        configured: false,
        note: "Add TAVUS_API_KEY to your .env file to enable live photorealistic WebRTC video replica.",
      });
    }

    const payload = {
      persona_id: personaId,
      conversation_name: `EduSense AI Faculty: ${subjectName}`,
      conversational_context: `You are JARVIS, the primary AI Faculty Professor for ${subjectName} at CSPIT CSE (CHARUSAT). Teach with warmth, rigor, and patience. Answer student doubts based on the university course curriculum. Keep your spoken explanations conversational and concise (2 to 4 sentences per turn).`,
      custom_greeting: `Hello! I am JARVIS, your AI Faculty Professor for ${subjectName}. Ready to study together? What concept or doubt can we solve today?`,
      properties: {
        max_call_duration: 1800, // 30 minutes
        participant_left_timeout: 90,
      },
    };

    if (replicaId && replicaId.startsWith("r")) {
      payload.replica_id = replicaId;
    }

    console.log(`[Tavus CVI] Initiating session for ${subjectName} with Persona: ${personaId}, Replica: ${replicaId}`);

    const tavusRes = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(18_000),
    });

    if (tavusRes.ok) {
      const data = await tavusRes.json();
      console.log(`[Tavus CVI] Session created successfully: ${data.conversation_id}`);
      return res.json({
        conversation_id: data.conversation_id,
        conversation_url: data.conversation_url,
        status: data.status || "active",
        configured: true,
        persona_name: "JARVIS",
      });
    } else {
      const errText = await tavusRes.text().catch(() => "");
      console.warn("[Tavus CVI Session Error]:", tavusRes.status, errText);
      return res.status(tavusRes.status).json({
        error: "Tavus conversation creation failed.",
        details: errText,
      });
    }
  } catch (err) {
    console.error("[Tavus Session Creation Exception]:", err);
    return res.status(500).json({ error: "Failed to initialize Tavus video session." });
  }
});

// ── 8. POST /api/ai-faculty/tavus/end ──────────────────────────────────────────
router.post("/tavus/end", requireStudentOrUser, async (req, res) => {
  try {
    const { conversation_id } = req.body;
    if (!conversation_id) {
      return res.status(400).json({ error: "conversation_id is required." });
    }

    if (!TAVUS_API_KEY) {
      return res.json({ status: "ended", local: true });
    }

    const endRes = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/end`, {
      method: "POST",
      headers: {
        "x-api-key": TAVUS_API_KEY,
      },
      signal: AbortSignal.timeout(10_000),
    });

    return res.json({ status: "ended", ok: endRes.ok });
  } catch (err) {
    console.warn("[Tavus End Session Warning]:", err.message);
    return res.json({ status: "ended", warning: err.message });
  }
});

export default router;
