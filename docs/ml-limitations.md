# EduSense AI — Machine Learning Limitations, Edge Cases & Operational Boundaries

This document provides transparent documentation of model limitations, cold start boundaries, data sparsity handling, and future roadmap requirements for EduSense AI.

---

## 1. Small Sample Size & Cold Start Boundaries

### 1.1 The Under-Assessment Problem
In real educational environments, a newly enrolled student or newly introduced topic often starts with zero or one quiz attempt.
- **Strict Safeguard**: EduSense AI explicitly enforces an assessment evidence threshold of **at least 2 verified attempts** before producing an estimated mastery percentage.
- **Behavior with 0 or 1 attempt**:
  - API returns `status: "insufficient_data"`.
  - `estimatedMasteryScore` is set to `null` (not 0%, not 50%, and not a fabricated number).
  - UI displays an intuitive onboarding state: *"Awaiting Assessment Signals — Complete an adaptive diagnostic quiz to establish baseline mastery."*
- **Recommendation Fallback**: For unassessed topics, the recommendation engine generates a diagnostic `practice_quiz` or introductory `review_material`, rather than assuming the student has mastered or failed the concept.

### 1.2 Laplace Smoothing & Wilson Bound
Even after 2-5 attempts, statistical variance can be extreme (e.g., 2 correct out of 2 does not mean 100% understanding of the entire topic).
- **Bayesian Smoothing**: Uses a Beta(2, 2) uninformative prior:
  $$\text{Smoothed Accuracy} = \frac{\text{correct} + 2}{\text{attempts} + 4}$$
  Shrinks initial small sample estimates toward a 50% baseline.
- **Wilson Lower Bound**: Computes the 95% confidence interval lower bound, penalizing small sample sizes and rewarding consistent high-volume performance.

---

## 2. Proxy Labels vs True Internal Mastery

### 2.1 Proxy Target Definition
Supervised learning models predict `next_question_correct` $\in \{0, 1\}$.
- **Limitation**: Question correctness is a measurable proxy for mastery, but cannot measure latent cognitive depth, creative problem-solving, or unobserved test anxiety.
- **Policy**: Topic mastery scores are presented as **pedagogical guidance estimates**, never as absolute judgments of human intelligence, and are strictly prohibited from being used for automatic course failure or disciplinary decisions.

### 2.2 Difficulty Calibration
- Question difficulty is currently categorized categorically as `"easy"`, `"medium"`, or `"hard"`.
- As the dataset grows, Item Response Theory (IRT 2-PL or 3-PL models) can be fitted to estimate continuous question discrimination and difficulty parameters ($\alpha_j, \beta_j$).

---

## 3. Recommendation Feedback Loop Boundaries

### 3.1 Click-Through Rate is Not Learning Improvement
- A student clicking or opening a recommended document proves engagement, but does **not** prove comprehension.
- **Outcome Verification**: EduSense AI requires a subsequent assessment attempt (`attempts` record on the topic) before updating the student's mastery score.
- **Fatigue Protection**: Recommendations dismissed by the student in the last 24 hours incur a $-0.50$ penalty, ensuring variety and preventing nagging.

---

## 4. Current Offline Evaluation Metrics Summary

From `ml_service/models/mastery_model_metadata.json` and `recommendation_ranking_report.json`:

### 4.1 Topic Mastery Prediction (8,192 records, 120 students, GroupShuffleSplit)
- **Calibrated Logistic Regression**: Test Accuracy 78.76%, ROC-AUC 0.6672, Brier Score 0.1582, ECE 0.0170.
- **Champion Gradient Boosting**: Test Accuracy 78.63%, Brier Score 0.1596, ECE **0.0146**.
- **Bayesian Baseline**: Test Accuracy 74.42%, Brier Score 0.1846, ECE 0.1586.
- **Conclusion**: Supervised learning reduced Expected Calibration Error by 10x and improved predictive accuracy over the baseline.

### 4.2 Recommendation Ranking (100 students, 8 topics)
- **Precision@1**: 0.9388 (vs 0.4490 Random, 0.5408 Popularity)
- **NDCG@3**: 0.8530 (vs 0.4753 Random, 0.5528 Popularity)
- **MRR**: 0.9626 (vs 0.6605 Random, 0.7277 Popularity)

---

## 5. Prerequisites for Future Production Retraining

To transition from the current trained champion artifact to regular production retraining:
1. Accumulate at least **500 verified attempt records** in `attempts` across at least 30 students.
2. Maintain distinct student IDs and normalized topic tags across question items.
3. Schedule periodic execution of `python ml_service/mastery_model.py` via cron/background worker during off-peak hours.
4. Champion model is automatically preserved if candidate evaluation fails to beat baseline Brier score.
