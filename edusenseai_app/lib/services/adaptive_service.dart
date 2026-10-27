import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/adaptive_profile_model.dart';
import '../models/practice_quiz_model.dart';

/// Service connecting to the adaptive learning engine, topic mastery tracking,
/// learner preferences, and recommendation interactions.
class AdaptiveService {
  final ApiClient _apiClient;

  AdaptiveService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Retrieves the authentic adaptive mastery profile for the authenticated student.
  Future<AdaptiveProfileModel> getProfile() async {
    try {
      final response = await _apiClient.get(AppConfig.adaptiveProfileEndpoint);
      if (response.data is Map<String, dynamic>) {
        return AdaptiveProfileModel.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      return const AdaptiveProfileModel();
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to load adaptive learner profile: $e');
    }
  }

  /// Updates student's personalized learning preferences on backend.
  Future<LearnerPreferences> updatePreferences({
    String? explanationLevel,
    String? preferredLanguage,
    String? preferredTeachingMode,
    int? dailyGoalMinutes,
    bool? enableSpacedRepetition,
  }) async {
    try {
      final payload = <String, dynamic>{
        if (explanationLevel != null) 'explanationLevel': explanationLevel,
        if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
        if (preferredTeachingMode != null)
          'preferredTeachingMode': preferredTeachingMode,
        if (dailyGoalMinutes != null) 'dailyGoalMinutes': dailyGoalMinutes,
        if (enableSpacedRepetition != null)
          'enableSpacedRepetition': enableSpacedRepetition,
      };

      final response = await _apiClient.put(
        AppConfig.adaptivePreferencesEndpoint,
        data: payload,
      );

      if (response.data is Map<String, dynamic> &&
          response.data['preferences'] is Map<String, dynamic>) {
        return LearnerPreferences.fromJson(
          response.data['preferences'] as Map<String, dynamic>,
        );
      }
      return const LearnerPreferences();
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to update learner preferences: $e');
    }
  }

  /// Retrieves explainable topic recommendations for the student.
  Future<List<Map<String, dynamic>>> getRecommendations({
    String? subjectId,
  }) async {
    try {
      final query = subjectId != null ? {'subjectId': subjectId} : null;
      final response = await _apiClient.get(
        AppConfig.adaptiveRecommendationsEndpoint,
        queryParameters: query,
      );
      if (response.data is Map && response.data['recommendations'] is List) {
        return (response.data['recommendations'] as List)
            .whereType<Map<String, dynamic>>()
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      return [];
    }
  }

  /// Captures interaction telemetry for explainable recommendations.
  Future<void> recordInteraction({
    required String recommendationId,
    required String eventType, // 'viewed', 'selected', 'completed', 'dismissed', 'feedback'
    String? topic,
    String? courseId,
    String? feedbackValue,
  }) async {
    try {
      final endpoint =
          '${AppConfig.adaptiveRecommendationsEndpoint}/$recommendationId/interaction';
      await _apiClient.post(
        endpoint,
        data: {
          'eventType': eventType,
          if (topic != null) 'topic': topic,
          if (courseId != null) 'courseId': courseId,
          if (feedbackValue != null) 'feedbackValue': feedbackValue,
        },
      );
    } catch (_) {
      // Telemetry non-fatal
    }
  }

  /// Generates dynamic practice questions grounded in course question bank.
  Future<PracticeQuizModel> getPracticeQuiz({
    String? topic,
    String? subjectId,
    String difficulty = 'medium',
  }) async {
    try {
      final response = await _apiClient.post(
        AppConfig.adaptivePracticeQuizEndpoint,
        data: {
          if (topic != null && topic.isNotEmpty) 'topic': topic,
          if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
          'difficulty': difficulty,
        },
      );

      if (response.data is Map<String, dynamic>) {
        return PracticeQuizModel.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      return const PracticeQuizModel();
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to generate practice assessment: $e');
    }
  }

  /// Resets learner profile data and returns default preferences.
  Future<void> resetProfile() async {
    try {
      await _apiClient.post(AppConfig.adaptiveResetEndpoint);
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to reset adaptive learning profile: $e');
    }
  }

  /// Submits student feedback on an AI Tutor explanation.
  Future<bool> submitFeedback({
    required String question,
    required String answer,
    required bool isThumbsUp,
    String? comment,
    String? subjectId,
  }) async {
    try {
      final response = await _apiClient.post(
        AppConfig.feedbackEndpoint,
        data: {
          'question': question,
          'answer': answer,
          'rating': isThumbsUp ? 'up' : 'down',
          'isThumbsUp': isThumbsUp,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
          if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }
}
