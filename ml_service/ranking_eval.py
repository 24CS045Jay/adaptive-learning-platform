"""
ml_service/ranking_eval.py — Recommendation Engine Ranking Evaluation

Evaluates the multi-factor explainable recommendation baseline against
Popularity and Random baselines using standard information retrieval metrics:
Precision@K, Recall@K, NDCG@K, and Mean Reciprocal Rank (MRR).
"""

import os
import json
import numpy as np
import pandas as pd


def dcg_at_k(r, k):
    """Discounted Cumulative Gain at rank K."""
    r = np.asfarray(r)[:k]
    if r.size:
        return np.sum(r / np.log2(np.arange(2, r.size + 2)))
    return 0.0


def ndcg_at_k(r, k):
    """Normalized Discounted Cumulative Gain at rank K."""
    dcg_max = dcg_at_k(sorted(r, reverse=True), k)
    if not dcg_max:
        return 0.0
    return dcg_at_k(r, k) / dcg_max


def evaluate_recommendation_ranking(n_students=100, seed=42):
    """
    Simulates student learning states across enrolled courses and evaluates
    candidate recommendation ranking strategies:
    1. Random Ranking
    2. Course Popularity Baseline
    3. EduSense Explainable Multi-Factor Ranking (mastery deficit + recency + resource availability - fatigue)
    
    Ground Truth Relevance Definition:
    A recommended item is truly relevant (relevance=1) if:
    - Student actually struggled on that topic (true latent mastery < 0.60) AND material/quiz is available, OR
    - It is an unpracticed essential prerequisite topic requiring diagnostic assessment.
    """
    np.random.seed(seed)

    topics = [
        "Data Structures & Linked Lists",
        "Binary Search Trees & Graphs",
        "Dynamic Programming",
        "Relational Schema Design & SQL",
        "Database Indexing & B-Trees",
        "RAG Architecture & Embeddings",
        "Prompt Engineering & Context",
        "Vector Retrieval & Top-K",
    ]

    strategies = {
        "Random": {"p@1": [], "p@3": [], "r@3": [], "ndcg@3": [], "mrr": []},
        "Popularity_Baseline": {"p@1": [], "p@3": [], "r@3": [], "ndcg@3": [], "mrr": []},
        "Explainable_Multi_Factor": {"p@1": [], "p@3": [], "r@3": [], "ndcg@3": [], "mrr": []},
    }

    # Simulate global topic popularity (how often students view each topic)
    topic_popularity = {t: np.random.uniform(10, 100) for t in topics}

    for s_id in range(n_students):
        # Generate student true profile
        student_profiles = {}
        for t in topics:
            true_mastery = np.clip(np.random.normal(0.60, 0.22), 0.10, 0.95)
            has_doc = bool(np.random.rand() > 0.3)
            has_quiz = bool(np.random.rand() > 0.4)
            has_attempts = bool(np.random.rand() > 0.25)
            observed_score = round(true_mastery * 100) if has_attempts else None
            days_since = np.random.exponential(4.0) if has_attempts else 999.0
            dismissed = bool(np.random.rand() < 0.10)

            # Ground truth relevance: 1 if student genuinely needs this topic, else 0
            is_relevant = 1 if ((true_mastery < 0.60 and (has_doc or has_quiz)) or (not has_attempts and has_quiz)) else 0

            student_profiles[t] = {
                "true_mastery": true_mastery,
                "has_doc": has_doc,
                "has_quiz": has_quiz,
                "observed_score": observed_score,
                "days_since": days_since,
                "dismissed": dismissed,
                "is_relevant": is_relevant,
            }

        total_relevant = sum(p["is_relevant"] for p in student_profiles.values())
        if total_relevant == 0:
            continue

        # Strategy 1: Random Ranking
        random_ranked = list(topics)
        np.random.shuffle(random_ranked)

        # Strategy 2: Popularity Ranking
        popularity_ranked = sorted(topics, key=lambda t: topic_popularity[t], reverse=True)

        # Strategy 3: Explainable Multi-Factor Ranking
        def compute_multi_factor_score(t):
            p = student_profiles[t]
            mastery_deficit = (100 - p["observed_score"]) / 100 if p["observed_score"] is not None else 0.50
            recency_need = min(1.0, p["days_since"] / 7.0)
            res_avail = (0.5 if p["has_doc"] else 0.0) + (0.5 if p["has_quiz"] else 0.0)
            fatigue = 0.5 if p["dismissed"] else 0.0
            return max(0.0, min(1.0, 0.45 * mastery_deficit + 0.25 * recency_need + 0.30 * res_avail - fatigue))

        multi_factor_ranked = sorted(topics, key=compute_multi_factor_score, reverse=True)

        # Calculate metrics for each strategy
        for name, ranked_list in [
            ("Random", random_ranked),
            ("Popularity_Baseline", popularity_ranked),
            ("Explainable_Multi_Factor", multi_factor_ranked),
        ]:
            relevance_vector = [student_profiles[t]["is_relevant"] for t in ranked_list]

            # Precision@1
            p_at_1 = relevance_vector[0]
            # Precision@3
            p_at_3 = sum(relevance_vector[:3]) / 3.0
            # Recall@3
            r_at_3 = sum(relevance_vector[:3]) / float(total_relevant)
            # NDCG@3
            ndcg_3 = ndcg_at_k(relevance_vector, 3)
            # MRR
            first_rel = next((idx + 1 for idx, rel in enumerate(relevance_vector) if rel == 1), 0)
            mrr = (1.0 / first_rel) if first_rel > 0 else 0.0

            strategies[name]["p@1"].append(p_at_1)
            strategies[name]["p@3"].append(p_at_3)
            strategies[name]["r@3"].append(r_at_3)
            strategies[name]["ndcg@3"].append(ndcg_3)
            strategies[name]["mrr"].append(mrr)

    # Aggregate results
    summary = {}
    for name, metrics in strategies.items():
        summary[name] = {
            "Precision@1": round(float(np.mean(metrics["p@1"])), 4),
            "Precision@3": round(float(np.mean(metrics["p@3"])), 4),
            "Recall@3": round(float(np.mean(metrics["r@3"])), 4),
            "NDCG@3": round(float(np.mean(metrics["ndcg@3"])), 4),
            "MRR": round(float(np.mean(metrics["mrr"])), 4),
        }

    sum_df = pd.DataFrame(summary).T
    print("\n" + "=" * 65)
    print("      RECOMMENDATION ENGINE RANKING EVALUATION REPORT        ")
    print("=" * 65)
    print(sum_df.to_string())
    print("=" * 65 + "\n")

    # Save evaluation report JSON
    output_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, "recommendation_ranking_report.json")
    with open(report_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"[Recommendation Eval] Ranking metrics saved to: {report_path}")
    return summary


if __name__ == "__main__":
    evaluate_recommendation_ranking()
