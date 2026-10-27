import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/adaptive_profile_model.dart';
import 'package:edusenseai/models/practice_quiz_model.dart';
import 'package:edusenseai/models/quiz_model.dart';
import 'package:edusenseai/providers/adaptive_learning_provider.dart';
import 'package:edusenseai/services/adaptive_service.dart';
import 'package:edusenseai/services/quiz_service.dart';

class MockAdaptiveServiceForProvider implements AdaptiveService {
  bool shouldThrow = false;
  bool wasResetCalled = false;
  LearnerPreferences savedPrefs = const LearnerPreferences();

  @override
  Future<AdaptiveProfileModel> getProfile() async {
    if (shouldThrow) throw Exception('Profile load failed');
    return const AdaptiveProfileModel(
      hasData: true,
      overallMasteryPct: 85,
      totalTopicsTracked: 6,
      evaluatedTopicsCount: 4,
      weakCount: 1,
      masteredCount: 3,
      reviewDueCount: 1,
      preferences: LearnerPreferences(
        explanationLevel: 'intermediate',
        preferredLanguage: 'en',
      ),
      weakTopics: [
        TopicMasteryItem(
          topic: 'Dynamic Programming',
          score: 45,
          totalAttempts: 2,
          status: 'needs_practice',
        ),
      ],
      spacedRepetitionQueue: [
        TopicMasteryItem(
          topic: 'Binary Search',
          score: 75,
          totalAttempts: 2,
          status: 'developing',
        ),
      ],
      topicMasteries: [
        TopicMasteryItem(
          topic: 'Sorting',
          score: 95,
          totalAttempts: 3,
          status: 'strong',
        ),
      ],
    );
  }

  @override
  Future<List<Map<String, dynamic>>> getRecommendations({
    String? subjectId,
  }) async {
    return [
      {
        'id': 'rec-1',
        'topic': 'Dynamic Programming',
        'title': 'Revise DP Concepts',
        'reason': 'Low mastery score',
      },
    ];
  }

  @override
  Future<LearnerPreferences> updatePreferences({
    String? explanationLevel,
    String? preferredLanguage,
    String? preferredTeachingMode,
    int? dailyGoalMinutes,
    bool? enableSpacedRepetition,
  }) async {
    savedPrefs = LearnerPreferences(
      explanationLevel: explanationLevel ?? 'intermediate',
      preferredLanguage: preferredLanguage ?? 'en',
      dailyGoalMinutes: dailyGoalMinutes ?? 30,
    );
    return savedPrefs;
  }

  @override
  Future<PracticeQuizModel> getPracticeQuiz({
    String? topic,
    String? subjectId,
    String difficulty = 'medium',
  }) async {
    return PracticeQuizModel(
      topic: topic ?? 'General Practice',
      difficulty: difficulty,
      questions: const [
        PracticeQuestion(
          id: 'q-1',
          question: 'What is memoization?',
          options: ['Caching results', 'Recomputing every time'],
          correctIndex: 0,
          topicTag: 'Dynamic Programming',
        ),
      ],
    );
  }

  @override
  Future<void> recordInteraction({
    required String recommendationId,
    required String eventType,
    String? topic,
    String? courseId,
    String? feedbackValue,
  }) async {}

  @override
  Future<void> resetProfile() async {
    wasResetCalled = true;
  }

  @override
  Future<bool> submitFeedback({
    required String question,
    required String answer,
    required bool isThumbsUp,
    String? comment,
    String? subjectId,
  }) async => true;
}

class MockQuizServiceForProvider implements QuizService {
  @override
  Future<List<QuizModel>> getQuizzes({String? subjectId}) async => [];

  @override
  Future<QuizModel> getQuiz(String quizId) async =>
      const QuizModel(id: 'q-1', title: 'Quiz 1');

  @override
  Future<QuizAttemptResult> submitAttempt(String quizId, dynamic answers) async {
    return const QuizAttemptResult(
      attemptId: 'att-100',
      score: 100,
      correctCount: 1,
      totalQuestions: 1,
    );
  }
}

void main() {
  group('Phase 6 AdaptiveLearningProvider State Tests', () {
    late MockAdaptiveServiceForProvider mockService;
    late MockQuizServiceForProvider mockQuiz;
    late AdaptiveLearningProvider provider;

    setUp(() {
      mockService = MockAdaptiveServiceForProvider();
      mockQuiz = MockQuizServiceForProvider();
      provider = AdaptiveLearningProvider(
        adaptiveService: mockService,
        quizService: mockQuiz,
      );
    });

    test('loadProfile loads profile, recommendations, and sets state', () async {
      await provider.loadProfile();

      expect(provider.isLoading, isFalse);
      expect(provider.hasData, isTrue);
      expect(provider.overallMasteryPct, 85);
      expect(provider.weakTopics.length, 1);
      expect(provider.weakTopics.first.topic, 'Dynamic Programming');
      expect(provider.spacedRepetitionQueue.length, 1);
      expect(provider.recommendations.length, 1);
      expect(provider.errorMessage, isNull);
    });

    test('updatePreferences updates learner preferences successfully', () async {
      await provider.loadProfile();

      final ok = await provider.updatePreferences(
        explanationLevel: 'advanced',
        preferredLanguage: 'gu',
        dailyGoalMinutes: 45,
      );

      expect(ok, isTrue);
      expect(provider.preferences.explanationLevel, 'advanced');
      expect(provider.preferences.preferredLanguage, 'gu');
      expect(provider.preferences.dailyGoalMinutes, 45);
    });

    test('loadPracticeQuiz loads AI questions and updates currentPracticeQuiz', () async {
      final quiz = await provider.loadPracticeQuiz(
        topic: 'Dynamic Programming',
      );

      expect(quiz.questions.length, 1);
      expect(provider.currentPracticeQuiz?.topic, 'Dynamic Programming');
      expect(provider.isPracticeLoading, isFalse);
    });

    test('submitAssessment evaluates practice answers and creates score review', () async {
      final quiz = await provider.loadPracticeQuiz(topic: 'Dynamic Programming');

      final result = await provider.submitAssessment(
        quiz: quiz,
        answers: {'q-1': 'Caching results'},
      );

      expect(result, isNotNull);
      expect(result?.score, 100);
      expect(result?.correctCount, 1);
      expect(result?.reviews.first.isCorrect, isTrue);
      expect(provider.lastSubmission?.score, 100);
    });

    test('resetProfile invokes reset on backend and reloads profile', () async {
      await provider.resetProfile();

      expect(mockService.wasResetCalled, isTrue);
      expect(provider.isLoading, isFalse);
    });
  });
}
