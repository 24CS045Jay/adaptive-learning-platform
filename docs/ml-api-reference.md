# EduSense AI — Machine Learning API Reference

This document provides complete specification for all new and updated API endpoints supporting the Student Topic Mastery Prediction, Personalized Learning Recommendation Engine, and Live Telemetry Analytics.

All routes require a valid JWT bearer token or session cookie header:
`Authorization: Bearer <jwt_token>`

---

## 1. Adaptive & Mastery APIs (`/api/adaptive`)

### 1.1 `GET /api/adaptive/profile`
Retrieves the authenticated student's personalized mastery profile, confidence levels, weak topics, and course breakdown.

- **Role**: `student` (or `faculty`/`admin` querying student)
- **Query Parameters**:
  - `subjectId` (optional UUID): Filter to specific course.
- **Success Response (200 OK)**:
```json
{
  "studentId": "82d959dd-099f-4b4b-96bf-4e1a2537cef0",
  "overallMastery": 74,
  "confidenceScore": 0.85,
  "status": "developing",
  "dataStatus": "sufficient_data",
  "topicsEvaluatedCount": 6,
  "totalAttempts": 24,
  "weakTopics": [
    {
      "topic": "Dynamic Programming",
      "score": 38,
      "status": "needs_practice",
      "confidence": 0.60,
      "attempts": 3,
      "explanation": "Demonstrated difficulty on this topic with 1/3 correct answers (33% raw accuracy). Recommended for targeted review."
    }
  ],
  "strongTopics": [
    {
      "topic": "Linked Lists",
      "score": 88,
      "status": "strong",
      "confidence": 1.00,
      "attempts": 8,
      "explanation": "Strong demonstrated understanding with 7/8 correct answers (88% raw accuracy)."
    }
  ],
  "subjectBreakdown": [
    {
      "subjectId": "a64cb7a7-830c-444d-b943-34b639eb50bc",
      "subjectCode": "CS301",
      "subjectName": "Algorithms & Data Structures",
      "avgMastery": 74,
      "topicsCount": 6,
      "weakCount": 1
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized`: Token missing or invalid.
  - `404 Not Found`: Student profile or enrollment records not found.

---

### 1.2 `GET /api/adaptive/recommendations`
Generates personalized, explainable recommendations dynamically from enrolled subjects, approved documents, and quizzes.

- **Role**: `student`
- **Query Parameters**:
  - `courseId` (optional UUID): Restrict recommendations to a specific enrolled course.
  - `limit` (optional integer, default `5`): Maximum recommendations to return.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "studentId": "82d959dd-099f-4b4b-96bf-4e1a2537cef0",
  "recommendations": [
    {
      "id": "rec-37cef0-a8f1b2",
      "studentId": "82d959dd-099f-4b4b-96bf-4e1a2537cef0",
      "courseId": "a64cb7a7-830c-444d-b943-34b639eb50bc",
      "subjectCode": "CS301",
      "subjectName": "Algorithms & Data Structures",
      "topic": "Dynamic Programming",
      "type": "review_material",
      "title": "Study notes on Dynamic Programming",
      "reason": "Low accuracy score (38%) recorded on recent questions. Review authorized faculty material to reinforce core principles.",
      "urgency": "high",
      "urgencyScore": 0.825,
      "resourceId": "doc-dp-01",
      "resourceName": "Lecture_07_Dynamic_Programming.pdf",
      "resourceType": "pdf",
      "currentMasteryScore": 38,
      "strategy": "explainable_multi_factor_v1",
      "status": "pending",
      "createdAt": "2026-10-14T15:20:00.000Z"
    }
  ]
}
```

---

### 1.3 `POST /api/adaptive/recommendations/interaction`
Records student feedback or interaction with a recommendation to close the feedback loop and prevent recommendation fatigue.

- **Role**: `student`
- **Request Body**:
```json
{
  "recommendationId": "rec-37cef0-a8f1b2",
  "topic": "Dynamic Programming",
  "courseId": "a64cb7a7-830c-444d-b943-34b639eb50bc",
  "eventType": "selected",
  "feedbackValue": 1
}
```
- **Allowed `eventType` values**: `"viewed"`, `"selected"`, `"completed"`, `"dismissed"`, `"feedback"`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Recommendation interaction recorded.",
  "interactionId": "audit-log-uuid"
}
```

---

### 1.4 `GET /api/adaptive/faculty/insights`
Provides authorized faculty with aggregate class mastery distributions, critical topic gaps, and recommendation engagement metrics.

- **Role**: `faculty`, `admin`
- **Query Parameters**:
  - `subjectId` (optional UUID): Filter to specific course taught by faculty.
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "subjectId": "a64cb7a7-830c-444d-b943-34b639eb50bc",
  "overallEngagement": {
    "totalImpressions": 48,
    "totalSelected": 32,
    "totalCompleted": 26,
    "totalDismissed": 4,
    "completionRatePct": 81
  },
  "topicBreakdown": [
    {
      "topic": "Dynamic Programming",
      "avgScore": 44,
      "studentsEvaluated": 18,
      "studentsStruggling": 11,
      "status": "critical_gap"
    },
    {
      "topic": "Binary Search Trees",
      "avgScore": 72,
      "studentsEvaluated": 20,
      "studentsStruggling": 3,
      "status": "developing"
    }
  ]
}
```

---

## 2. Quiz Submission & Attempt API (`/api/quizzes`)

### 2.1 `POST /api/quizzes/:id/attempt`
Submits student quiz responses, scores the attempt, and triggers the asynchronous learning pipeline to update `topic_mastery`.

- **Role**: `student`
- **Request Body**:
```json
{
  "answers": [
    {
      "questionId": "q-101",
      "selectedOption": "O(log n)",
      "topicTag": "Binary Search Trees",
      "difficulty": "medium",
      "isCorrect": true
    }
  ]
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "attemptId": "attempt-uuid",
  "score": 100,
  "totalQuestions": 1,
  "correctAnswers": 1,
  "masteryUpdates": [
    {
      "topic": "Binary Search Trees",
      "score": 78,
      "status": "developing",
      "attempts": 4
    }
  ]
}
```

---

## 3. Telemetry & Analytics APIs (`/api/analytics`)

### 3.1 `GET /api/analytics/telemetry`
Returns live platform query volume and response metrics from `rag_interaction_logs` without fake `+ 1480` offsets.

- **Role**: `admin`, `faculty`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "totalQueries": 324,
  "todayQueries": 18,
  "weekQueries": 142,
  "avgConfidencePct": 86,
  "escalatedCount": 12,
  "escalationRatePct": 4,
  "queryTrends": [
    { "date": "2026-10-14", "queries": 18, "escalated": 1 }
  ]
}
```

---

### 3.2 `GET /api/analytics/institutional-reports`
Aggregates live departmental metrics across students, faculty, subjects, documents, and quizzes.

- **Role**: `admin`
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "summary": {
    "totalStudents": 150,
    "totalFaculty": 12,
    "totalSubjects": 8,
    "totalDocuments": 34,
    "totalQuizzes": 16,
    "totalAttempts": 420
  },
  "departmentPerformance": [
    {
      "department": "Computer Science",
      "studentCount": 85,
      "courseCount": 5,
      "avgMasteryScore": 76,
      "activeLearnersPct": 92
    }
  ]
}
```
