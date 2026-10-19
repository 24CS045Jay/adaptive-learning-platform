/**
 * lib/recommendation-engine.js — Personalized Learning Recommendation Engine
 *
 * Discovers candidates dynamically from enrolled courses, approved documents, and quizzes.
 * Computes explainable multi-factor priority scores, persists recommendations in audit_logs,
 * and tracks interactions (impressions, selection, completion, dismissal, feedback).
 */

import {
  Subject,
  Document,
  Quiz,
  Question,
  TopicMastery,
  Attempt,
  AuditLog,
} from "../models/index.js";
import { computeTopicFeatures } from "./learning-pipeline.js";

/**
 * Normalizes scores between 0 and 1.
 */
function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates personalized recommendations for a student.
 * Discovers topics dynamically from the student's enrolled courses.
 *
 * @param {string} studentId
 * @param {object} options - { courseId, limit }
 */
export async function generateRecommendationsForStudent(studentId, options = {}) {
  const cleanStudentId = String(studentId).trim();
  const targetCourseId = options.courseId ? String(options.courseId).trim() : null;
  const limit = options.limit || 5;

  // 1. Identify enrolled subjects
  let enrolledSubjects = [];
  try {
    const filter = {};
    if (targetCourseId) {
      filter._id = targetCourseId;
    }
    const allSubjects = await Subject.find(filter);

    // Filter to subjects student is enrolled in, or all subjects if faculty/admin testing
    enrolledSubjects = allSubjects.filter((s) => {
      const list = s.enrolledStudentIds || [];
      return (
        list.includes(cleanStudentId) ||
        list.length === 0 || // Open enrollment fallback
        targetCourseId === s.id ||
        targetCourseId === s._id
      );
    });

    // If student isn't explicitly enrolled in any, use available subjects so they aren't blocked
    if (enrolledSubjects.length === 0 && allSubjects.length > 0) {
      enrolledSubjects = allSubjects.slice(0, 2);
    }
  } catch (err) {
    console.error("[Recommendation Engine] Failed to query subjects:", err.message);
    return [];
  }

  if (enrolledSubjects.length === 0) {
    return [];
  }

  // 2. Fetch past recommendation interactions to prevent duplicate fatigue
  const dismissedTopicSet = new Set();
  const completedTopicSet = new Set();
  try {
    const pastInteractions = await AuditLog.find({
      actor_id: cleanStudentId,
      action: "RECOMMENDATION_INTERACTION",
    }).sort({ createdAt: -1 }).limit(50);

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    pastInteractions.forEach((log) => {
      const details = log.details || {};
      const topic = details.topic;
      const type = details.eventType;
      const time = new Date(log.created_at || log.createdAt).getTime();

      if (time > oneDayAgo && topic) {
        if (type === "dismissed") dismissedTopicSet.add(topic.toLowerCase());
        if (type === "completed") completedTopicSet.add(topic.toLowerCase());
      }
    });
  } catch (e) {
    console.warn("[Recommendation Engine] Interaction history query notice:", e.message);
  }

  // 3. For each enrolled subject, discover candidate topics and learning materials
  const candidateList = [];

  for (const subject of enrolledSubjects) {
    const subjectId = String(subject.id || subject._id);
    const subjectCode = subject.code || "COURSE";
    const subjectName = subject.name || subjectCode;

    // A. Query approved documents
    let approvedDocs = [];
    try {
      approvedDocs = await Document.find({ subjectId, status: "approved" });
    } catch {}

    // B. Query available quizzes & questions
    let subjectQuizzes = [];
    let subjectQuestions = [];
    try {
      subjectQuizzes = await Quiz.find({ subjectId });
      const quizIds = subjectQuizzes.map((q) => q.id || q._id);
      if (quizIds.length > 0) {
        subjectQuestions = await Question.find({ quizId: { $in: quizIds } });
      }
    } catch {}

    // C. Query student's recorded topic mastery for this subject
    let recordedMasteries = [];
    try {
      recordedMasteries = await TopicMastery.find({ user_id: cleanStudentId, subject_id: subjectId });
    } catch {}

    // D. Extract all distinct topics in this subject from documents, quizzes, and mastery
    const topicSet = new Set();
    approvedDocs.forEach((d) => {
      const tag = d.topicTag || d.unit || "";
      if (tag && tag.trim()) topicSet.add(tag.trim());
    });
    subjectQuestions.forEach((q) => {
      const tag = q.topicTag || "";
      if (tag && tag.trim()) topicSet.add(tag.trim());
    });
    recordedMasteries.forEach((m) => {
      if (m.topic && m.topic.trim()) topicSet.add(m.topic.trim());
    });

    // If no specific topic tags exist yet, extract from document titles or unit names
    if (topicSet.size === 0) {
      approvedDocs.forEach((d) => {
        const title = (d.fileName || "").replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        if (title.trim()) topicSet.add(title.trim());
      });
    }

    // E. Evaluate each topic candidate
    for (const topic of topicSet) {
      const topicLower = topic.toLowerCase();

      // Find relevant document
      const matchingDoc = approvedDocs.find((d) => {
        const tag = (d.topicTag || d.unit || d.fileName || "").toLowerCase();
        return tag.includes(topicLower) || topicLower.includes(tag);
      }) || approvedDocs[0] || null;

      // Find relevant quiz
      const matchingQuestion = subjectQuestions.find((q) => {
        const tag = (q.topicTag || "").toLowerCase();
        return tag.includes(topicLower) || topicLower.includes(tag);
      });
      const matchingQuiz = matchingQuestion
        ? subjectQuizzes.find((qz) => String(qz.id || qz._id) === String(matchingQuestion.quizId))
        : subjectQuizzes[0] || null;

      // Find student's current mastery record
      const masteryRecord = recordedMasteries.find((m) => m.topic.toLowerCase() === topicLower);
      const hasAttempts = masteryRecord && masteryRecord.total_attempts > 0;
      const masteryScore = hasAttempts ? (masteryRecord.score || 0) : null;

      // ── Explainable Multi-Factor Scoring ──────────────────────────────────────
      // 1. Mastery Deficit: higher score when student is struggling (<60%) or unassessed
      let masteryDeficit = 0.5; // neutral baseline if unassessed
      if (masteryScore !== null) {
        masteryDeficit = clamp((100 - masteryScore) / 100);
      }

      // 2. Recency Need: higher score if student hasn't practiced recently
      let recencyNeed = 0.5;
      if (masteryRecord && masteryRecord.last_evaluated) {
        const daysSince = (Date.now() - new Date(masteryRecord.last_evaluated).getTime()) / (1000 * 60 * 60 * 24);
        recencyNeed = clamp(daysSince / 7);
      }

      // 3. Resource Availability: boost if verified document or quiz exists
      const docBonus = matchingDoc ? 0.5 : 0.0;
      const quizBonus = matchingQuiz ? 0.5 : 0.0;
      const resourceAvailability = docBonus + quizBonus;

      // 4. Fatigue Penalty: reduce priority if student recently dismissed or completed this topic
      let fatiguePenalty = 0.0;
      if (dismissedTopicSet.has(topicLower)) fatiguePenalty += 0.5;
      if (completedTopicSet.has(topicLower)) fatiguePenalty += 0.3;

      // Multi-factor weighted score
      const urgencyScore = clamp(
        0.45 * masteryDeficit +
        0.25 * recencyNeed +
        0.30 * resourceAvailability -
        fatiguePenalty
      );

      // Determine Pedagogical Intervention Type & Explanation
      let type = "ask_tutor";
      let title = `Review ${topic}`;
      let reason = "";
      let urgency = "medium";
      let resourceId = null;
      let resourceName = "";
      let resourceType = "tutor";

      if (masteryScore !== null && masteryScore < 60) {
        urgency = "high";
        if (matchingDoc) {
          type = "review_material";
          title = `Study notes on ${topic}`;
          reason = `Low accuracy score (${masteryScore}%) recorded on recent questions. Review authorized faculty material to reinforce core principles.`;
          resourceId = String(matchingDoc.id || matchingDoc._id);
          resourceName = matchingDoc.fileName || matchingDoc.file_name;
          resourceType = matchingDoc.fileType || "pdf";
        } else {
          type = "ask_tutor";
          title = `Consult AI Tutor on ${topic}`;
          reason = `Demonstrated difficulty (${masteryScore}%). Ask EduSense AI Tutor for an intuitive step-by-step worked example.`;
        }
      } else if (masteryScore === null) {
        // Onboarding / Unpracticed topic
        urgency = "medium";
        if (matchingQuiz) {
          type = "practice_quiz";
          title = `Diagnostic Quiz: ${topic}`;
          reason = `No assessment attempts recorded yet for this course topic. Take a diagnostic practice quiz to establish baseline mastery.`;
          resourceId = String(matchingQuiz.id || matchingQuiz._id);
          resourceName = matchingQuiz.title;
          resourceType = "quiz";
        } else if (matchingDoc) {
          type = "review_material";
          title = `Read introduction to ${topic}`;
          reason = `Newly published course material. Review lecture slides before upcoming module assessments.`;
          resourceId = String(matchingDoc.id || matchingDoc._id);
          resourceName = matchingDoc.fileName || matchingDoc.file_name;
          resourceType = matchingDoc.fileType || "pdf";
        } else {
          type = "ask_tutor";
          title = `Explore ${topic} with AI Tutor`;
          reason = `Explore core concepts and syllabus objectives with your AI Tutor.`;
        }
      } else {
        // Spaced repetition reinforcement for developing / strong topics
        urgency = "low";
        if (matchingQuiz) {
          type = "practice_quiz";
          title = `Refresher Quiz: ${topic}`;
          reason = `Periodic spaced repetition to maintain long-term retention of previously mastered concepts.`;
          resourceId = String(matchingQuiz.id || matchingQuiz._id);
          resourceName = matchingQuiz.title;
          resourceType = "quiz";
        } else {
          type = "review_material";
          title = `Periodic review: ${topic}`;
          reason = `Periodic reinforcement recommended before examination period.`;
          if (matchingDoc) {
            resourceId = String(matchingDoc.id || matchingDoc._id);
            resourceName = matchingDoc.fileName;
            resourceType = matchingDoc.fileType || "pdf";
          }
        }
      }

      candidateList.push({
        id: `rec-${cleanStudentId.slice(-6)}-${Math.random().toString(36).slice(2, 8)}`,
        studentId: cleanStudentId,
        courseId: subjectId,
        subjectCode,
        subjectName,
        topic,
        type,
        title,
        reason,
        urgency,
        urgencyScore: parseFloat(urgencyScore.toFixed(3)),
        resourceId,
        resourceName,
        resourceType,
        currentMasteryScore: masteryScore,
        strategy: "explainable_multi_factor_v1",
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 4. Rank candidates by urgencyScore descending
  candidateList.sort((a, b) => b.urgencyScore - a.urgencyScore);
  const selected = candidateList.slice(0, limit);

  // 5. Persist recommendations into audit_logs for traceability
  if (selected.length > 0) {
    try {
      await AuditLog.create({
        actor_id: cleanStudentId,
        action: "RECOMMENDATION_BATCH_GENERATED",
        target: cleanStudentId,
        details: {
          strategy: "explainable_multi_factor_v1",
          recommendationsCount: selected.length,
          topTopics: selected.map((r) => r.topic),
          items: selected,
        },
      });
    } catch (logErr) {
      console.warn("[Recommendation Engine] Failed to record generation audit log:", logErr.message);
    }
  }

  return selected;
}

/**
 * Records student interaction with a recommendation (viewed, selected, completed, dismissed, feedback).
 */
export async function recordRecommendationInteraction({
  recommendationId,
  studentId,
  topic,
  courseId,
  eventType,
  feedbackValue,
}) {
  const validEvents = ["viewed", "selected", "completed", "dismissed", "feedback"];
  if (!validEvents.includes(eventType)) {
    throw new Error(`Invalid interaction eventType: ${eventType}. Allowed: ${validEvents.join(", ")}`);
  }

  const logEntry = await AuditLog.create({
    actor_id: String(studentId).trim(),
    action: "RECOMMENDATION_INTERACTION",
    target: String(recommendationId || "unknown_rec"),
    details: {
      topic: topic || "",
      courseId: courseId || "",
      eventType,
      feedbackValue: feedbackValue ?? null,
      timestamp: new Date().toISOString(),
    },
  });

  return logEntry;
}

/**
 * Computes authorized course-level faculty recommendation insights.
 */
export async function getFacultyRecommendationInsights(subjectId) {
  try {
    const cleanSubjId = subjectId ? String(subjectId).trim() : null;

    // 1. Fetch all recommendation interaction logs
    const filter = { action: "RECOMMENDATION_INTERACTION" };
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(200);

    const topicStats = {};
    let totalImpressions = 0;
    let totalSelected = 0;
    let totalCompleted = 0;
    let totalDismissed = 0;

    logs.forEach((log) => {
      const details = log.details || {};
      if (cleanSubjId && details.courseId && details.courseId !== cleanSubjId) return;

      const topic = details.topic || "General";
      const event = details.eventType;

      if (!topicStats[topic]) {
        topicStats[topic] = { topic, impressions: 0, selections: 0, completions: 0, dismissals: 0 };
      }

      if (event === "viewed") {
        totalImpressions++;
        topicStats[topic].impressions++;
      } else if (event === "selected") {
        totalSelected++;
        topicStats[topic].selections++;
      } else if (event === "completed") {
        totalCompleted++;
        topicStats[topic].completions++;
      } else if (event === "dismissed") {
        totalDismissed++;
        topicStats[topic].dismissals++;
      }
    });

    // 2. Identify weak topic gaps across class from TopicMastery
    const masteryFilter = cleanSubjId ? { subject_id: cleanSubjId } : {};
    const masteries = await TopicMastery.find(masteryFilter);

    const topicGaps = {};
    masteries.forEach((m) => {
      const t = m.topic;
      if (!topicGaps[t]) topicGaps[t] = { topic: t, totalScores: 0, count: 0, strugglingCount: 0 };
      topicGaps[t].totalScores += m.score || 0;
      topicGaps[t].count++;
      if ((m.score || 0) < 60) topicGaps[t].strugglingCount++;
    });

    const gapList = Object.values(topicGaps).map((g) => ({
      topic: g.topic,
      avgScore: g.count > 0 ? Math.round(g.totalScores / g.count) : 0,
      studentsEvaluated: g.count,
      studentsStruggling: g.strugglingCount,
      status: g.avgScore < 60 ? "critical_gap" : g.avgScore < 80 ? "developing" : "mastered",
    }));

    gapList.sort((a, b) => a.avgScore - b.avgScore);

    return {
      success: true,
      subjectId: cleanSubjId,
      overallEngagement: {
        totalImpressions,
        totalSelected,
        totalCompleted,
        totalDismissed,
        completionRatePct: totalSelected > 0 ? Math.round((totalCompleted / totalSelected) * 100) : 0,
      },
      topicBreakdown: gapList,
      topicInteractions: Object.values(topicStats),
    };
  } catch (err) {
    console.error("[Recommendation Engine] Failed to compute faculty insights:", err.message);
    throw err;
  }
}
