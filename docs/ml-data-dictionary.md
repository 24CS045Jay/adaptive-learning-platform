# EduSense AI — Machine Learning Data Dictionary

This document defines all event schemas, raw learning signals, engineered feature definitions, proxy labels, derived mastery outputs, and recommendation schemas used across EduSense AI.

---

## 1. Raw Learning Event Schemas

### 1.1 Assessment Attempt Event (`AttemptEvent`)
Recorded whenever a student submits an answer to a quiz or single practice question.

| Field Name | Type | Nullable | Source Table/Key | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `string (UUID)` | No | `attempts.id` | Unique attempt identifier | `"a7c189b2-3e21-4f10-bf91-912a842b1001"` |
| `quizId` | `string (UUID)` | Yes | `attempts.quiz_id` | Assessment ID if part of a multi-question quiz | `"9b1284d1-419b-4e12-87fa-328b9a110294"` |
| `studentId` | `string (UUID)` | No | `attempts.student_id` | Foreign key to `users.id` (Student) | `"82d959dd-099f-4b4b-96bf-4e1a2537cef0"` |
| `subjectId` | `string (UUID)` | No | `quizzes.subject_id` | Foreign key to `subjects.id` (Course) | `"a64cb7a7-830c-444d-b943-34b639eb50bc"` |
| `score` | `number (0-100)` | No | `attempts.score` | Aggregate percentage achieved in this attempt | `75.0` |
| `submittedAt` | `ISO 8601 string`| No | `attempts.submitted_at`| Timestamp of submission | `"2026-10-14T14:32:00.000Z"` |
| `answers` | `array<object>` | No | `attempts.answers` | Per-question answer itemization | See Answer Item schema below |

#### Per-Question Answer Itemization (`AnswerItem`)
Inside `attempts.answers`:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `questionId` | `string (UUID)` | Foreign key to `questions.id` |
| `topicTag` | `string` | Normalized topic identifier associated with question |
| `difficulty` | `"easy" \| "medium" \| "hard"` | Question difficulty metadata |
| `selectedOption`| `string \| number` | Option selected by student |
| `correctOption` | `string \| number` | True correct option |
| `isCorrect` | `boolean` | `true` if student answer matches correct answer, else `false` |
| `timeSpentSeconds` | `number` | Optional response latency in seconds |

---

### 1.2 RAG Interaction Log (`RagInteractionEvent`)
Recorded whenever a student asks the AI tutor a conceptual question.

| Field Name | Type | Nullable | Source Table/Key | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string (UUID)` | No | `rag_interaction_logs.id` | Unique query event identifier |
| `userId` | `string (UUID)` | Yes | `rag_interaction_logs.user_id` | Student ID |
| `subjectId` | `string (UUID)` | Yes | `rag_interaction_logs.subject_id`| Course ID |
| `query` | `string` | No | `rag_interaction_logs.query` | Question asked by student |
| `response` | `string` | Yes | `rag_interaction_logs.response` | RAG tutor synthesized response |
| `confidence` | `number (0.0-1.0)` | No | `rag_interaction_logs.confidence`| Groundedness retrieval confidence score |
| `escalated` | `boolean` | No | `rag_interaction_logs.escalated` | Whether query fell below threshold (< 0.55) |
| `sources` | `array<object>` | Yes | `rag_interaction_logs.sources` | Document chunks retrieved from vector store |
| `createdAt` | `ISO 8601 string`| No | `rag_interaction_logs.created_at`| Timestamp of interaction |

---

### 1.3 Recommendation Interaction Event (`RecommendationInteractionEvent`)
Stored in `audit_logs` with `action = "RECOMMENDATION_INTERACTION"` to record feedback and learning loops.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `recommendationId` | `string` | Unique recommendation identifier |
| `studentId` | `string (UUID)` | Student who received the recommendation |
| `courseId` | `string (UUID)` | Subject associated with recommendation |
| `topic` | `string` | Topic recommended |
| `eventType` | `enum` | `"impression"` \| `"opened"` \| `"completed"` \| `"dismissed"` \| `"feedback"` |
| `feedbackValue` | `number \| string`| Thumbs up (+1) / Thumbs down (-1) or rating |
| `timestamp` | `ISO 8601 string`| Event occurrence timestamp |

---

## 2. Engineered Student-Topic Features

Computed for each pair of `(studentId, topic)` over chronological learning history.

| Feature Name | Type | Formula / Definition | Value Range | Missing Value Imputation | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `total_attempts` | `integer` | Count of all valid question responses on this topic | $[0, \infty)$ | $0$ | Sample size indicator. Prevents small-sample overfitting. |
| `correct_count` | `integer` | Count of correct answers on this topic | $[0, \infty)$ | $0$ | Total successes. |
| `incorrect_count`| `integer` | Count of incorrect answers on this topic | $[0, \infty)$ | $0$ | Total failures / error frequency. |
| `raw_accuracy` | `float` | $\frac{\text{correct\_count}}{\text{total\_attempts}}$ | $[0.0, 1.0]$ | $0.0$ when $\text{attempts} = 0$ | Raw observed success rate. |
| `smoothed_accuracy` | `float` | $\frac{\text{correct\_count} + 2}{\text{total\_attempts} + 4}$ | $[0.0, 1.0]$ | $0.5$ (Beta(2,2) prior) | Bayesian m-estimate / Laplace smoothing. Shrinks small samples toward 50%. |
| `recent_accuracy` | `float` | Accuracy across the last $\min(5, \text{total\_attempts})$ attempts | $[0.0, 1.0]$ | `smoothed_accuracy` | Recency-weighted short-term performance indicator. |
| `performance_trend`| `float` | $\text{recent\_accuracy} - \text{smoothed\_accuracy}$ | $[-1.0, 1.0]$ | $0.0$ | Trajectory: positive indicates learning recovery; negative indicates emerging misconception. |
| `days_since_last_attempt` | `float` | $\frac{\text{now}() - \text{last\_attempt\_time}}{86400}$ | $[0.0, \infty)$ | $999.0$ | Forgetting curve / retention decay feature. |
| `weighted_difficulty_score` | `float` | $\frac{\sum (\text{isCorrect}_i \times d_i)}{\sum d_i}$ where $d \in \{1: \text{easy}, 2: \text{med}, 3: \text{hard}\}$ | $[0.0, 1.0]$ | `smoothed_accuracy` | Difficulty-adjusted performance indicator. |
| `wilson_lower_bound` | `float` | $\frac{\hat{p} + \frac{z^2}{2n} - z\sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$ ($z=1.96$) | $[0.0, 1.0]$ | $0.0$ | Conservative 95% confidence lower bound on understanding. |
| `confidence_weight` | `float` | $\min(1.0, \frac{\text{total\_attempts}}{5})$ | $[0.0, 1.0]$ | $0.0$ | Feature measurement confidence. Scaled between 0 and 1. |

---

## 3. Ground Truth & Proxy Labels

For supervised model training and evaluation:

| Label Name | Definition | Target Window | Notes |
| :--- | :--- | :--- | :--- |
| `next_question_correct` | Binary label $\{0, 1\}$ indicating whether student answers their next question on the topic correctly. | Next immediate attempt | Strictly causal: features use events up to time $t$; label is the outcome at $t+1$. Prevents temporal leakage. |
| `mastery_criterion_met` | Binary label $\{0, 1\}$ indicating whether student achieves $\ge 75\%$ accuracy over a subsequent evaluation block (next $\ge 3$ attempts). | Next 3 attempts | Used for classification comparison. Distinct from unobservable true internal understanding. |

---

## 4. Model Prediction & Persistence Output

Stored in `topic_mastery` and retrieved by frontend:

| Output Field | Database Column | Type | Interpretation |
| :--- | :--- | :--- | :--- |
| `id` | `topic_mastery.id` | `UUID` | Primary key |
| `userId` / `studentId` | `topic_mastery.user_id` | `string` | Student identifier |
| `subjectId` | `topic_mastery.subject_id` | `string` | Course identifier |
| `topic` | `topic_mastery.topic` | `string` | Topic identifier |
| `score` | `topic_mastery.score` | `numeric (0-100)` | Predicted mastery probability / score percentage |
| `totalAttempts` | `topic_mastery.total_attempts` | `integer` | Count of observed valid attempts |
| `lastEvaluated` | `topic_mastery.last_evaluated` | `timestamptz` | Timestamp when inference was executed |
| `status` | Derived | `enum` | `"insufficient_data"` (< 2 attempts)<br>`"needs_practice"` (< 60%)<br>`"developing"` (60% - 79%)<br>`"strong"` ($\ge$ 80%) |
| `confidence` | Derived | `float (0.0-1.0)` | Statistical certainty based on sample size |
| `evidence` | Derived | `object` | Evidence breakdown (correct count, recent accuracy, trend) |

---

## 5. Recommendation Engine Output

Generated dynamically and persisted in `audit_logs` (`action = 'RECOMMENDATION_RECORD'`):

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string (UUID)` | Unique recommendation identifier |
| `studentId` | `string` | Target student |
| `courseId` | `string` | Associated enrolled subject |
| `topic` | `string` | Target topic |
| `type` | `"review_material" \| "practice_quiz" \| "ask_tutor"` | Pedagogical intervention type |
| `title` | `string` | Dynamic human-readable title |
| `reason` | `string` | Explainable reason based on actual data |
| `resourceId` | `string` | Verified document ID or quiz ID (or null) |
| `resourceName` | `string` | Real file name or quiz title |
| `resourceType` | `string` | `"pdf" \| "docx" \| "quiz" \| "tutor"` |
| `urgency` | `"high" \| "medium" \| "low"` | Prioritization category |
| `urgencyScore` | `float (0.0-1.0)` | Normalized multi-factor ranking score |
| `status` | `"pending" \| "viewed" \| "selected" \| "completed" \| "dismissed"` | Current lifecycle status |
| `strategy` | `string` | Model version or baseline name (`"explainable_multi_factor_v1"`) |
| `createdAt` | `ISO 8601 string` | Timestamp created |
