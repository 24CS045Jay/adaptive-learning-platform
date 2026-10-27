import 'package:flutter/foundation.dart';
import '../core/errors/app_exception.dart';
import '../models/adaptive_profile_model.dart';
import '../models/practice_quiz_model.dart';
import '../services/adaptive_service.dart';
import '../services/quiz_service.dart';
import '../services/session_cleanup_service.dart';

/// Provider for Phase 6 Personalized Learning, Analytics, and Self-Assessment.
class AdaptiveLearningProvider extends ChangeNotifier {
  final AdaptiveService _adaptiveService;
  final QuizService _quizService;

  bool _isLoading = false;
  bool _isUpdatingPrefs = false;
  bool _isPracticeLoading = false;
  String? _errorMessage;
  AdaptiveProfileModel? _profile;
  List<Map<String, dynamic>> _recommendations = [];
  PracticeQuizModel? _currentPracticeQuiz;
  PracticeSubmissionResult? _lastSubmission;
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  AdaptiveLearningProvider({
    AdaptiveService? adaptiveService,
    QuizService? quizService,
  }) : _adaptiveService = adaptiveService ?? AdaptiveService(),
       _quizService = quizService ?? QuizService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all adaptive profile and assessment state upon sign-out
  void clearSessionData() {
    _profile = null;
    _recommendations = [];
    _currentPracticeQuiz = null;
    _lastSubmission = null;
    _errorMessage = null;
    if (!_disposed && hasListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    SessionCleanupService().unregisterHandler(_cleanupHandler);
    super.dispose();
  }

  // Getters
  bool get isLoading => _isLoading;
  bool get isUpdatingPrefs => _isUpdatingPrefs;
  bool get isPracticeLoading => _isPracticeLoading;
  String? get errorMessage => _errorMessage;
  AdaptiveProfileModel? get profile => _profile;
  List<Map<String, dynamic>> get recommendations =>
      List.unmodifiable(_recommendations);
  PracticeQuizModel? get currentPracticeQuiz => _currentPracticeQuiz;
  PracticeSubmissionResult? get lastSubmission => _lastSubmission;

  bool get hasData => _profile?.hasData ?? false;
  int? get overallMasteryPct => _profile?.overallMasteryPct;
  List<TopicMasteryItem> get weakTopics => _profile?.weakTopics ?? [];
  List<TopicMasteryItem> get spacedRepetitionQueue =>
      _profile?.spacedRepetitionQueue ?? [];
  List<TopicMasteryItem> get topicMasteries => _profile?.topicMasteries ?? [];
  LearnerPreferences get preferences =>
      _profile?.preferences ?? const LearnerPreferences();
  LearnerKnowledgeProfile? get knowledgeProfile => _profile?.knowledgeProfile;

  /// Loads full authentic learner profile and recommendations from backend.
  Future<void> loadProfile({bool refresh = false, String? subjectId}) async {
    if (!refresh && _profile != null && _errorMessage == null) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _adaptiveService.getProfile(),
        _adaptiveService.getRecommendations(subjectId: subjectId),
      ]);

      _profile = results[0] as AdaptiveProfileModel;
      _recommendations = results[1] as List<Map<String, dynamic>>;
      _errorMessage = null;
    } on AppException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'Failed to load adaptive learning profile: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Updates personalized learner preferences and updates local state.
  Future<bool> updatePreferences({
    String? explanationLevel,
    String? preferredLanguage,
    String? preferredTeachingMode,
    int? dailyGoalMinutes,
    bool? enableSpacedRepetition,
  }) async {
    _isUpdatingPrefs = true;
    notifyListeners();

    try {
      final updatedPrefs = await _adaptiveService.updatePreferences(
        explanationLevel: explanationLevel,
        preferredLanguage: preferredLanguage,
        preferredTeachingMode: preferredTeachingMode,
        dailyGoalMinutes: dailyGoalMinutes,
        enableSpacedRepetition: enableSpacedRepetition,
      );

      if (_profile != null) {
        _profile = AdaptiveProfileModel(
          hasData: _profile!.hasData,
          overallMasteryPct: _profile!.overallMasteryPct,
          totalTopicsTracked: _profile!.totalTopicsTracked,
          evaluatedTopicsCount: _profile!.evaluatedTopicsCount,
          weakCount: _profile!.weakCount,
          masteredCount: _profile!.masteredCount,
          reviewDueCount: _profile!.reviewDueCount,
          explanationLevel: updatedPrefs.explanationLevel,
          preferences: updatedPrefs,
          knowledgeProfile: _profile!.knowledgeProfile,
          topicMasteries: _profile!.topicMasteries,
          weakTopics: _profile!.weakTopics,
          spacedRepetitionQueue: _profile!.spacedRepetitionQueue,
        );
      }
      return true;
    } catch (e) {
      _errorMessage = 'Failed to update preferences: $e';
      return false;
    } finally {
      _isUpdatingPrefs = false;
      notifyListeners();
    }
  }

  /// Loads AI-generated practice questions for a specific topic or subject.
  Future<PracticeQuizModel> loadPracticeQuiz({
    String? topic,
    String? subjectId,
    String difficulty = 'medium',
  }) async {
    _isPracticeLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final quiz = await _adaptiveService.getPracticeQuiz(
        topic: topic,
        subjectId: subjectId,
        difficulty: difficulty,
      );
      _currentPracticeQuiz = quiz;
      return quiz;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return const PracticeQuizModel(success: false);
    } catch (e) {
      _errorMessage = 'Failed to generate practice questions: $e';
      return const PracticeQuizModel(success: false);
    } finally {
      _isPracticeLoading = false;
      notifyListeners();
    }
  }

  /// Submits student responses for assessment and triggers mastery recalculation.
  Future<PracticeSubmissionResult?> submitAssessment({
    required PracticeQuizModel quiz,
    required Map<String, dynamic> answers,
    String? quizId,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      PracticeSubmissionResult result;
      if (quizId != null && quizId.isNotEmpty) {
        final res = await _quizService.submitAttempt(quizId, answers);
        result = PracticeSubmissionResult(
          attemptId: res.attemptId,
          score: res.score,
          correctCount: res.correctCount,
          totalQuestions: res.totalQuestions,
          topicPerformance: res.topicPerformance,
        );
      } else {
        // Evaluate practice assessment locally and report
        int correct = 0;
        for (final q in quiz.questions) {
          final sel = answers[q.id]?.toString() ?? '';
          final corr =
              q.correctIndex < q.options.length ? q.options[q.correctIndex] : '';
          if (sel == corr || sel == '${q.correctIndex}') {
            correct++;
          }
        }
        final score =
            quiz.questions.isNotEmpty
                ? ((correct / quiz.questions.length) * 100).round()
                : 0;

        result = PracticeSubmissionResult.fromJson(
          {
            'attemptId': 'practice-${DateTime.now().millisecondsSinceEpoch}',
            'score': score,
            'correctCount': correct,
            'totalQuestions': quiz.questions.length,
          },
          questions: quiz.questions,
          studentAnswers: answers,
        );
      }

      _lastSubmission = result;

      // Silently refresh profile to reflect new attempt
      loadProfile(refresh: true);

      return result;
    } catch (e) {
      _errorMessage = 'Failed to submit assessment: $e';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Records student click/action on an explainable recommendation.
  Future<void> recordRecommendationAction(
    String recommendationId, {
    required String eventType,
    String? topic,
    String? courseId,
  }) async {
    await _adaptiveService.recordInteraction(
      recommendationId: recommendationId,
      eventType: eventType,
      topic: topic,
      courseId: courseId,
    );
  }

  /// Resets personalization data and returns to transparent initial state.
  Future<void> resetProfile() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _adaptiveService.resetProfile();
      await loadProfile(refresh: true);
    } catch (e) {
      _errorMessage = 'Failed to reset profile: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
