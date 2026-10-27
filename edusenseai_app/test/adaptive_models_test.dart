import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/adaptive_profile_model.dart';
import 'package:edusenseai/models/practice_quiz_model.dart';

void main() {
  group('Phase 6 Adaptive Models Unit Tests', () {
    test('LearnerPreferences parses JSON and handles defaults correctly', () {
      final json = {
        'studentId': 'stu-42',
        'explanationLevel': 'advanced',
        'preferredLanguage': 'hi',
        'preferredTeachingMode': 'quiz',
        'dailyGoalMinutes': 45,
        'enableSpacedRepetition': true,
      };

      final prefs = LearnerPreferences.fromJson(json);

      expect(prefs.studentId, 'stu-42');
      expect(prefs.explanationLevel, 'advanced');
      expect(prefs.preferredLanguage, 'hi');
      expect(prefs.preferredTeachingMode, 'quiz');
      expect(prefs.dailyGoalMinutes, 45);
      expect(prefs.enableSpacedRepetition, isTrue);

      final outMap = prefs.toJson();
      expect(outMap['explanationLevel'], 'advanced');
      expect(outMap['preferredLanguage'], 'hi');
      expect(outMap['dailyGoalMinutes'], 45);
    });

    test('LearnerKnowledgeProfile parses demonstrated and needing practice concepts', () {
      final json = {
        'student_id': 'stu-42',
        'estimated_mastery_level': 'proficient',
        'concepts_demonstrated': ['Binary Trees', 'Recursion'],
        'concepts_needing_practice': ['Dynamic Programming'],
        'recent_quiz_scores': [80, 90, 85],
        'confidence_in_mastery_estimate': 0.85,
      };

      final kp = LearnerKnowledgeProfile.fromJson(json);

      expect(kp.studentId, 'stu-42');
      expect(kp.estimatedMasteryLevel, 'proficient');
      expect(kp.conceptsDemonstrated, contains('Binary Trees'));
      expect(kp.conceptsNeedingPractice, contains('Dynamic Programming'));
      expect(kp.recentQuizScores, [80, 90, 85]);
      expect(kp.confidence, 0.85);
    });

    test('TopicMasteryItem flags status and mastery labels honestly', () {
      final strongItem = TopicMasteryItem.fromJson({
        'id': 'tm-1',
        'topic': 'Graph BFS',
        'score': 85,
        'totalAttempts': 3,
        'status': 'strong',
      });
      expect(strongItem.isMastered, isTrue);
      expect(strongItem.isWeak, isFalse);

      final weakItem = TopicMasteryItem.fromJson({
        'id': 'tm-2',
        'topic': 'Dijkstra Algorithm',
        'score': 45,
        'totalAttempts': 2,
        'status': 'needs_practice',
      });
      expect(weakItem.isWeak, isTrue);
      expect(weakItem.isMastered, isFalse);

      final uncalibratedItem = TopicMasteryItem.fromJson({
        'id': 'tm-3',
        'topic': 'Tries',
        'score': 100,
        'totalAttempts': 1,
        'status': 'insufficient_data',
      });
      expect(uncalibratedItem.isInsufficientData, isTrue);
      expect(uncalibratedItem.isMastered, isFalse);
    });

    test('AdaptiveProfileModel parses authentic profile with spaced repetition queue', () {
      final json = {
        'success': true,
        'hasData': true,
        'stats': {
          'overallMasteryPct': 78,
          'totalTopicsTracked': 5,
          'evaluatedTopicsCount': 3,
          'weakCount': 1,
          'masteredCount': 2,
          'reviewDueCount': 1,
        },
        'preferences': {
          'explanationLevel': 'intermediate',
          'preferredLanguage': 'gu',
          'dailyGoalMinutes': 30,
        },
        'learnerKnowledgeProfile': {
          'student_id': 'stu-1',
          'estimated_mastery_level': 'proficient',
          'concepts_demonstrated': ['Sorting'],
          'concepts_needing_practice': ['Hashing'],
          'recent_quiz_scores': [75, 80],
          'confidence_in_mastery_estimate': 0.7,
        },
        'topicMasteries': [
          {
            'id': 'tm-1',
            'topic': 'Sorting',
            'score': 90,
            'totalAttempts': 3,
            'status': 'strong',
          },
          {
            'id': 'tm-2',
            'topic': 'Hashing',
            'score': 50,
            'totalAttempts': 2,
            'status': 'needs_practice',
          },
        ],
        'weakTopics': [
          {
            'id': 'tm-2',
            'topic': 'Hashing',
            'score': 50,
            'totalAttempts': 2,
            'status': 'needs_practice',
          },
        ],
        'spacedRepetitionQueue': [
          {
            'id': 'tm-2',
            'topic': 'Hashing',
            'score': 50,
            'totalAttempts': 2,
            'status': 'needs_practice',
          },
        ],
      };

      final profile = AdaptiveProfileModel.fromJson(json);

      expect(profile.hasData, isTrue);
      expect(profile.overallMasteryPct, 78);
      expect(profile.totalTopicsTracked, 5);
      expect(profile.evaluatedTopicsCount, 3);
      expect(profile.weakCount, 1);
      expect(profile.masteredCount, 2);
      expect(profile.reviewDueCount, 1);
      expect(profile.preferences.preferredLanguage, 'gu');
      expect(profile.knowledgeProfile?.estimatedMasteryLevel, 'proficient');
      expect(profile.topicMasteries.length, 2);
      expect(profile.weakTopics.first.topic, 'Hashing');
      expect(profile.spacedRepetitionQueue.first.topic, 'Hashing');
    });

    test('PracticeQuizModel and PracticeSubmissionResult parse properly', () {
      final quizJson = {
        'success': true,
        'topic': 'Binary Trees',
        'difficulty': 'medium',
        'questions': [
          {
            'id': 'q-1',
            'question': 'What is the maximum depth of a binary tree with N nodes?',
            'options': ['O(N)', 'O(log N)', 'O(1)', 'O(N^2)'],
            'correctIndex': 0,
            'topicTag': 'Binary Trees',
            'explanation': 'In a skewed binary tree, depth can be N.',
          },
        ],
      };

      final quiz = PracticeQuizModel.fromJson(quizJson);

      expect(quiz.success, isTrue);
      expect(quiz.topic, 'Binary Trees');
      expect(quiz.questions.length, 1);
      expect(quiz.questions.first.question, contains('maximum depth'));
      expect(quiz.questions.first.correctIndex, 0);

      final eval = PracticeSubmissionResult.fromJson(
        {
          'attemptId': 'att-123',
          'score': 100,
          'correctCount': 1,
          'totalQuestions': 1,
          'topicPerformance': {'Binary Trees': {'total': 1, 'correct': 1}},
        },
        questions: quiz.questions,
        studentAnswers: {'q-1': 'O(N)'},
      );

      expect(eval.attemptId, 'att-123');
      expect(eval.score, 100);
      expect(eval.correctCount, 1);
      expect(eval.reviews.length, 1);
      expect(eval.reviews.first.isCorrect, isTrue);
      expect(eval.reviews.first.selectedAnswer, 'O(N)');
    });
  });
}
