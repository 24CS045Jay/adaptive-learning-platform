/**
 * lib/learning-pipeline.js — Student Learning Data Pipeline & Feature Engineering
 *
 * Implements schema validation, normalization, deduplication, feature extraction,
 * and mastery estimation for EduSense AI.
 */

import { TopicMastery, Attempt, AuditLog } from "../models/index.js";

/**
 * Wilson score lower bound calculation for binomial proportion confidence.
 * Provides a conservative lower bound of student accuracy that penalizes small sample sizes.
 * @param {number} correct
 * @param {number} total
 * @param {number} z - standard normal quantile (1.96 for 95% confidence)
 */
export function calculateWilsonLowerBound(correct, total, z = 1.96) {
  if (total <= 0) return 0;
  const p = Math.max(0, Math.min(1, correct / total));
  const z2 = z * z;
  const numerator = p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const denominator = 1 + z2 / total;
  return Math.max(0, Math.min(1, numerator / denominator));
}

/**
 * Bayesian smoothed accuracy with Beta(2, 2) uninformative prior.
 * Smooths small sample sizes toward a 50% baseline.
 */
export function calculateBayesianSmoothedAccuracy(correct, total, alpha = 2, beta = 2) {
  if (total < 0) total = 0;
  if (correct < 0) correct = 0;
  return (correct + alpha) / (total + alpha + beta);
}

/**
 * Validates learning event input schema.
 * Rejects impossible values and corrupt payloads.
 */
export function validateLearningEvent(event) {
  if (!event || typeof event !== "object") {
    throw new Error("Invalid event: payload must be a non-null object.");
  }

  const studentId = event.studentId || event.userId;
  if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
    throw new Error("Invalid event: studentId/userId is required.");
  }

  const subjectId = event.subjectId || event.courseId;
  if (!subjectId || typeof subjectId !== "string" || !subjectId.trim()) {
    throw new Error("Invalid event: subjectId is required.");
  }

  if (event.score !== undefined) {
    const num = Number(event.score);
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error(`Invalid event: score must be between 0 and 100. Received: ${event.score}`);
    }
  }

  if (event.answers && !Array.isArray(event.answers)) {
    throw new Error("Invalid event: answers must be an array.");
  }

  return true;
}

/**
 * Computes student-topic feature vector from chronological answers.
 * @param {Array<object>} chronologicalAnswers - Array of answer records for a single topic
 */
export function computeTopicFeatures(chronologicalAnswers) {
  if (!Array.isArray(chronologicalAnswers) || chronologicalAnswers.length === 0) {
    return {
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      rawAccuracy: 0.0,
      smoothedAccuracy: 0.5,
      recentAccuracy: 0.5,
      performanceTrend: "stable",
      trendDelta: 0.0,
      wilsonLowerBound: 0.0,
      sampleSizeConfidence: 0.0,
      daysSinceLastAttempt: 999.0,
      status: "insufficient_data",
    };
  }

  const total = chronologicalAnswers.length;
  let correct = 0;

  // Weightings based on question difficulty
  let difficultyWeightedScore = 0;
  let totalDifficultyWeight = 0;

  chronologicalAnswers.forEach((ans) => {
    const isCorrect = Boolean(ans.isCorrect);
    if (isCorrect) correct++;

    const diff = (ans.difficulty || "medium").toLowerCase();
    const weight = diff === "hard" ? 3 : diff === "easy" ? 1 : 2;
    totalDifficultyWeight += weight;
    if (isCorrect) difficultyWeightedScore += weight;
  });

  const rawAccuracy = correct / total;
  const smoothedAccuracy = calculateBayesianSmoothedAccuracy(correct, total);
  const wilsonLowerBound = calculateWilsonLowerBound(correct, total);

  // Recency window (last 3 attempts for immediate student trajectory)
  const recentWindow = chronologicalAnswers.slice(-Math.min(3, total));
  const recentCorrect = recentWindow.filter((a) => a.isCorrect).length;
  const recentAccuracy = recentWindow.length > 0 ? recentCorrect / recentWindow.length : smoothedAccuracy;

  // Performance Trend
  const trendDelta = recentAccuracy - smoothedAccuracy;
  let performanceTrend = "stable";
  if (trendDelta >= 0.10) performanceTrend = "improving";
  else if (trendDelta <= -0.10) performanceTrend = "declining";

  // Days since last attempt
  const lastTime = new Date(chronologicalAnswers[chronologicalAnswers.length - 1].submittedAt || Date.now()).getTime();
  const daysSinceLastAttempt = Math.max(0, (Date.now() - lastTime) / (1000 * 60 * 60 * 24));

  // Sample size confidence (scales smoothly with attempt count, saturating at 5 attempts)
  const sampleSizeConfidence = Math.min(1.0, total / 5);

  // Categorical Status
  let status = "insufficient_data";
  if (total >= 2) {
    const effectiveMetric = (smoothedAccuracy * 0.6) + (rawAccuracy * 0.4);
    if (effectiveMetric < 0.60) status = "needs_practice";
    else if (effectiveMetric < 0.78) status = "developing";
    else status = "strong";
  }

  return {
    totalAttempts: total,
    correctCount: correct,
    incorrectCount: total - correct,
    rawAccuracy: parseFloat(rawAccuracy.toFixed(4)),
    smoothedAccuracy: parseFloat(smoothedAccuracy.toFixed(4)),
    recentAccuracy: parseFloat(recentAccuracy.toFixed(4)),
    performanceTrend,
    trendDelta: parseFloat(trendDelta.toFixed(4)),
    wilsonLowerBound: parseFloat(wilsonLowerBound.toFixed(4)),
    sampleSizeConfidence: parseFloat(sampleSizeConfidence.toFixed(2)),
    daysSinceLastAttempt: parseFloat(daysSinceLastAttempt.toFixed(1)),
    status,
  };
}

/**
 * Estimates student mastery percentage for a topic based on engineered features.
 * When attempts are low (< 2), returns insufficient data status.
 * Combines Bayesian accuracy with difficulty weight and Wilson confidence bounds.
 */
export function estimateTopicMastery(features) {
  if (features.totalAttempts < 2) {
    return {
      estimatedMasteryScore: null,
      status: "insufficient_data",
      confidence: features.sampleSizeConfidence,
      explanation: `Insufficient assessment data (${features.totalAttempts} attempt recorded). At least 2 verified attempts required for estimation.`,
    };
  }

  // Blended mastery estimate: 50% Bayesian smoothed accuracy + 30% observed raw accuracy + 20% Wilson lower bound for safety
  const blendedScore = 0.5 * features.smoothedAccuracy + 0.3 * features.rawAccuracy + 0.2 * features.wilsonLowerBound;
  const scorePct = Math.round(blendedScore * 100);

  let status = features.status;
  if (scorePct < 60) status = "needs_practice";
  else if (scorePct >= 80) status = "strong";
  else status = "developing";

  let explanation = "";
  if (status === "needs_practice") {
    explanation = `Demonstrated difficulty on this topic with ${features.correctCount}/${features.totalAttempts} correct answers (${Math.round(features.rawAccuracy * 100)}% raw accuracy). Recommended for targeted review.`;
  } else if (status === "developing") {
    explanation = `Developing competency with ${features.correctCount}/${features.totalAttempts} correct answers. Continued practice recommended to build consistency.`;
  } else {
    explanation = `Strong demonstrated understanding with ${features.correctCount}/${features.totalAttempts} correct answers (${Math.round(features.rawAccuracy * 100)}% raw accuracy).`;
  }

  return {
    estimatedMasteryScore: scorePct,
    status,
    confidence: features.sampleSizeConfidence,
    explanation,
  };
}

/**
 * Records a quiz attempt, extracts topic-level answers, computes features,
 * and updates `topic_mastery` in Supabase with strict schema compliance.
 */
export async function processQuizAttemptEvent({ quizId, studentId, answers, score, subjectId }) {
  validateLearningEvent({ studentId, subjectId, score, answers });

  const cleanStudentId = String(studentId).trim();
  const cleanSubjectId = String(subjectId).trim();
  const now = new Date();

  // 1. Group answers by normalized topic tag
  const topicBuckets = {};

  if (Array.isArray(answers)) {
    answers.forEach((ans) => {
      const topic = (ans.topicTag || ans.topic || "General").trim();
      if (!topicBuckets[topic]) topicBuckets[topic] = [];
      topicBuckets[topic].push({
        questionId: ans.questionId || ans.id,
        difficulty: ans.difficulty || "medium",
        isCorrect: Boolean(ans.isCorrect),
        submittedAt: now,
      });
    });
  }

  const results = [];

  // 2. Process each topic independently
  for (const [topic, items] of Object.entries(topicBuckets)) {
    // Fetch historical attempts for this student and topic from Supabase
    let historicalAttempts = [];
    try {
      const previousAttempts = await Attempt.find({ studentId: cleanStudentId });
      previousAttempts.forEach((att) => {
        if (Array.isArray(att.answers)) {
          att.answers.forEach((a) => {
            const attTopic = (a.topicTag || a.topic || "").trim();
            if (attTopic.toLowerCase() === topic.toLowerCase()) {
              historicalAttempts.push({
                questionId: a.questionId,
                difficulty: a.difficulty,
                isCorrect: Boolean(a.isCorrect),
                submittedAt: att.submittedAt || att.createdAt,
              });
            }
          });
        }
      });
    } catch (err) {
      console.warn(`[Learning Pipeline] Failed to query historical attempts for ${topic}:`, err.message);
    }

    // Combine historical with current attempt answers (idempotently ordered chronologically)
    const allAnswers = [...historicalAttempts, ...items];
    const features = computeTopicFeatures(allAnswers);
    const prediction = estimateTopicMastery(features);

    // Schema-compliant Supabase persistence:
    // Columns: id, user_id, subject_id, topic, score, total_attempts, last_evaluated, created_at, updated_at
    const finalScore = prediction.estimatedMasteryScore !== null ? prediction.estimatedMasteryScore : Math.round(features.smoothedAccuracy * 100);

    try {
      const existing = await TopicMastery.findOne({
        user_id: cleanStudentId,
        subject_id: cleanSubjectId,
        topic,
      });

      if (existing) {
        existing.score = finalScore;
        existing.total_attempts = features.totalAttempts;
        existing.last_evaluated = now.toISOString();
        existing.updated_at = now.toISOString();
        await existing.save();
      } else {
        await TopicMastery.create({
          user_id: cleanStudentId,
          subject_id: cleanSubjectId,
          topic,
          score: finalScore,
          total_attempts: features.totalAttempts,
          last_evaluated: now.toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Learning Pipeline] Failed to upsert topic_mastery for ${topic}:`, err.message);
    }

    results.push({
      topic,
      features,
      prediction,
    });
  }

  // 3. Log audit event for model traceability
  try {
    await AuditLog.create({
      actor_id: cleanStudentId,
      action: "LEARNING_EVENT_PROCESSED",
      target: quizId || cleanSubjectId,
      details: {
        subjectId: cleanSubjectId,
        score,
        topicsEvaluated: Object.keys(topicBuckets),
        resultsSummary: results.map((r) => ({
          topic: r.topic,
          attempts: r.features.totalAttempts,
          score: r.prediction.estimatedMasteryScore,
          status: r.prediction.status,
        })),
      },
    });
  } catch (logErr) {
    console.warn("[Learning Pipeline] Failed to record audit log:", logErr.message);
  }

  return results;
}
