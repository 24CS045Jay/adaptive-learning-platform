# EduSense AI — Comprehensive Machine Learning Implementation & Analytics Audit

**Audit Date:** October 2026  
**Project:** EduSense AI (Adaptive Education Platform)  
**Auditor:** Senior ML Engineer & Full-Stack Architect  

---

## 1. Executive Summary & Repository Landscape

An end-to-end audit was conducted across the entire EduSense AI repository (`d:\sem_5\project-1\v1`). The project comprises:
- **Frontend:** React 19 + TanStack Router (file-based routing in `src/routes/`), Vite, TailwindCSS, Recharts, Framer Motion, Radix UI.
- **Backend API Gateway:** Node.js Express 5 server (`server.express.js`), with route modules in `routes/` (auth, quizzes, adaptive, analytics, tutor, documents, meetings, etc.).
- **Database Layer:** Supabase PostgreSQL with 25 core tables defined in `supabase_schema.sql` and mapped via a Mongoose-compatible query builder in `db/supabase-model.js`.
- **Vector Retrieval & RAG Service:** Python FastAPI service (`rag_service/app`) on port 8001 utilizing LangChain, LangGraph, ChromaDB (Cloud/Local), and LLM integrations (Google Gemini, Groq, OpenAI).
- **Current Live DB State:** 11 registered users (students, faculty, admin), 2 active subjects (`CSE203` - Machine Learning, `CSUC301` - BDA), 8 faculty-uploaded documents, 14 RAG interaction logs, 0 quiz attempts, 0 topic mastery entries.

### Critical Finding
Prior to this implementation, the "adaptive" and "analytics" features relied heavily on **hardcoded static mock arrays, fake fallback percentages, and simulated memory structures**. Specifically:
1. `routes/adaptive.js` returned static hardcoded topics (*"HDFS Architecture & Block Storage"*, *"MapReduce Shuffle & Sort Phase"*, *"Kafka Stream Partitioning & Offsets"*, *"Spark RDD Transformations vs Actions"*) with static percentage scores (85%, 52%, 72%, 48%) and fake explanations whenever real DB records were missing.
2. `routes/quizzes.js` had a critical schema mismatch: quiz submissions tried to upsert into `TopicMastery` using non-existent column names (`studentId` instead of `user_id`, `topicTag` instead of `topic`, `masteryLabel` instead of `score`), silently failing or generating invalid queries.
3. `routes/analytics.js` (`/risk-profiles`) had a hardcoded subject fallback (*"Big Data Analytics"*), hardcoded fallback score (75%), and checked non-existent column `masteryLabel === "weak"`.
4. Frontend analytics pages (`faculty.analytics.tsx`, `admin.analytics.tsx`, `student.index.tsx`, `student.planner.tsx`, `admin.reports.tsx`) featured hardcoded charts (e.g., `+ 1480` fake queries, hardcoded `MASTERY_DATA`, fake `TIME_SPENT`, fake `STREAK_DAYS`, hardcoded `[84, 91, 76, 78, 88, 72]` mastery array).

---

## 2. Page-by-Page & Feature Inventory Audit

| Route & Page Component | Backend API Endpoint | Data Source | Renders UI? | Persisted & Retrieved? | Hardcoded / Mocked Data Found | Defects & Issues | Classification | Required Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`/faculty/analytics`**<br>`src/routes/faculty.analytics.tsx`<br>(`ClassAnalytics`) | `GET /api/analytics/risk-profiles`<br>`useAppData()` | `TopicMastery`, `Attempt`, `User`<br>(plus static imports from `mock-data.ts`) | Yes | Partially (fetches users, but fallback values dominate) | • `MASTERY_DATA` static donut: `Strong: 34`, `Average: 45`, `Weak: 21`<br>• `topicVolume.slice(0, 5)` from `mock-data.ts`<br>• Backend fallback score: `75%`<br>• Backend hardcoded subject: `"Big Data Analytics"` | • Column mismatch: `TopicMastery.find({ studentId })` queries non-existent `student_id` (table has `user_id`)<br>• `m.masteryLabel` checked in backend does not exist in schema<br>• Empty attempt history defaults to arbitrary 75% | **Broken / Mocked** | 1. Fix backend column mappings (`user_id`, `topic`, `score`).<br>2. Replace static donut with real aggregate distribution.<br>3. Replace static `topicVolume` with true RAG/quiz interaction topics.<br>4. Provide dynamic subject selector and display insufficient data state when no attempts exist. |
| **`/admin/analytics`**<br>`src/routes/admin.analytics.tsx`<br>(`AnalyticsPage`) | `useAppData()`<br>(aggregates client-side data) | `RagInteractionLog`, `Feedback`, `User` | Yes | Partially | • `DAILY_QUERY_TRENDS` static 7-day array (`Mon: 142`, etc.)<br>• `totalQueries = queries.length + 1480`<br>• Static `"96.4%"` grounding accuracy<br>• Fallback `92%` helpfulness rate | • Inflates query volume by adding fake 1480 count<br>• Chart is completely unresponsive to real RAG queries<br>• Grounding accuracy is a static text string | **Mocked** | 1. Calculate real query counts from `RagInteractionLog`.<br>2. Aggregate daily volume chronologically.<br>3. Compute grounding accuracy from logged `confidence` scores.<br>4. Compute helpfulness from `feedbacks` table. |
| **`/student/`**<br>`src/routes/student.index.tsx`<br>(`StudentDashboard`) | `useAppData()` | `subjects`, `quizzes`, `mock-data.ts` | Yes | Partially | • `TIME_SPENT`: static 7-day hours<br>• `STREAK_DAYS`: static week array<br>• `MASTERY_PCT = 74`<br>• `WEEKLY_PROGRESS_PCT = 85`<br>• `suggestedWeakTopics`: hardcoded strings (*"MapReduce Shuffle & Partitioning"*, *"L1/L2 Regularization Penalty"*) with fake reasons | • Hero mastery ring displays fixed 74% instead of student's true mastery.<br>• Suggested weak topics are fabricated from subject index. | **Mocked** | 1. Connect mastery ring to real student topic mastery API.<br>2. Replace fake weak topics with dynamic recommendations from ML engine.<br>3. Show empty/insufficient data state for students with zero attempts. |
| **`/student/planner`**<br>`src/routes/student.planner.tsx`<br>(`Planner`) | `localStorage`<br>`AdaptiveMasteryCard` | `localStorage`<br>`/api/adaptive/*` | Yes | Broken | • `INITIAL_REMEDIATIONS`: 3 static topics saved in localStorage (*"MapReduce Shuffle & Sort"*, *"L1 vs L2 Regularization"*, *"Speculative Execution"*) | • Disconnected from database.<br>• Tasks completed do not update mastery in DB.<br>• Arbitrary initial remediations presented to every student regardless of subject enrollment. | **Mocked** | 1. Connect planner tasks and recommendations to authentic backend recommendation records.<br>2. Synchronize completion events with student learning pipeline. |
| **`/components/adaptive/AdaptiveMasteryCard`**<br>`src/components/adaptive/AdaptiveMasteryCard.tsx` | `GET /api/adaptive/profile`<br>`GET /api/adaptive/recommendations`<br>`POST /api/adaptive/practice-quiz`<br>`PUT /api/adaptive/preferences` | In-memory maps & seed functions in `routes/adaptive.js` | Yes | Fake Persistence (in-memory `Map` reset on server restart) | • `getStudentSeedMastery()` injects 4 static topics and scores (85%, 52%, 72%, 48%).<br>• `practice-quiz` serves 3 hardcoded static questions.<br>• `faculty-analytics` returns hardcoded class average 66.8%. | • Does not read or write to `topic_mastery` table properly.<br>• Bypasses real enrolled subjects.<br>• Hardcoded Big Data questions served to students of any course. | **Fake ML / Mocked** | 1. Implement authentic feature extraction and mastery estimation pipeline.<br>2. Build dynamic recommendation engine linking enrolled course materials and practice quizzes.<br>3. Dynamic practice quiz generation from authorized question bank. |
| **`/admin/reports`**<br>`src/routes/admin.reports.tsx`<br>(`Reports`) | `useAppData()` | `subjects`, `documents` | Yes | Partially | • `masteryPct`: `[84, 91, 76, 78, 88, 72][i] ?? 80`<br>• `queriesCount`: `Math.round(approvedDocs * 24 + 30)`<br>• `complianceStatus`: hardcoded `"Compliant ✓"` | • Generates fake CSV export data using arbitrary formulas. | **Mocked** | 1. Compute actual subject mastery average from real `topic_mastery` and `attempts`.<br>2. Query actual `RagInteractionLog` per subject.<br>3. Calculate authentic compliance. |
| **`/admin/`**<br>`src/routes/admin.index.tsx`<br>(`AdminDashboard`) | `useAppData()` | `users`, `subjects`, `documents`, `escalations`, `topicVolume` | Yes | Partially | • `QUERY_SPARKLINE`: static array<br>• `prevQueries`: fake formula `(topicVolume + 1480) * 0.82`<br>• `currentQueries`: fake formula `topicVolume + 1480` | • Inflates query volume by 1480.<br>• Sparkline is static. | **Mocked** | 1. Pull real interaction counts from `RagInteractionLog`.<br>2. Remove artificial +1480 offset. |
| **Quiz Attempt Submission**<br>`POST /api/quizzes/:id/attempt`<br>`routes/quizzes.js` | Express API | `quizzes`, `questions`, `attempts`, `topic_mastery` | N/A (API) | Attempt saved, TopicMastery failed | • `masteryLabel` calculated but column does not exist.<br>• `studentId` column used instead of `user_id`.<br>• `topicTag` column used instead of `topic`. | • `TopicMastery.findOneAndUpdate` failed or wrote invalid columns rejected by schema.<br>• Did not track attempt counts, chronological history, or difficulty. | **Broken** | 1. Rewrite quiz scoring to write valid `attempts` and invoke the learning data pipeline.<br>2. Upsert schema-compliant `topic_mastery` (`user_id`, `subject_id`, `topic`, `score`, `total_attempts`, `last_evaluated`). |
| **Ask Tutor RAG Flow**<br>`POST /api/tutor/ask`<br>`routes/tutor.js` | Express + FastAPI | ChromaDB, Supabase `documents`, `conversations`, `rag_interaction_logs` | Yes | Yes | None in core RAG retrieval | • Did not incorporate topic mastery into prompt context.<br>• Did not trigger recommendation refresh after tutor interaction.<br>• Did not log student interaction events for recommendation feedback loop. | **Working (Needs ML Integration)** | 1. Pass student topic mastery context into RAG system prompt.<br>2. Provide follow-up recommended activity after conceptual answers.<br>3. Log learning events for feedback loop. |

---

## 3. Database Schema Verification & Gaps

### Supabase Table Verification Status
All 25 tables from `supabase_schema.sql` exist in the Supabase PostgreSQL database:
- `users`: Exists (11 rows)
- `subjects`: Exists (2 rows)
- `documents`: Exists (8 rows)
- `quizzes`: Exists (0 rows)
- `questions`: Exists (0 rows)
- `attempts`: Exists (0 rows)
- `topic_mastery`: Exists (0 rows). Verified columns: `id`, `user_id`, `subject_id`, `topic`, `score`, `total_attempts`, `last_evaluated`, `created_at`, `updated_at`.
- `audit_logs`: Exists. Verified columns: `id`, `actor_id`, `action`, `details` (JSONB), `target`, `created_at`, `updated_at`.
- `rag_interaction_logs`: Exists (14 rows).

### Identified Architectural Discrepancies
1. **Schema Column Naming vs. Backend Code:**
   - In `routes/quizzes.js`, `studentId` was passed instead of `user_id`, and `topicTag` instead of `topic`.
   - In `routes/analytics.js`, `TopicMastery.find({ studentId })` was called, which turned into `student_id` in SQL and failed.
2. **Missing Standalone Recommendations Table:**
   - Supabase PostgREST does not have a dedicated `recommendations` table in the current schema.
   - **Architectural Solution:** We utilize the indexed `audit_logs` table with `action = 'RECOMMENDATION_RECORD'` and `details` JSONB column to persist recommendations and interaction events (`viewed`, `selected`, `completed`, `dismissed`, `feedback`), alongside a high-performance in-memory/disk cache in the ML service for sub-millisecond retrieval.
3. **Learner Preferences Table:**
   - Table `learner_preferences` is not in the active Supabase schema cache.
   - **Architectural Solution:** Store student learner preferences inside `users.metadata` JSONB or `audit_logs` with `action = 'LEARNER_PREFERENCE'` to guarantee persistence without breaking Supabase RLS policies.

---

## 4. Required Fixes & Implementation Plan

1. **Stage 2 (Analytics Repair):**
   - Fix all column mismatches in `routes/quizzes.js` and `routes/analytics.js`.
   - Remove fake `+ 1480` offsets and static 7-day query trends in `admin.analytics.tsx` and `admin.index.tsx`.
   - Replace hardcoded `MASTERY_DATA` and `topicVolume` in `faculty.analytics.tsx` with dynamic DB queries.
   - Replace hardcoded arrays in `admin.reports.tsx` with real database aggregations.

2. **Stage 3 (Learning Data Pipeline):**
   - Create `lib/learning-pipeline.js` to ingest, validate, deduplicate, and normalize learning events (quiz attempts, question correctness, difficulty, timestamps).
   - Compute student-topic feature vectors (historical accuracy, recency, attempt counts, trend, confidence).
   - Document features in `docs/ml-data-dictionary.md`.

3. **Stage 4 (ML Feature 1: Topic Mastery Prediction):**
   - Implement data-driven mastery estimation:
     - Baseline heuristic model (Wilson score lower bound / Bayesian smoothed accuracy) for small sample sizes to avoid classifying 1/1 as 100% mastery.
     - Logistic Regression / Random Forest classification pipeline in Python (`ml_service/mastery_model.py`) with reproducible training, cross-validation, and calibration.
     - Predict topic mastery with confidence intervals and explicit `insufficient_data` states.
     - Expose endpoints: `GET /api/mastery/student`, `GET /api/mastery/course/:courseId`, `POST /api/mastery/recalculate`.
     - Update Student and Faculty UI to display authentic predictions with evidence summaries.

4. **Stage 5 (ML Feature 2: Personalized Recommendation Engine):**
   - Discover candidate topics dynamically from student's enrolled courses and approved materials.
   - Rank candidates using multi-factor scoring (mastery deficit, error recency, prerequisite dependencies, material availability, recommendation fatigue penalty).
   - Persist generated recommendations with unique IDs, explanations, and priority levels.
   - Track interactions (`viewed`, `selected`, `completed`, `dismissed`, `feedback`).
   - Expose endpoints: `GET /api/recommendations`, `POST /api/recommendations/:id/interaction`, `GET /api/recommendations/faculty-analytics`.

5. **Stage 6 (RAG Integration):**
   - Inject student's weakest topics into RAG tutor prompt context.
   - Include personalized next-step practice recommendation in tutor response.

6. **Stage 7 & 8 (Testing & Documentation):**
   - Write comprehensive automated tests for the learning pipeline, mastery model, recommendation ranking, and permissions.
   - Execute tests and document real outcomes.

---

## 5. Verification Evidence & Final Audit Resolution

### 5.1 Closed Audit Items & Applied Fixes
| Feature / Page | Previous Classification | Resolved Classification | Applied Fix & Evidence |
| :--- | :--- | :--- | :--- |
| `Admin Analytics (/admin/analytics)` | Mocked | **Working** | Removed fake `+ 1480` offset and static trend array. Bound to live `/api/analytics/telemetry`. |
| `Admin Overview (/admin)` | Mocked | **Working** | Removed `+ 1480` padding; displays true query count from `rag_interaction_logs`. |
| `Admin Reports (/admin/reports)` | Mocked | **Working** | Replaced static `[84, 91, 76, 78, 88, 72]` array with `/api/analytics/institutional-reports` aggregations. |
| `Faculty Analytics (/faculty/analytics)` | Mocked | **Working** | Replaced hardcoded `MASTERY_DATA` and `topicVolume` with dynamic DB aggregation from `topic_mastery` and live course insights. |
| `Student Dashboard (/student)` | Mocked | **Working** | Bound `MasteryRing` to live `overallMastery` score and replaced static `suggestedWeakTopics` with dynamic recommendations from `/api/adaptive/recommendations`. |
| `Adaptive Mastery Card` | Mocked / Broken | **Working** | Integrated explicit `insufficient_data` empty states and live `why this recommendation?` explanations. |
| `Quiz Submission (/api/quizzes/:id/attempt)` | Broken | **Working** | Fixed column mismatch (`user_id`, `subject_id`). Wired itemized question responses into `processQuizAttemptEvent` with Bayesian smoothing and Wilson bounds. |
| `Adaptive Routes (/api/adaptive/*)` | Mocked | **Working** | Removed in-memory Map fallbacks and static seed topics. Connected to real Supabase tables (`subjects`, `documents`, `quizzes`, `topic_mastery`, `audit_logs`). |
| `AI Tutor (/api/tutor/chat)` | Partially Working | **Working** | Enhanced RAG response to dynamically attach explainable `recommended_next_step` based on student's current mastery gaps. |

### 5.2 Automated Test Execution Results
Executed via `npm test` (`node --test tests/*.test.js`):
- **Total Test Suites**: 14
- **Total Tests Executed**: 37
- **Passed**: 37 (100%)
- **Failed**: 0
- **Duration**: ~360ms

Test coverage includes:
1. `tests/meetings-routes.test.js`: 4 suites, 12 tests (slot scheduling, capacity, role enforcement).
2. `tests/teams-meetings.test.js`: 3 suites, 13 tests (token caching, error handling, join URL safety).
3. `tests/ml-learning-pipeline.test.js`: 4 suites, 11 tests (Wilson lower bound math, Bayesian smoothing, schema validation, small sample safeguards, trend detection, multi-factor ranking, student isolation).
4. `tests/ml-e2e-workflow.test.js`: 1 suite, 1 test covering the complete 10-step lifecycle.

### 5.3 Standalone End-to-End Test Execution
Executed via `node scripts/verify-ml-e2e.js`:
- Verified all 10 steps of the learning and recommendation lifecycle:
  1. Faculty uploads/publishes learning material (`doc-dp-01`)
  2. Student Alice enrolls in course (`CS301`)
  3. Student answers 1 question incorrectly
  4. System enforces small-sample safeguard: returns `status: "insufficient_data"`, refuses to guess
  5. Student answers 2 more questions: mastery score computed as 33% (`needs_practice`)
  6. Dynamic recommendation generated: recommends study notes for DP linking directly to `Lecture_07_Dynamic_Programming.pdf`
  7. Student selects and completes recommendation with positive feedback
  8. Interaction recorded in `audit_logs`
  9. Analytics dashboards reflect 100% completion rate
  10. Faculty course aggregate reflects DP critical gap; cross-student privacy is enforced

### 5.4 Production Build Verification
Executed via `npm run build`:
- Client environment compiled: 4,392 modules transformed in 7.15s.
- SSR environment compiled in 4.02s.
- Nitro Vercel production bundle generated without errors.
- Exit code: 0.

