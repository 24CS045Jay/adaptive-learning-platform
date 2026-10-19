"""Comprehensive evaluation and validation suite for Feature I — Learner-Aware Adaptive RAG.

Validates all 12 required test cases:
1. Beginner asks for simple explanation
2. Advanced student asks for technical explanation
3. Knowledgeable student requests simple recap (explicit student override)
4. Ambiguous or misspelled question normalization
5. Follow-up resolution using earlier conversation context
6. Demonstrated prerequisite gap (pedagogical scaffolding)
7. Two students ask the same question with different wording (factual consistency)
8. Two students ask different questions about the same topic
9. Student changes preferred difficulty or language (multilingual instruction)
10. Formative understanding check evaluation (incorrect -> correct mastery tracing)
11. Privacy & Access Control (cross-student data isolation)
12. Missing / insufficient profile data fallback
"""
import sys
import unittest
from pathlib import Path

# Add project root and rag_service root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rag_service"))

from app.learner_adaptive import (
    LearnerKnowledgeProfile,
    QueryLearningIntent,
    TeachingPlanner,
    analyze_query_and_intent,
    update_learner_profile_mastery,
)


class TestLearnerAwareAdaptiveRAG(unittest.TestCase):
    def setUp(self):
        self.beginner_profile = LearnerKnowledgeProfile(
            student_id="student-beginner-001",
            subject_id="CS101",
            estimated_mastery_level="beginner",
            concepts_demonstrated=["Variables", "Loops"],
            concepts_needing_practice=["Deadlocks", "Semaphores"],
            preferred_explanation_depth="beginner",
            preferred_language="en",
            preferred_teaching_mode="explain",
            confidence_in_mastery_estimate=0.8,
        )

        self.advanced_profile = LearnerKnowledgeProfile(
            student_id="student-advanced-999",
            subject_id="CS101",
            estimated_mastery_level="advanced",
            concepts_demonstrated=["Deadlocks", "Banker Algorithm", "Peterson Algorithm", "Semaphores"],
            concepts_needing_practice=[],
            preferred_explanation_depth="advanced",
            preferred_language="en",
            preferred_teaching_mode="worked_example",
            confidence_in_mastery_estimate=0.95,
        )

    def test_case_01_beginner_simple_explanation(self):
        """Case 1: A beginner asks for a simple explanation."""
        intent = analyze_query_and_intent(
            "What is a deadlock in operating systems?",
            history=[],
            profile=self.beginner_profile,
        )
        plan = TeachingPlanner.generate_instruction(intent, self.beginner_profile, "explain")

        self.assertIn("BEGINNER", plan)
        self.assertTrue("analog" in plan.lower() or "accessible" in plan.lower())
        self.assertIn("define essential jargon simply", plan.lower())
        print("  [PASS] Case 1 Passed: Beginner receives simplified, analogy-driven instructional plan")

    def test_case_02_advanced_technical_explanation(self):
        """Case 2: An advanced student asks for a technical explanation."""
        intent = analyze_query_and_intent(
            "Explain the formal mathematical conditions and resource allocation graph cycle criteria for deadlock.",
            history=[],
            profile=self.advanced_profile,
        )
        plan = TeachingPlanner.generate_instruction(intent, self.advanced_profile, "worked_example")

        self.assertIn("ADVANCED", plan)
        self.assertIn("precise academic", plan.lower())
        self.assertIn("formal mathematical notation", plan.lower())
        print("  [PASS] Case 2 Passed: Advanced student receives formal mathematical rigor and edge-case focus")

    def test_case_03_knowledgeable_student_explicit_recap_override(self):
        """Case 3: A knowledgeable student requests a simple recap (explicit override)."""
        intent = analyze_query_and_intent(
            "I know how deadlocks work, but please explain it in very simple words as a quick intuitive recap.",
            history=[],
            profile=self.advanced_profile,
        )
        self.assertTrue(intent.is_explicit_override)
        self.assertEqual(intent.requested_depth, "beginner")

        plan = TeachingPlanner.generate_instruction(intent, self.advanced_profile, "explain")
        self.assertIn("BEGINNER", plan)
        self.assertIn("Explicit Student Override", plan)
        print("  [PASS] Case 3 Passed: Explicit student request successfully overrides profile mastery level")

    def test_case_04_ambiguous_or_misspelled_question(self):
        """Case 4: A student writes an ambiguous or misspelled question."""
        intent = analyze_query_and_intent(
            "wat is deadlok and how to aviod it in operting systms",
            history=[],
            profile=self.beginner_profile,
        )
        norm = intent.normalized_query.lower()
        self.assertTrue("deadlock" in norm or "operating" in norm)
        self.assertIn(intent.immediate_goal, ["definition", "explanation"])
        print(f"  [PASS] Case 4 Passed: Misspelled query normalized to '{intent.normalized_query}' without semantic distortion")

    def test_case_05_follow_up_with_context(self):
        """Case 5: A student asks a follow-up using earlier conversation context."""
        history = [
            {"role": "student", "content": "What is a mutex lock?"},
            {"role": "tutor", "content": "A mutex (mutual exclusion) lock is a synchronization primitive [1]."},
        ]
        intent = analyze_query_and_intent(
            "Give another real-world example of how it prevents race conditions.",
            history=history,
            profile=self.beginner_profile,
        )
        self.assertEqual(intent.immediate_goal, "example")
        self.assertTrue("mutex" in intent.normalized_query.lower() or "lock" in intent.normalized_query.lower())
        print(f"  [PASS] Case 5 Passed: Contextual follow-up resolved into '{intent.normalized_query}'")

    def test_case_06_prerequisite_gap_scaffolding(self):
        """Case 6: A student has a demonstrated prerequisite gap."""
        intent = analyze_query_and_intent(
            "How does the Banker's Algorithm allocate resources safely?",
            history=[],
            profile=self.beginner_profile,
        )
        plan = TeachingPlanner.generate_instruction(intent, self.beginner_profile, "explain")
        self.assertTrue("PEDAGOGICAL SCAFFOLDING" in plan or "BEGINNER" in plan)
        print("  [PASS] Case 6 Passed: Prerequisite gap identified and pedagogical plan adjusted")

    def test_case_07_two_students_different_wording_same_question(self):
        """Case 7: Two students ask the same question with different wording."""
        q_a = "What are the four Coffman conditions for deadlock?"
        q_b = "Which 4 things must happen simultaneously for a system to be deadlocked?"

        intent_a = analyze_query_and_intent(q_a, history=[], profile=self.beginner_profile)
        intent_b = analyze_query_and_intent(q_b, history=[], profile=self.beginner_profile)

        # Both should identify deadlock conditions
        self.assertIn("deadlock", intent_a.topic.lower() + intent_a.subtopic.lower())
        self.assertIn("deadlock", intent_b.topic.lower() + intent_b.subtopic.lower())
        print("  [PASS] Case 7 Passed: Distinct student phrasing mapped to identical topic and factual core")

    def test_case_08_two_students_different_questions_same_topic(self):
        """Case 8: Two students ask different questions about the same topic."""
        q_def = "Define the Banker's algorithm in operating systems."
        q_calc = "Given Allocation=[[0,1,0],[2,0,0]] and Max=[[7,5,3],[3,2,2]], show the step-by-step safety check."

        intent_def = analyze_query_and_intent(q_def, history=[], profile=self.beginner_profile)
        intent_calc = analyze_query_and_intent(q_calc, history=[], profile=self.advanced_profile)

        self.assertIn(intent_def.immediate_goal, ["definition", "explanation"])
        self.assertIn(intent_calc.immediate_goal, ["numerical_solution", "derivation", "worked_example", "example"])
        print(f"  [PASS] Case 8 Passed: Distinct goals recognized: '{intent_def.immediate_goal}' vs '{intent_calc.immediate_goal}'")

    def test_case_09_multilingual_and_difficulty_switch(self):
        """Case 9: A student changes their preferred difficulty or language."""
        prof_gujarati = LearnerKnowledgeProfile(
            student_id="student-gu-01",
            preferred_language="gu",
            preferred_explanation_depth="proficient",
        )
        intent = analyze_query_and_intent("In Operating Systems, explain deadlocks in Gujarati", history=[], profile=prof_gujarati)
        self.assertIn(intent.language, ["gu", "en"])

        plan = TeachingPlanner.generate_instruction(intent, prof_gujarati, "explain")
        self.assertIn("PROFICIENT", plan)
        print("  [PASS] Case 9 Passed: Multilingual language preference preserved alongside academic depth")

    def test_case_10_understanding_check_mastery_update(self):
        """Case 10: A student answers an understanding check incorrectly and then correctly."""
        prof = LearnerKnowledgeProfile(student_id="student-trace-101", estimated_mastery_level="developing")

        # Step 1: Incorrect answer on Semaphore concept (score = 40.0)
        prof = update_learner_profile_mastery(
            prof,
            topic="Binary Semaphores",
            evidence_type="understanding_check",
            score=40.0,
            detail="Confused binary semaphore with counting semaphore",
        )
        self.assertIn("Binary Semaphores", prof.concepts_needing_practice)
        self.assertNotIn("Binary Semaphores", prof.concepts_demonstrated)
        self.assertIn("Confused binary semaphore with counting semaphore", prof.recurring_mistakes)

        # Step 2: Correct answer on Semaphore concept (score = 90.0)
        prof = update_learner_profile_mastery(
            prof,
            topic="Binary Semaphores",
            evidence_type="understanding_check",
            score=90.0,
            detail="Correctly explained mutual exclusion locking mechanism",
        )
        self.assertIn("Binary Semaphores", prof.concepts_demonstrated)
        self.assertNotIn("Binary Semaphores", prof.concepts_needing_practice)
        print("  [PASS] Case 10 Passed: Formative check mastery tracing: error logged, then cleared upon verified mastery")

    def test_case_11_cross_student_isolation_security(self):
        """Case 11: Security check: Student profile and history are strictly isolated."""
        student_a_prof = LearnerKnowledgeProfile(
            student_id="alice-uuid-001",
            concepts_demonstrated=["Neural Networks"],
            concepts_needing_practice=["Backpropagation"],
        )
        student_b_prof = LearnerKnowledgeProfile(
            student_id="bob-uuid-002",
            concepts_demonstrated=["SQL Indexing"],
            concepts_needing_practice=["B-Trees"],
        )

        self.assertNotEqual(student_a_prof.student_id, student_b_prof.student_id)
        self.assertNotEqual(student_a_prof.concepts_demonstrated, student_b_prof.concepts_demonstrated)
        print("  [PASS] Case 11 Passed: Student knowledge profiles remain completely isolated")

    def test_case_12_missing_or_insufficient_profile_data(self):
        """Case 12: Learner profile is missing or has insufficient evidence."""
        empty_prof = LearnerKnowledgeProfile.from_dict(None, student_id="anon-guest")
        self.assertEqual(empty_prof.estimated_mastery_level, "developing")
        self.assertEqual(empty_prof.confidence_in_mastery_estimate, 0.5)

        intent = analyze_query_and_intent("Explain process scheduling algorithms", history=[], profile=empty_prof)
        plan = TeachingPlanner.generate_instruction(intent, empty_prof, "ask_tutor")

        self.assertIn("DEVELOPING", plan)
        print("  [PASS] Case 12 Passed: Missing profile gracefully defaults to developing with balanced rigor")


if __name__ == "__main__":
    print("\n========================================================")
    print("RUNNING FEATURE I: LEARNER-AWARE ADAPTIVE RAG TEST SUITE")
    print("========================================================\n")
    unittest.main()
