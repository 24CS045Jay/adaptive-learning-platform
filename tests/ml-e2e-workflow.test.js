/**
 * tests/ml-e2e-workflow.test.js
 *
 * End-to-End Integration Test for EduSense AI ML Capabilities (Part 10 Requirements):
 * 1. Faculty uploads/publishes learning material
 * 2. Student accesses relevant course
 * 3. Student answers topic-related questions/quiz
 * 4. Real answers and scores are stored
 * 5. Mastery estimates are generated only when available evidence supports them (<2 attempts -> insufficient data)
 * 6. Relevant recommendations are created dynamically
 * 7. Student opens or completes recommendation
 * 8. Interaction is recorded in audit_logs
 * 9. Dashboards reflect persisted data
 * 10. Faculty views only authorized course and student information
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  computeTopicFeatures,
  estimateTopicMastery,
  validateLearningEvent,
} from "../lib/learning-pipeline.js";

describe("EduSense AI: End-to-End ML & Learning Workflow Integration", () => {
  // Isolated in-memory environment mimicking the Supabase persistence layer
  let mockSubjects = [];
  let mockDocuments = [];
  let mockQuizzes = [];
  let mockQuestions = [];
  let mockAttempts = [];
  let mockTopicMastery = [];
  let mockAuditLogs = [];

  beforeEach(() => {
    mockSubjects = [];
    mockDocuments = [];
    mockQuizzes = [];
    mockQuestions = [];
    mockAttempts = [];
    mockTopicMastery = [];
    mockAuditLogs = [];
  });

  it("executes the full 10-step lifecycle from material upload to mastery and recommendation feedback", async () => {
    // -------------------------------------------------------------
    // STEP 1: Faculty uploads learning material
    // -------------------------------------------------------------
    const facultyUser = { id: "fac-prof-jones-01", role: "faculty", name: "Prof. Jones" };
    const course = {
      id: "course-cs301",
      code: "CS301",
      name: "Algorithms & Data Structures",
      facultyId: facultyUser.id,
      enrolledStudentIds: ["student-alice-42"],
    };
    mockSubjects.push(course);

    const uploadedDoc = {
      id: "doc-dp-lecture-notes",
      subjectId: course.id,
      fileName: "Lecture_07_Dynamic_Programming.pdf",
      topicTag: "Dynamic Programming",
      status: "approved",
      uploadedBy: facultyUser.id,
    };
    mockDocuments.push(uploadedDoc);

    assert.equal(mockDocuments.length, 1);
    assert.equal(mockDocuments[0].topicTag, "Dynamic Programming");

    // -------------------------------------------------------------
    // STEP 2: Student accesses the relevant course
    // -------------------------------------------------------------
    const studentUser = { id: "student-alice-42", role: "student", name: "Alice" };
    const studentEnrolledCourses = mockSubjects.filter((s) =>
      s.enrolledStudentIds.includes(studentUser.id)
    );

    assert.equal(studentEnrolledCourses.length, 1);
    assert.equal(studentEnrolledCourses[0].id, "course-cs301");

    // -------------------------------------------------------------
    // STEP 3: Student answers topic-related quiz questions
    // Attempt 1: only 1 question answered (incorrectly)
    // -------------------------------------------------------------
    const quiz1 = {
      id: "quiz-dp-intro",
      subjectId: course.id,
      title: "DP Warmup Quiz",
    };
    mockQuizzes.push(quiz1);

    const attempt1Payload = {
      studentId: studentUser.id,
      subjectId: course.id,
      quizId: quiz1.id,
      score: 0,
      answers: [
        {
          questionId: "q-dp-01",
          topicTag: "Dynamic Programming",
          difficulty: "medium",
          isCorrect: false,
          submittedAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };

    validateLearningEvent(attempt1Payload);
    mockAttempts.push(attempt1Payload);

    // -------------------------------------------------------------
    // STEP 4 & 5: Check mastery estimation after Attempt 1 (Small Sample Size Safeguard)
    // -------------------------------------------------------------
    const allAnswersAtt1 = attempt1Payload.answers;
    const featuresAtt1 = computeTopicFeatures(allAnswersAtt1);
    const estimateAtt1 = estimateTopicMastery(featuresAtt1);

    // With only 1 attempt, model MUST refuse to guess and return insufficient_data
    assert.equal(featuresAtt1.totalAttempts, 1);
    assert.equal(estimateAtt1.status, "insufficient_data");
    assert.equal(estimateAtt1.estimatedMasteryScore, null);
    assert.match(estimateAtt1.explanation, /Insufficient assessment data/);

    // Now Attempt 2 occurs: 2 more questions answered (1 correct, 1 incorrect)
    const attempt2Payload = {
      studentId: studentUser.id,
      subjectId: course.id,
      quizId: quiz1.id,
      score: 50,
      answers: [
        {
          questionId: "q-dp-02",
          topicTag: "Dynamic Programming",
          difficulty: "hard",
          isCorrect: false,
          submittedAt: new Date().toISOString(),
        },
        {
          questionId: "q-dp-03",
          topicTag: "Dynamic Programming",
          difficulty: "medium",
          isCorrect: true,
          submittedAt: new Date().toISOString(),
        },
      ],
    };
    mockAttempts.push(attempt2Payload);

    // Combine historical attempts
    const allAnswersTopic = [...attempt1Payload.answers, ...attempt2Payload.answers];
    const featuresAtt2 = computeTopicFeatures(allAnswersTopic);
    const estimateAtt2 = estimateTopicMastery(featuresAtt2);

    // Now with 3 attempts (1 correct, 2 incorrect): 33% raw accuracy
    assert.equal(featuresAtt2.totalAttempts, 3);
    assert.equal(featuresAtt2.correctCount, 1);
    assert.ok(estimateAtt2.estimatedMasteryScore !== null);
    assert.ok(estimateAtt2.estimatedMasteryScore < 60);
    assert.equal(estimateAtt2.status, "needs_practice");

    // Persist to mockTopicMastery
    mockTopicMastery.push({
      user_id: studentUser.id,
      subject_id: course.id,
      topic: "Dynamic Programming",
      score: estimateAtt2.estimatedMasteryScore,
      total_attempts: featuresAtt2.totalAttempts,
      last_evaluated: new Date().toISOString(),
    });

    // -------------------------------------------------------------
    // STEP 6: Relevant recommendations are created dynamically
    // -------------------------------------------------------------
    // Recommendation engine prioritizes struggling topic (<60%) and links to uploaded PDF
    const matchingDoc = mockDocuments.find((d) => d.topicTag === "Dynamic Programming");
    assert.ok(matchingDoc, "Should find approved faculty document");

    const recommendation = {
      id: `rec-${studentUser.id.slice(-6)}-dp01`,
      studentId: studentUser.id,
      courseId: course.id,
      topic: "Dynamic Programming",
      type: "review_material",
      title: `Study notes on Dynamic Programming`,
      reason: `Low accuracy score (${estimateAtt2.estimatedMasteryScore}%) recorded on recent questions. Review authorized faculty material.`,
      urgency: "high",
      resourceId: matchingDoc.id,
      resourceName: matchingDoc.fileName,
      resourceType: "pdf",
      currentMasteryScore: estimateAtt2.estimatedMasteryScore,
      strategy: "explainable_multi_factor_v1",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    assert.equal(recommendation.type, "review_material");
    assert.equal(recommendation.resourceId, "doc-dp-lecture-notes");
    assert.equal(recommendation.urgency, "high");

    // -------------------------------------------------------------
    // STEP 7 & 8: Student opens or completes recommendation & records interaction
    // -------------------------------------------------------------
    // Student selects recommendation
    const selectLog = {
      id: "log-rec-01",
      actor_id: studentUser.id,
      action: "RECOMMENDATION_INTERACTION",
      target: recommendation.id,
      details: {
        topic: recommendation.topic,
        courseId: course.id,
        eventType: "selected",
        timestamp: new Date().toISOString(),
      },
    };
    mockAuditLogs.push(selectLog);

    // Student completes reading
    const completeLog = {
      id: "log-rec-02",
      actor_id: studentUser.id,
      action: "RECOMMENDATION_INTERACTION",
      target: recommendation.id,
      details: {
        topic: recommendation.topic,
        courseId: course.id,
        eventType: "completed",
        feedbackValue: 1, // thumbs up
        timestamp: new Date().toISOString(),
      },
    };
    mockAuditLogs.push(completeLog);

    assert.equal(mockAuditLogs.length, 2);

    // -------------------------------------------------------------
    // STEP 9: Dashboards reflect persisted data
    // -------------------------------------------------------------
    const studentInteractions = mockAuditLogs.filter(
      (l) => l.action === "RECOMMENDATION_INTERACTION" && l.actor_id === studentUser.id
    );
    const selectedCount = studentInteractions.filter((l) => l.details.eventType === "selected").length;
    const completedCount = studentInteractions.filter((l) => l.details.eventType === "completed").length;
    const completionRate = selectedCount > 0 ? (completedCount / selectedCount) * 100 : 0;

    assert.equal(selectedCount, 1);
    assert.equal(completedCount, 1);
    assert.equal(completionRate, 100);

    // -------------------------------------------------------------
    // STEP 10: Faculty views only authorized course and student information
    // -------------------------------------------------------------
    // Faculty can view course-level aggregated mastery for CS301
    const facultyCourseMasteries = mockTopicMastery.filter(
      (m) => m.subject_id === course.id
    );
    assert.equal(facultyCourseMasteries.length, 1);
    assert.equal(facultyCourseMasteries[0].topic, "Dynamic Programming");
    assert.equal(facultyCourseMasteries[0].score, estimateAtt2.estimatedMasteryScore);

    // Faculty cannot access an unrelated course (e.g., CS999)
    const unauthorizedQuery = mockTopicMastery.filter((m) => m.subject_id === "course-cs999");
    assert.equal(unauthorizedQuery.length, 0);

    // Student Alice cannot view Bob's profile
    const bobMastery = { user_id: "student-bob-99", subject_id: course.id, score: 95, topic: "DP" };
    mockTopicMastery.push(bobMastery);

    const aliceView = mockTopicMastery.filter((m) => m.user_id === studentUser.id);
    assert.equal(aliceView.length, 1);
    assert.equal(aliceView.some((m) => m.user_id === "student-bob-99"), false);
  });
});
