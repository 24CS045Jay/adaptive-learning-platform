import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/quiz_model.dart';

/// Assessment attempt result returned by EduSense AI learning pipeline.
class QuizAttemptResult {
  final String attemptId;
  final int score;
  final int correctCount;
  final int totalQuestions;
  final Map<String, dynamic> topicPerformance;

  const QuizAttemptResult({
    required this.attemptId,
    required this.score,
    required this.correctCount,
    required this.totalQuestions,
    this.topicPerformance = const {},
  });

  factory QuizAttemptResult.fromJson(Map<String, dynamic> json) {
    final rawTopicPerf = json['topicPerformance'];
    final topicMap =
        rawTopicPerf is Map<String, dynamic>
            ? rawTopicPerf
            : <String, dynamic>{};

    return QuizAttemptResult(
      attemptId: (json['attemptId'] ?? json['id'] ?? '').toString(),
      score: (json['score'] as num?)?.toInt() ?? 0,
      correctCount: (json['correctCount'] as num?)?.toInt() ?? 0,
      totalQuestions: (json['totalQuestions'] as num?)?.toInt() ?? 0,
      topicPerformance: topicMap,
    );
  }
}

/// Service managing subject quizzes, questions, and attempt evaluations.
class QuizService {
  final ApiClient _apiClient;

  QuizService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Fetches quizzes, optionally filtered by subject.
  Future<List<QuizModel>> getQuizzes({String? subjectId}) async {
    try {
      final queryParams = <String, dynamic>{
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
      };

      final response = await _apiClient.get(
        AppConfig.quizzesEndpoint,
        queryParameters: queryParams.isEmpty ? null : queryParams,
      );

      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => QuizModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch quizzes: $e');
    }
  }

  /// Fetches full quiz details with questions.
  Future<QuizModel> getQuiz(String quizId) async {
    try {
      final response = await _apiClient.get(
        '${AppConfig.quizzesEndpoint}/$quizId',
      );

      if (response.data is Map<String, dynamic>) {
        return QuizModel.fromJson(response.data as Map<String, dynamic>);
      }
      throw AppException('Invalid quiz payload returned.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to load quiz details: $e');
    }
  }

  /// Submits student answers for evaluation through the learning pipeline.
  Future<QuizAttemptResult> submitAttempt(
    String quizId,
    dynamic answers,
  ) async {
    try {
      dynamic response;
      try {
        response = await _apiClient.post(
          '${AppConfig.quizzesEndpoint}/$quizId/attempts',
          data: {'answers': answers},
        );
      } catch (firstErr) {
        response = await _apiClient.post(
          '${AppConfig.quizzesEndpoint}/$quizId/attempt',
          data: {'answers': answers},
        );
      }

      if (response.data is Map<String, dynamic>) {
        return QuizAttemptResult.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      throw AppException('Failed to parse quiz evaluation.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Quiz submission failed: $e');
    }
  }
}
