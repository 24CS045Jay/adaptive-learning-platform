import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectSupabase } from "./db/supabase.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import subjectRoutes from "./routes/subjects.js";
import documentRoutes from "./routes/documents.js";
import tutorRoutes from "./routes/tutor.js";
import quizRoutes from "./routes/quizzes.js";
import announcementRoutes from "./routes/announcements.js";
import escalationRoutes from "./routes/escalations.js";
import moduleRoutes from "./routes/modules.js";
import resourceRoutes from "./routes/resources.js";
import notificationRoutes from "./routes/notifications.js";
import discussionRoutes from "./routes/discussions.js";
import feedbackRoutes from "./routes/feedback.js";
import conceptGraphRoutes from "./routes/concept-graph.js";
import analyticsRoutes from "./routes/analytics.js";
import conversationRoutes from "./routes/conversations.js";

const app = express();
const PORT = process.env.PORT || 5000;

const configuredRagServiceUrl = process.env.RAG_SERVICE_URL || "http://localhost:8001";
const RAG_SERVICE_URL = /^https?:\/\//i.test(configuredRagServiceUrl)
  ? configuredRagServiceUrl
  : `https://${configuredRagServiceUrl}`;
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middlewares
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and local CLI/test calls without an Origin header.
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "AI Tutor API Backend (Supabase)", timestamp: new Date().toISOString() });
});

// REST API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/escalations", escalationRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/concept-graph", conceptGraphRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/conversations", conversationRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Express Error Handler]:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ── Python RAG service health probe ─────────────────────────────────────────
async function checkRagServiceHealth() {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      console.log(`[Startup] ✅ Python RAG service is reachable at ${RAG_SERVICE_URL}`);
    } else {
      console.warn(
        `[Startup] ⚠️  Python RAG service returned HTTP ${res.status} — ` +
          `Ask Tutor will degrade gracefully until the service is healthy.`,
      );
    }
  } catch {
    console.warn(
      `[Startup] ⚠️  Python RAG service is UNREACHABLE at ${RAG_SERVICE_URL}\n` +
        `         → Make sure the Python service is running: cd ml_service && uvicorn main:app --port 8001\n` +
        `         → Ask Tutor will still escalate gracefully, but no real answers will be generated.`,
    );
  }
}

// Start Express server after connecting to Supabase
async function startServer() {
  await connectSupabase();

  // Non-blocking health check — a warning, never a crash
  checkRagServiceHealth();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Backend] Server listening on port ${PORT}`);
    console.log(`[Express Backend] Allowed web origins: ${allowedOrigins.join(", ")}`);
  });
}

startServer();

export default app;
