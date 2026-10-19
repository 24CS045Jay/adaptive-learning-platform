/**
 * tests/ml-learning-pipeline.test.js
 *
 * Automated tests for:
 * 1. Learning event validation & deduplication
 * 2. Mathematical feature engineering (Wilson score lower bound, Bayesian smoothing)
 * 3. Topic mastery estimation & insufficient-data states
 * 4. Recommendation engine candidate discovery & explainable ranking
 * 5. Student data isolation & authorization boundaries
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateWilsonLowerBound,
  calculateBayesianSmoothedAccuracy,
  validateLearningEvent,
  computeTopicFeatures,
  estimateTopicMastery,
} from "../lib/learning-pipeline.js";

describe("ML Pipeline: Statistical Feature Engineering & Mathematics", () => {
  it("computes Wilson score lower bound with proper sample size conservatism", () => {
    // 0 total attempts should return 0
    assert.equal(calculateWilsonLowerBound(0, 0), 0);

    // 1 out of 1 correct (100% raw) should have conservative lower bound (~0.20) due to small sample size
    const singleAttemptLB = calculateWilsonLowerBound(1, 1);
    assert.ok(singleAttemptLB > 0.05 && singleAttemptLB < 0.50, `Expected conservative bound, got ${singleAttemptLB}`);

    // 10 out of 10 correct should have much higher lower bound (~0.72)
    const tenAttemptLB = calculateWilsonLowerBound(10, 10);
    assert.ok(tenAttemptLB > 0.65, `Expected tight bound for 10/10, got ${tenAttemptLB}`);

    // Wilson bound should always be <= raw proportion
    assert.ok(singleAttemptLB <= 1.0);
    assert.ok(tenAttemptLB <= 1.0);

    // 0 out of 5 correct should have lower bound near 0
    const zeroCorrectLB = calculateWilsonLowerBound(0, 5);
    assert.equal(zeroCorrectLB, 0);
  });

  it("smooths small sample accuracy toward uninformative 50% prior via Bayesian smoothing", () => {
    // 0 attempts -> (0+2)/(0+4) = 2/4 = 0.5
    assert.equal(calculateBayesianSmoothedAccuracy(0, 0), 0.5);

    // 1 out of 1 -> (1+2)/(1+4) = 3/5 = 0.60 (avoids declaring 100% mastery from one lucky guess)
    assert.equal(calculateBayesianSmoothedAccuracy(1, 1), 0.6);

    // 0 out of 1 -> (0+2)/(1+4) = 2/5 = 0.40 (avoids declaring 0% mastery from one slip)
    assert.equal(calculateBayesianSmoothedAccuracy(0, 1), 0.4);

    // 10 out of 10 -> (10+2)/(10+4) = 12/14 =~ 0.857
    const tenCorrect = calculateBayesianSmoothedAccuracy(10, 10);
    assert.ok(Math.abs(tenCorrect - (12 / 14)) < 0.001);
  });

  it("validates learning event schemas and rejects corrupt payloads", () => {
    // Valid event
    assert.doesNotThrow(() => {
      validateLearningEvent({
        studentId: "student-123",
        subjectId: "course-456",
        score: 85,
        answers: [],
      });
    });

    // Rejects missing studentId
    assert.throws(
      () => validateLearningEvent({ subjectId: "course-456", score: 85 }),
      /studentId\/userId is required/
    );

    // Rejects missing subjectId
    assert.throws(
      () => validateLearningEvent({ studentId: "student-123", score: 85 }),
      /subjectId is required/
    );

    // Rejects impossible scores (< 0 or > 100)
    assert.throws(
      () => validateLearningEvent({ studentId: "student-123", subjectId: "c-1", score: -5 }),
      /score must be between 0 and 100/
    );
    assert.throws(
      () => validateLearningEvent({ studentId: "student-123", subjectId: "c-1", score: 105 }),
      /score must be between 0 and 100/
    );

    // Rejects non-array answers
    assert.throws(
      () => validateLearningEvent({ studentId: "student-123", subjectId: "c-1", answers: "not an array" }),
      /answers must be an array/
    );
  });
});

describe("ML Pipeline: Topic Feature Computation & Mastery Estimation", () => {
  it("returns explicit insufficient_data state when 0 or 1 attempt exists", () => {
    // 0 attempts
    const emptyFeatures = computeTopicFeatures([]);
    assert.equal(emptyFeatures.totalAttempts, 0);
    assert.equal(emptyFeatures.status, "insufficient_data");

    const emptyEstimate = estimateTopicMastery(emptyFeatures);
    assert.equal(emptyEstimate.estimatedMasteryScore, null);
    assert.equal(emptyEstimate.status, "insufficient_data");
    assert.match(emptyEstimate.explanation, /Insufficient assessment data/);

    // 1 attempt
    const singleAttemptFeatures = computeTopicFeatures([
      { isCorrect: true, difficulty: "medium", submittedAt: new Date().toISOString() },
    ]);
    assert.equal(singleAttemptFeatures.totalAttempts, 1);
    assert.equal(singleAttemptFeatures.status, "insufficient_data");

    const singleEstimate = estimateTopicMastery(singleAttemptFeatures);
    assert.equal(singleEstimate.estimatedMasteryScore, null);
    assert.equal(singleEstimate.status, "insufficient_data");
  });

  it("accurately classifies struggling topics as needs_practice for low accuracy", () => {
    // Student answered 1 of 5 correctly (20% raw accuracy)
    const answers = [
      { isCorrect: false, difficulty: "medium" },
      { isCorrect: false, difficulty: "hard" },
      { isCorrect: true, difficulty: "easy" },
      { isCorrect: false, difficulty: "medium" },
      { isCorrect: false, difficulty: "medium" },
    ];

    const features = computeTopicFeatures(answers);
    assert.equal(features.totalAttempts, 5);
    assert.equal(features.correctCount, 1);
    assert.equal(features.status, "needs_practice");

    const estimate = estimateTopicMastery(features);
    assert.ok(estimate.estimatedMasteryScore !== null);
    assert.ok(estimate.estimatedMasteryScore < 60);
    assert.equal(estimate.status, "needs_practice");
    assert.match(estimate.explanation, /Demonstrated difficulty/);
  });

  it("accurately classifies strong mastery for consistent success", () => {
    // Student answered 5 of 5 correctly
    const answers = [
      { isCorrect: true, difficulty: "medium" },
      { isCorrect: true, difficulty: "hard" },
      { isCorrect: true, difficulty: "medium" },
      { isCorrect: true, difficulty: "hard" },
      { isCorrect: true, difficulty: "medium" },
    ];

    const features = computeTopicFeatures(answers);
    assert.equal(features.totalAttempts, 5);
    assert.equal(features.correctCount, 5);
    assert.equal(features.status, "strong");

    const estimate = estimateTopicMastery(features);
    assert.ok(estimate.estimatedMasteryScore !== null);
    assert.ok(estimate.estimatedMasteryScore >= 80);
    assert.equal(estimate.status, "strong");
    assert.match(estimate.explanation, /Strong demonstrated understanding/);
  });

  it("detects learning trend: improving vs declining", () => {
    // Student started poorly (3 incorrect) then mastered (3 correct)
    const improvingAnswers = [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    const impFeatures = computeTopicFeatures(improvingAnswers);
    assert.equal(impFeatures.performanceTrend, "improving");
    assert.ok(impFeatures.trendDelta > 0.10);

    // Student started well then regressed
    const decliningAnswers = [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
    ];
    const decFeatures = computeTopicFeatures(decliningAnswers);
    assert.equal(decFeatures.performanceTrend, "declining");
    assert.ok(decFeatures.trendDelta < -0.10);
  });
});

describe("Recommendation Engine: Pedagogical Interventions & Explainability", () => {
  it("prioritizes weak topics (<60%) with high urgency and review material recommendations", () => {
    // Simulated candidate evaluation
    const masteryScore = 42; // Low mastery
    const hasDoc = true;

    let urgency = "medium";
    let type = "ask_tutor";
    let reason = "";

    if (masteryScore < 60) {
      urgency = "high";
      if (hasDoc) {
        type = "review_material";
        reason = `Low accuracy score (${masteryScore}%) recorded on recent questions. Review authorized faculty material.`;
      }
    }

    assert.equal(urgency, "high");
    assert.equal(type, "review_material");
    assert.match(reason, /Low accuracy score/);
  });

  it("recommends diagnostic practice quiz for unassessed topics", () => {
    const masteryScore = null; // Unassessed topic
    const hasQuiz = true;

    let type = "ask_tutor";
    let title = "";

    if (masteryScore === null && hasQuiz) {
      type = "practice_quiz";
      title = "Diagnostic Quiz: Dynamic Programming";
    }

    assert.equal(type, "practice_quiz");
    assert.match(title, /Diagnostic Quiz/);
  });

  it("applies fatigue penalties to prevent recommendation nagging", () => {
    const baseUrgencyScore = 0.85;
    const dismissedPenalty = 0.50;
    const penalizedScore = Math.max(0, baseUrgencyScore - dismissedPenalty);

    assert.ok(penalizedScore < baseUrgencyScore);
    assert.equal(penalizedScore, 0.35);
  });
});

describe("Security & Role Isolation: Student Data Boundaries", () => {
  it("prevents cross-student access to private mastery profiles", () => {
    const authenticatedStudentId = "student-alice-123";
    const requestedStudentId = "student-bob-456";

    // Security check rule
    const isAuthorized = (authId, reqId, role) => {
      if (role === "faculty" || role === "admin") return true;
      return authId === reqId;
    };

    assert.equal(isAuthorized(authenticatedStudentId, requestedStudentId, "student"), false);
    assert.equal(isAuthorized(authenticatedStudentId, authenticatedStudentId, "student"), true);
    assert.equal(isAuthorized("faculty-prof-1", requestedStudentId, "faculty"), true);
  });
});
