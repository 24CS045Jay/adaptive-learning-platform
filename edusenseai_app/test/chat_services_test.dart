import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/services/quiz_service.dart';
import 'package:edusenseai/services/tutor_service.dart';

class ChatMockApiClient implements ApiClient {
  dynamic getResponseData;
  dynamic postResponseData;
  dynamic deleteResponseData;
  bool shouldThrow = false;
  AppException? exceptionToThrow;

  String? lastGetPath;
  String? lastPostPath;
  String? lastDeletePath;
  dynamic lastPostData;

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
  String? get authToken => 'mock-jwt-token';

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
    if (shouldThrow) {
      throw exceptionToThrow ?? NetworkException('Network error occurred.');
    }
    return Response<T>(
      data: getResponseData as T?,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
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
    if (shouldThrow) {
      throw exceptionToThrow ?? NetworkException('Post error occurred.');
    }
    return Response<T>(
      data: postResponseData as T?,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
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
  Future<Response<T>> put<T>(
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
    lastDeletePath = path;
    if (shouldThrow) {
      throw exceptionToThrow ?? NetworkException('Delete error occurred.');
    }
    return Response<T>(
      data: deleteResponseData as T?,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }
}

void main() {
  group('Phase 4 TutorService & QuizService Tests', () {
    late ChatMockApiClient mockApi;
    late TutorService tutorService;
    late QuizService quizService;

    setUp(() {
      mockApi = ChatMockApiClient();
      tutorService = TutorService(apiClient: mockApi);
      quizService = QuizService(apiClient: mockApi);
    });

    test(
      'TutorService.askQuestion submits query and parses RAG response',
      () async {
        mockApi.postResponseData = {
          'conversationId': 'conv-456',
          'answer': 'Flutter is Google’s UI toolkit for multiplatform apps.',
          'confidence': 0.95,
          'escalated': false,
          'sources': [
            {
              'document_id': 'doc-1',
              'file_name': 'Module1_Overview.pdf',
              'page': 2,
              'snippet': 'Flutter uses Dart to build natively compiled apps.',
            },
          ],
          'follow_up': ['What is a Widget tree?'],
        };

        final response = await tutorService.askQuestion(
          question: 'What is Flutter?',
          subjectId: 'subj-1',
          subjectCode: 'CS304',
        );

        expect(mockApi.lastPostPath, '/api/tutor/ask');
        expect(mockApi.lastPostData['question'], 'What is Flutter?');
        expect(mockApi.lastPostData['subjectId'], 'subj-1');
        expect(response.conversationId, 'conv-456');
        expect(response.message.isTutor, isTrue);
        expect(response.message.text, contains('Google’s UI toolkit'));
        expect(response.message.sources.length, 1);
        expect(response.message.sources.first.fileName, 'Module1_Overview.pdf');
        expect(response.message.followUp, contains('What is a Widget tree?'));
      },
    );

    test('TutorService.askQuestion throws when API returns error', () async {
      mockApi.shouldThrow = true;
      mockApi.exceptionToThrow = ForbiddenException('Enrollment required.');

      expect(
        () => tutorService.askQuestion(question: 'Explain neural networks.'),
        throwsA(isA<ForbiddenException>()),
      );
    });

    test(
      'TutorService.getConversations lists prior student chat sessions',
      () async {
        mockApi.getResponseData = [
          {
            '_id': 'conv-1',
            'title': 'StatefulWidget lifecycle',
            'subjectName': 'Mobile Development',
            'subjectCode': 'CS304',
            'updatedAt': '2026-10-21T10:00:00.000Z',
            'messagesCount': 4,
          },
        ];

        final conversations = await tutorService.getConversations();
        expect(mockApi.lastGetPath, '/api/conversations');
        expect(conversations.length, 1);
        expect(conversations.first.title, 'StatefulWidget lifecycle');
        expect(conversations.first.subjectCode, 'CS304');
      },
    );

    test('TutorService.deleteConversation calls DELETE endpoint', () async {
      await tutorService.deleteConversation('conv-1');
      expect(mockApi.lastDeletePath, '/api/conversations/conv-1');
    });

    test('QuizService.getQuizzes retrieves subject quizzes', () async {
      mockApi.getResponseData = [
        {
          '_id': 'quiz-1',
          'title': 'Async Dart & Streams Quiz',
          'subjectId': {'_id': 'subj-1', 'name': 'Mobile Dev', 'code': 'CS304'},
          'isAiGenerated': false,
          'questions': [],
        },
      ];

      final quizzes = await quizService.getQuizzes(subjectId: 'subj-1');
      expect(mockApi.lastGetPath, '/api/quizzes');
      expect(quizzes.length, 1);
      expect(quizzes.first.title, 'Async Dart & Streams Quiz');
      expect(quizzes.first.subjectCode, 'CS304');
    });

    test(
      'QuizService.submitAttempt submits answers and parses score',
      () async {
        mockApi.postResponseData = {
          'attemptId': 'att-789',
          'score': 85,
          'correctCount': 4,
          'totalQuestions': 5,
        };

        final result = await quizService.submitAttempt('quiz-1', [
          {'questionId': 'q-1', 'selectedOption': 'StreamBuilder'},
        ]);

        expect(mockApi.lastPostPath, '/api/quizzes/quiz-1/attempts');
        expect(result.attemptId, 'att-789');
        expect(result.score, 85);
        expect(result.correctCount, 4);
      },
    );
  });
}
