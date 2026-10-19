import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  TopicMastery,
  Attempt,
  User,
  Subject,
  AuditLog,
  Question,
  Quiz,
  Document,
} from "../models/index.js";
import {
  generateRecommendationsForStudent,
  recordRecommendationInteraction,
  getFacultyRecommendationInsights,
} from "../lib/recommendation-engine.js";

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/adaptive/profile
 * Returns the student's authentic mastery profile, weak topics, and active preferences.
 * When no attempts exist, returns a transparent insufficient_data state (no fake mock data).
 */
router.get("/profile", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();

    // 1. Fetch preferences from AuditLog
    let prefs = {
      studentId,
      explanationLevel: "intermediate",
      preferredLanguage: "en",
      dailyGoalMinutes: 30,
      enableSpacedRepetition: true,
      updatedAt: new Date().toISOString(),
    };

    try {
      const prefLog = await AuditLog.findOne({
        actor_id: studentId,
        action: "LEARNER_PREFERENCE",
      });
      if (prefLog && prefLog.details) {
        prefs = { ...prefs, ...prefLog.details, studentId };
      }
    } catch (e) {
      console.warn("[Adaptive API] Error fetching preference audit log:", e.message);
    }

    // 2. Fetch real topic masteries from TopicMastery table
    let masteries = [];
    try {
      const rows = await TopicMastery.find({ user_id: studentId });
      masteries = (rows || []).map((m) => {
        const score = typeof m.score === "number" ? m.score : Number(m.score || 0);
        const attempts = typeof m.total_attempts === "number" ? m.total_attempts : Number(m.totalAttempts || m.total_attempts || 0);

        let status = "insufficient_data";
        if (attempts >= 2) {
          if (score < 60) status = "needs_practice";
          else if (score < 80) status = "developing";
          else status = "strong";
        }

        return {
          id: String(m.id || m._id),
          studentId,
          subjectId: m.subject_id || m.subjectId,
          topic: m.topic,
          score,
          totalAttempts: attempts,
          lastEvaluated: m.last_evaluated || m.updated_at || m.created_at,
          status,
          masteryLabel: status === "strong" ? "mastered" : status === "needs_practice" ? "weak" : "proficient",
        };
      });
    } catch (e) {
      console.warn("[Adaptive API] Error fetching topic masteries:", e.message);
    }

    // 3. Compute aggregate statistics from real data
    const totalTopics = masteries.length;
    const evaluatedMasteries = masteries.filter((m) => m.totalAttempts >= 2);

    const avgScore = evaluatedMasteries.length > 0
      ? Math.round(evaluatedMasteries.reduce((acc, m) => acc + (m.score || 0), 0) / evaluatedMasteries.length)
      : null;

    const weakTopics = masteries.filter((m) => m.status === "needs_practice" || (m.totalAttempts >= 2 && m.score < 60));
    const masteredTopics = masteries.filter((m) => m.status === "strong" || (m.totalAttempts >= 2 && m.score >= 80));

    // 4. Compute spaced-repetition due topics (items practiced > 2 days ago or weak)
    const twoDaysAgo = Date.now() - 86400000 * 2;
    const reviewDue = masteries.filter((m) => {
      const practiceTime = m.lastEvaluated ? new Date(m.lastEvaluated).getTime() : 0;
      return (practiceTime < twoDaysAgo && m.totalAttempts > 0) || m.status === "needs_practice";
    });

    // 5. Build structured LearnerKnowledgeProfile for Adaptive RAG
    const demonstrated = masteries
      .filter((m) => m.score >= 75 || m.status === "strong")
      .map((m) => m.topic);
    const needingPractice = masteries
      .filter((m) => m.status === "needs_practice" || (m.totalAttempts >= 1 && m.score < 65))
      .map((m) => m.topic);

    let estimatedLevel = "developing";
    if (avgScore !== null) {
      if (avgScore >= 85 && evaluatedMasteries.length >= 3) estimatedLevel = "advanced";
      else if (avgScore >= 70) estimatedLevel = "proficient";
      else if (avgScore >= 55) estimatedLevel = "developing";
      else estimatedLevel = "beginner";
    } else if (prefs.explanationLevel) {
      estimatedLevel = prefs.explanationLevel === "intermediate" ? "developing" : prefs.explanationLevel;
    }

    const confidence = evaluatedMasteries.length >= 4 ? 0.9 : evaluatedMasteries.length >= 2 ? 0.7 : evaluatedMasteries.length >= 1 ? 0.5 : 0.25;

    let recentScores = [];
    try {
      const attempts = await Attempt.find({ student_id: studentId });
      recentScores = (attempts || [])
        .slice(-5)
        .map((a) => (typeof a.score === "number" ? a.score : Number(a.score || 0)));
    } catch {
      // non-fatal
    }

    const learnerKnowledgeProfile = {
      student_id: studentId,
      estimated_mastery_level: estimatedLevel,
      concepts_demonstrated: demonstrated,
      concepts_needing_practice: needingPractice,
      recent_quiz_scores: recentScores,
      recurring_mistakes: [],
      preferred_explanation_depth: prefs.explanationLevel || "developing",
      preferred_language: prefs.preferredLanguage || "en",
      preferred_teaching_mode: prefs.preferredTeachingMode || "ask_tutor",
      last_assessed_at: masteries[0]?.lastEvaluated || new Date().toISOString(),
      evidence_sources: masteries.map((m) => ({
        source: "topic_mastery",
        topic: m.topic,
        score: m.score,
        attempts: m.totalAttempts,
        timestamp: m.lastEvaluated,
      })),
      confidence_in_mastery_estimate: confidence,
    };

    res.json({
      success: true,
      student: {
        id: studentId,
        name: req.user.name,
        email: req.user.email,
      },
      hasData: evaluatedMasteries.length > 0,
      preferences: prefs,
      learnerKnowledgeProfile,
      stats: {
        overallMasteryPct: avgScore,
        totalTopicsTracked: totalTopics,
        evaluatedTopicsCount: evaluatedMasteries.length,
        weakCount: weakTopics.length,
        masteredCount: masteredTopics.length,
        reviewDueCount: reviewDue.length,
      },
      topicMasteries: masteries,
      weakTopics,
      spacedRepetitionQueue: reviewDue,
    });
  } catch (error) {
    console.error("[Adaptive API] Error fetching student profile:", error);
    res.status(500).json({ error: "Failed to fetch adaptive learner profile." });
  }
});

/**
 * PUT /api/adaptive/preferences
 * Student updates their personal learning preferences
 */
router.put("/preferences", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();
    const { explanationLevel, preferredLanguage, preferredTeachingMode, dailyGoalMinutes, enableSpacedRepetition } = req.body;

    const validLevels = ["beginner", "intermediate", "developing", "proficient", "advanced"];
    const validLanguages = ["en", "gu", "hi", "mr", "bn", "ta", "te", "es", "fr"];

    const updated = {
      studentId,
      explanationLevel: validLevels.includes(explanationLevel) ? explanationLevel : "intermediate",
      preferredLanguage: validLanguages.includes(preferredLanguage) ? preferredLanguage : "en",
      preferredTeachingMode: preferredTeachingMode || "ask_tutor",
      dailyGoalMinutes: typeof dailyGoalMinutes === "number" ? Math.max(10, Math.min(180, dailyGoalMinutes)) : 30,
      enableSpacedRepetition: typeof enableSpacedRepetition === "boolean" ? enableSpacedRepetition : true,
      updatedAt: new Date().toISOString(),
    };

    // Persist to audit_logs
    try {
      const existing = await AuditLog.findOne({
        actor_id: studentId,
        action: "LEARNER_PREFERENCE",
      });

      if (existing) {
        existing.details = updated;
        existing.updated_at = new Date().toISOString();
        await existing.save();
      } else {
        await AuditLog.create({
          actor_id: studentId,
          action: "LEARNER_PREFERENCE",
          target: studentId,
          details: updated,
        });
      }
    } catch (e) {
      console.warn("[Adaptive API] Error persisting preference audit log:", e.message);
    }

    res.json({
      success: true,
      message: "Learner preferences updated successfully.",
      preferences: updated,
    });
  } catch (error) {
    console.error("[Adaptive API] Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences." });
  }
});

/**
 * POST /api/adaptive/reset
 * Student resets their personal learning profile and preferences
 */
router.post("/reset", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();

    try {
      await TopicMastery.deleteMany({ user_id: studentId });
    } catch (e) {
      console.warn("[Adaptive API] Clear TopicMastery notice:", e.message);
    }

    const defaultPrefs = {
      studentId,
      explanationLevel: "developing",
      preferredLanguage: "en",
      preferredTeachingMode: "ask_tutor",
      dailyGoalMinutes: 30,
      enableSpacedRepetition: true,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = await AuditLog.findOne({
        actor_id: studentId,
        action: "LEARNER_PREFERENCE",
      });
      if (existing) {
        existing.details = defaultPrefs;
        existing.updated_at = new Date().toISOString();
        await existing.save();
      }
    } catch (e) {
      console.warn("[Adaptive API] Reset audit log notice:", e.message);
    }

    res.json({
      success: true,
      message: "Learner personalization data successfully reset.",
      preferences: defaultPrefs,
    });
  } catch (error) {
    console.error("[Adaptive API] Error resetting personalization:", error);
    res.status(500).json({ error: "Failed to reset personalization data." });
  }
});

/**
 * POST /api/adaptive/evaluate-check
 * Evaluates student understanding check response and updates mastery
 */
router.post("/evaluate-check", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();
    const { question, studentAnswer, concept } = req.body;

    if (!question || !studentAnswer) {
      return res.status(400).json({ error: "question and studentAnswer are required." });
    }

    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || "univ-rag-internal-dev-token";
    const ragServiceUrl = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8001";

    const response = await fetch(`${ragServiceUrl}/adaptive/evaluate-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
      },
      body: JSON.stringify({
        student_id: studentId,
        question,
        student_answer: studentAnswer,
        concept: concept || "Understanding Check",
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `RAG service evaluation failed: ${errText}` });
    }

    const result = await response.json();

    // Update TopicMastery in DB if concept is specified
    if (concept && typeof result.score === "number") {
      try {
        let tm = await TopicMastery.findOne({ user_id: studentId, topic: concept });
        if (tm) {
          const prevScore = Number(tm.score || 0);
          const prevAttempts = Number(tm.total_attempts || 0);
          const newScore = Math.round((prevScore * prevAttempts + result.score) / (prevAttempts + 1));
          tm.score = newScore;
          tm.total_attempts = prevAttempts + 1;
          tm.last_evaluated = new Date().toISOString();
          await tm.save();
        } else {
          await TopicMastery.create({
            user_id: studentId,
            topic: concept,
            score: Math.round(result.score),
            total_attempts: 1,
            last_evaluated: new Date().toISOString(),
          });
        }
      } catch (tmErr) {
        console.warn("[Adaptive API] TopicMastery update notice:", tmErr.message);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("[Adaptive API] Error evaluating understanding check:", error);
    res.status(500).json({ error: "Failed to evaluate concept check." });
  }
});

/**
 * GET /api/adaptive/recommendations
 * Dynamically generated, explainable topic recommendations from real learning signals & course materials
 */
router.get("/recommendations", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();
    const courseId = req.query.courseId || req.query.subjectId;

    const recommendations = await generateRecommendationsForStudent(studentId, {
      courseId,
      limit: 6,
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error("[Adaptive API] Error generating recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations." });
  }
});

/**
 * POST /api/adaptive/recommendations/:id/interaction
 * Captures student interactions with recommendations (viewed, selected, completed, dismissed, feedback)
 */
router.post("/recommendations/:id/interaction", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();
    const recommendationId = req.params.id;
    const { eventType, topic, courseId, feedbackValue } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: "eventType is required ('viewed', 'selected', 'completed', 'dismissed', 'feedback')." });
    }

    const logEntry = await recordRecommendationInteraction({
      recommendationId,
      studentId,
      topic,
      courseId,
      eventType,
      feedbackValue,
    });

    res.json({
      success: true,
      message: `Recommendation ${eventType} interaction recorded.`,
      interactionId: String(logEntry.id || logEntry._id),
    });
  } catch (error) {
    console.error("[Adaptive API] Error recording recommendation interaction:", error);
    res.status(500).json({ error: error.message || "Failed to record recommendation interaction." });
  }
});

/**
 * POST /api/adaptive/practice-quiz
 * Generates an adaptive practice quiz dynamically from the question bank matching the topic or enrolled subject
 */
router.post("/practice-quiz", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const studentId = String(req.user.id || req.user._id).trim();
    const { topic, subjectId, difficulty = "medium" } = req.body;

    // 1. Search for actual questions in DB matching topic or subject
    let questions = [];
    try {
      if (topic) {
        questions = await Question.find({ topicTag: topic });
      }
      if (questions.length === 0 && subjectId) {
        const quizzes = await Quiz.find({ subjectId });
        const qIds = quizzes.map((q) => q.id || q._id);
        if (qIds.length > 0) {
          questions = await Question.find({ quizId: { $in: qIds } });
        }
      }
      if (questions.length === 0) {
        // Fallback: search all available questions
        questions = await Question.find({}).limit(5);
      }
    } catch (e) {
      console.warn("[Adaptive API] Error fetching practice questions:", e.message);
    }

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        topic: topic || "Course Topics",
        message: "No practice questions have been uploaded for this topic yet. Faculty can create assessment questions in Faculty Quizzes.",
        questions: [],
      });
    }

    const formattedQuestions = questions.slice(0, 5).map((q, idx) => ({
      id: String(q.id || q._id || `q-${idx}`),
      question: q.text,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: typeof q.correctOption === "number" ? q.correctOption : 0,
      difficulty: q.difficulty || difficulty,
      topicTag: q.topicTag || topic || "General",
    }));

    res.json({
      success: true,
      topic: topic || "Dynamic Practice Assessment",
      difficulty,
      questions: formattedQuestions,
    });
  } catch (error) {
    console.error("[Adaptive API] Error creating practice quiz:", error);
    res.status(500).json({ error: "Failed to generate practice quiz." });
  }
});

/**
 * GET /api/adaptive/faculty-analytics
 * Live aggregated topic mastery and engagement insights computed from real database records
 */
router.get("/faculty-analytics", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { subjectId } = req.query;
    const insights = await getFacultyRecommendationInsights(subjectId);
    res.json(insights);
  } catch (error) {
    console.error("[Adaptive API] Error fetching faculty analytics:", error);
    res.status(500).json({ error: "Failed to fetch faculty analytics." });
  }
});

export default router;
