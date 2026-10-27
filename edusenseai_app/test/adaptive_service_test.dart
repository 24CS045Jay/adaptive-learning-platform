import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/config/app_config.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/services/adaptive_service.dart';

class MockAdaptiveApiClient implements ApiClient {
  String? lastGetPath;
  Map<String, dynamic>? lastGetParams;
  String? lastPostPath;
  dynamic lastPostData;
  String? lastPutPath;
  dynamic lastPutData;

  dynamic getResponseData;
  dynamic postResponseData;
  dynamic putResponseData;

  @override
  Dio get rawDio => Dio();

  @override
  String get baseUrl => 'http://10.0.2.2:5000';

  @override
  void updateBaseUrl(String newBaseUrl) {}

  @override
  void setAuthToken(String? token) {}

  @override
  void clearAuthToken() {}

  @override
  String? get authToken => 'mock-token';

  @override
  void Function()? onUnauthorized;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    int maxRetries = 2,
    Duration retryDelay = const Duration(milliseconds: 500),
  }) async {
    lastGetPath = path;
    lastGetParams = queryParameters;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: getResponseData as T,
      statusCode: 200,
    );
  }

  @override
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    lastPostPath = path;
    lastPostData = data;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: postResponseData as T,
      statusCode: 200,
    );
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    lastPutPath = path;
    lastPutData = data;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: putResponseData as T,
      statusCode: 200,
    );
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    throw UnimplementedError();
  }
}

void main() {
  group('Phase 6 AdaptiveService Unit Tests', () {
    late MockAdaptiveApiClient mockClient;
    late AdaptiveService adaptiveService;

    setUp(() {
      mockClient = MockAdaptiveApiClient();
      adaptiveService = AdaptiveService(apiClient: mockClient);
    });

    test('getProfile calls adaptiveProfileEndpoint and parses response', () async {
      mockClient.getResponseData = {
        'success': true,
        'hasData': true,
        'stats': {
          'overallMasteryPct': 82,
          'totalTopicsTracked': 4,
          'evaluatedTopicsCount': 3,
        },
        'topicMasteries': [
          {'topic': 'Recursion', 'score': 85, 'totalAttempts': 3},
        ],
      };

      final profile = await adaptiveService.getProfile();

      expect(mockClient.lastGetPath, AppConfig.adaptiveProfileEndpoint);
      expect(profile.hasData, isTrue);
      expect(profile.overallMasteryPct, 82);
      expect(profile.topicMasteries.first.topic, 'Recursion');
    });

    test('updatePreferences calls adaptivePreferencesEndpoint with payload', () async {
      mockClient.putResponseData = {
        'success': true,
        'preferences': {
          'explanationLevel': 'advanced',
          'preferredLanguage': 'hi',
          'dailyGoalMinutes': 40,
        },
      };

      final prefs = await adaptiveService.updatePreferences(
        explanationLevel: 'advanced',
        preferredLanguage: 'hi',
        dailyGoalMinutes: 40,
      );

      expect(mockClient.lastPutPath, AppConfig.adaptivePreferencesEndpoint);
      expect(mockClient.lastPutData['explanationLevel'], 'advanced');
      expect(mockClient.lastPutData['preferredLanguage'], 'hi');
      expect(prefs.explanationLevel, 'advanced');
      expect(prefs.preferredLanguage, 'hi');
    });

    test('getRecommendations queries endpoint with optional subjectId', () async {
      mockClient.getResponseData = {
        'success': true,
        'recommendations': [
          {'id': 'rec-1', 'topic': 'Graphs', 'reason': 'Practice due'},
        ],
      };

      final recs = await adaptiveService.getRecommendations(subjectId: 'sub-1');

      expect(mockClient.lastGetPath, AppConfig.adaptiveRecommendationsEndpoint);
      expect(mockClient.lastGetParams?['subjectId'], 'sub-1');
      expect(recs.length, 1);
      expect(recs.first['topic'], 'Graphs');
    });

    test('getPracticeQuiz posts topic and difficulty to adaptivePracticeQuizEndpoint', () async {
      mockClient.postResponseData = {
        'success': true,
        'topic': 'Tree Traversals',
        'difficulty': 'hard',
        'questions': [
          {
            'id': 'q-10',
            'question': 'What is inorder traversal?',
            'options': ['Left-Root-Right', 'Root-Left-Right'],
            'correctIndex': 0,
          },
        ],
      };

      final quiz = await adaptiveService.getPracticeQuiz(
        topic: 'Tree Traversals',
        difficulty: 'hard',
      );

      expect(mockClient.lastPostPath, AppConfig.adaptivePracticeQuizEndpoint);
      expect(mockClient.lastPostData['topic'], 'Tree Traversals');
      expect(mockClient.lastPostData['difficulty'], 'hard');
      expect(quiz.questions.length, 1);
      expect(quiz.questions.first.options.first, 'Left-Root-Right');
    });

    test('submitFeedback posts student rating to feedbackEndpoint', () async {
      mockClient.postResponseData = {'id': 'fb-1', 'rating': 'up'};

      final ok = await adaptiveService.submitFeedback(
        question: 'What is a stack?',
        answer: 'A LIFO data structure.',
        isThumbsUp: true,
        comment: 'Great explanation',
      );

      expect(mockClient.lastPostPath, AppConfig.feedbackEndpoint);
      expect(mockClient.lastPostData['rating'], 'up');
      expect(mockClient.lastPostData['isThumbsUp'], isTrue);
      expect(ok, isTrue);
    });

    test('resetProfile sends POST to adaptiveResetEndpoint', () async {
      mockClient.postResponseData = {'success': true};

      await adaptiveService.resetProfile();

      expect(mockClient.lastPostPath, AppConfig.adaptiveResetEndpoint);
    });
  });
}
