import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { Quiz, Question, Attempt, TopicMastery, Subject } from "../models/index.js";
import { processQuizAttemptEvent } from "../lib/learning-pipeline.js";

const router = express.Router();

router.use(authenticate);

// ── GET /api/quizzes ────────────────────────────────────────────────────────
// List quizzes (Students see enrolled subjects' quizzes; Faculty/Admin see all or created)
router.get("/", async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) {
      filter.subjectId = subjectId;
    } else if (req.user.role === "student") {
      // Find subjects student is enrolled in
      const studentSubjects = await Subject.find({ enrolledStudentIds: req.user._id || req.user.id }).select("_id");
      const subjectIds = studentSubjects.map((s) => s._id);
      if (subjectIds.length > 0) {
        filter.subjectId = { $in: subjectIds };
      }
    }

    const quizzes = await Quiz.find(filter)
      .populate("subjectId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    // Attach questions count or questions list for each quiz
    const quizList = await Promise.all(
      quizzes.map(async (quiz) => {
        const questions = await Question.find({ quizId: quiz._id });
        return {
          ...quiz.toObject(),
          id: String(quiz._id),
          questions: questions.map((q) => ({
            ...q.toObject(),
            id: String(q._id),
          })),
        };
      })
    );

    res.json(quizList);
  } catch (error) {
    console.error("[Quizzes API] GET error:", error);
    res.status(500).json({ error: "Failed to fetch quizzes." });
  }
});

// ── GET /api/quizzes/:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate("subjectId", "name code")
      .populate("createdBy", "name email");

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found." });
    }

    const questions = await Question.find({ quizId: quiz._id });

    res.json({
      ...quiz.toObject(),
      id: String(quiz._id),
      questions: questions.map((q) => ({
        ...q.toObject(),
        id: String(q._id),
      })),
    });
  } catch (error) {
    console.error("[Quizzes API] GET /:id error:", error);
    res.status(500).json({ error: "Failed to fetch quiz details." });
  }
});

// ── POST /api/quizzes ───────────────────────────────────────────────────────
// Faculty / Admin create quiz with questions
router.post("/", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const { subjectId, title, isAiGenerated, questions } = req.body;

    if (!subjectId || !title) {
      return res.status(400).json({ error: "subjectId and title are required." });
    }

    const quiz = await Quiz.create({
      subjectId,
      title,
      createdBy: req.user._id || req.user.id,
      isAiGenerated: !!isAiGenerated,
    });

    let createdQuestions = [];
    if (Array.isArray(questions) && questions.length > 0) {
      const qDocs = questions.map((q) => ({
        quizId: quiz._id,
        text: q.text,
        options: q.options || [],
        correctOption: q.correctOption ?? q.correctAnswer ?? 0,
        topicTag: q.topicTag || q.topic || "",
        difficulty: q.difficulty || "medium",
      }));
      createdQuestions = await Question.insertMany(qDocs);
    }

    res.status(201).json({
      ...quiz.toObject(),
      id: String(quiz._id),
      questions: createdQuestions.map((q) => ({ ...q.toObject(), id: String(q._id) })),
    });
  } catch (error) {
    console.error("[Quizzes API] POST error:", error);
    res.status(500).json({ error: "Failed to create quiz." });
  }
});

// ── POST /api/quizzes/:id/attempt ──────────────────────────────────────────
// Student submits quiz answers -> calculate score, create Attempt, update TopicMastery
router.post("/:id/attempt", requireRole("student", "faculty", "admin"), async (req, res) => {
  try {
    const quizId = req.params.id;
    const { answers } = req.body; // Array of selected answers, e.g., [{ questionId, selectedOption }] or [index/value]

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found." });
    }

    const questions = await Question.find({ quizId });
    if (questions.length === 0) {
      return res.status(400).json({ error: "Quiz has no questions to evaluate." });
    }

    let correctCount = 0;
    const topicPerformance = {}; // topicTag -> { total: 0, correct: 0 }

    const enrichedAnswers = [];

    questions.forEach((q, index) => {
      let studentAnswer = null;
      if (Array.isArray(answers)) {
        if (typeof answers[index] === "object" && answers[index] !== null) {
          studentAnswer = answers[index].selectedOption ?? answers[index].answer;
        } else {
          studentAnswer = answers[index];
        }
      } else if (typeof answers === "object" && answers !== null) {
        studentAnswer = answers[q._id] ?? answers[String(q._id)] ?? answers[index];
      }

      const isCorrect = String(studentAnswer ?? "").trim().toLowerCase() === String(q.correctOption ?? "").trim().toLowerCase();
      if (isCorrect) {
        correctCount++;
      }

      const tag = q.topicTag || q.topic || "General";
      if (!topicPerformance[tag]) {
        topicPerformance[tag] = { total: 0, correct: 0 };
      }
      topicPerformance[tag].total++;
      if (isCorrect) {
        topicPerformance[tag].correct++;
      }

      enrichedAnswers.push({
        questionId: String(q._id || q.id),
        topicTag: tag,
        difficulty: q.difficulty || "medium",
        selectedOption: studentAnswer,
        correctOption: q.correctOption,
        isCorrect,
      });
    });

    const scorePct = Math.round((correctCount / questions.length) * 100);
    const studentId = req.user._id || req.user.id;

    // Create Attempt record with itemized answers
    const attempt = await Attempt.create({
      quizId,
      studentId: String(studentId),
      score: scorePct,
      answers: enrichedAnswers,
      submittedAt: new Date(),
    });

    // Process through the authentic Learning Data Pipeline
    let pipelineResults = [];
    try {
      pipelineResults = await processQuizAttemptEvent({
        quizId,
        studentId: String(studentId),
        answers: enrichedAnswers,
        score: scorePct,
        subjectId: String(quiz.subjectId),
      });
    } catch (pipelineErr) {
      console.warn("[Quizzes API] Pipeline processing warning:", pipelineErr.message);
    }

    res.json({
      attemptId: String(attempt._id || attempt.id),
      score: scorePct,
      correctCount,
      totalQuestions: questions.length,
      topicPerformance,
      pipelineResults,
    });
  } catch (error) {
    console.error("[Quizzes API] Attempt submit error:", error);
    res.status(500).json({ error: "Failed to process quiz attempt." });
  }
});

// ── DELETE /api/quizzes/:id ────────────────────────────────────────────────
router.delete("/:id", requireRole("faculty", "admin"), async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found." });
    }
    await Question.deleteMany({ quizId: req.params.id });
    res.json({ message: "Quiz deleted successfully." });
  } catch (error) {
    console.error("[Quizzes API] DELETE error:", error);
    res.status(500).json({ error: "Failed to delete quiz." });
  }
});

export default router;
