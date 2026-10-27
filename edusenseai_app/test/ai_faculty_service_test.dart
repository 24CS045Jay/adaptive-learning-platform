import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/config/app_config.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/services/ai_faculty_service.dart';

class MockAiFacultyApiClient implements ApiClient {
  String? lastGetPath;
  Map<String, dynamic>? lastGetParams;
  String? lastPostPath;
  dynamic lastPostData;

  dynamic getResponseData;
  dynamic postResponseData;

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
    throw UnimplementedError();
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
  group('Phase 7 AiFacultyService Unit Tests', () {
    late MockAiFacultyApiClient mockClient;
    late AiFacultyService service;

    setUp(() {
      mockClient = MockAiFacultyApiClient();
      service = AiFacultyService(apiClient: mockClient);
    });

    test('getConfig calls aiFacultyConfigEndpoint and returns configuration', () async {
      mockClient.getResponseData = {
        'status': 'ok',
        'providers': {
          'sarvam': {'active': true, 'stt_model': 'saaras:v4'},
          'tavus': {'active': true, 'replica_id': 'r72f7f7f7c8b'},
        },
      };

      final config = await service.getConfig();
      expect(mockClient.lastGetPath, AppConfig.aiFacultyConfigEndpoint);
      expect(config['status'], 'ok');
      expect(config['providers']['sarvam']['active'], isTrue);
    });

    test('getSubjects calls aiFacultySubjectsEndpoint', () async {
      mockClient.getResponseData = {
        'subjects': [
          {'id': 'sub-1', 'code': 'CSUC501', 'name': 'Operating Systems'},
        ],
      };

      final subs = await service.getSubjects();
      expect(mockClient.lastGetPath, AppConfig.aiFacultySubjectsEndpoint);
      expect(subs.length, 1);
      expect(subs.first['code'], 'CSUC501');
    });

    test('createSession posts parameters to aiFacultySessionEndpoint', () async {
      mockClient.postResponseData = {
        'sessionId': 'sess-101',
        'conversationId': 'conv-101',
        'subject': {'code': 'CSUC501', 'name': 'Operating Systems'},
        'language_code': 'gu-IN',
        'speaker': 'anushka',
        'greeting': 'નમસ્તે!',
      };

      final session = await service.createSession(
        subjectCode: 'CSUC501',
        languageCode: 'gu-IN',
        speaker: 'anushka',
      );

      expect(mockClient.lastPostPath, AppConfig.aiFacultySessionEndpoint);
      expect(session.sessionId, 'sess-101');
      expect(session.languageCode, 'gu-IN');
      expect(session.greeting, 'નમસ્તે!');
    });

    test('interact sends question to aiFacultyInteractEndpoint', () async {
      mockClient.postResponseData = {
        'turnId': 1,
        'spoken_answer': 'Virtual memory isolates processes.',
        'full_answer': 'Virtual memory isolates processes safely [1].',
        'sources': [
          {'file_name': 'OS_Ch3.pdf', 'page': 5},
        ],
        'confidence': 0.95,
        'grounded': true,
        'language_code': 'en-IN',
      };

      final result = await service.interact(
        question: 'What is virtual memory?',
        subjectCode: 'CSUC501',
        languageCode: 'en-IN',
        turnId: 1,
      );

      expect(mockClient.lastPostPath, AppConfig.aiFacultyInteractEndpoint);
      expect(result.turnId, 1);
      expect(result.spokenAnswer, 'Virtual memory isolates processes.');
      expect(result.sources.first.fileName, 'OS_Ch3.pdf');
    });

    test('synthesizeSpeech calls aiFacultySynthesizeEndpoint', () async {
      mockClient.postResponseData = {
        'audio_base64': 'AAAA',
        'spoken_text': 'Hello students',
      };

      final result = await service.synthesizeSpeech(
        text: 'Hello students',
        languageCode: 'en-IN',
      );

      expect(mockClient.lastPostPath, AppConfig.aiFacultySynthesizeEndpoint);
      expect(result['audio_base64'], 'AAAA');
    });

    test('startTavusSession calls aiFacultyTavusSessionEndpoint', () async {
      mockClient.postResponseData = {
        'conversation_id': 'cvi-777',
        'conversation_url': 'https://daily.co/tavus-call',
        'status': 'active',
        'configured': true,
      };

      final tavus = await service.startTavusSession(
        subjectName: 'Operating Systems',
        subjectCode: 'CSUC501',
      );

      expect(mockClient.lastPostPath, AppConfig.aiFacultyTavusSessionEndpoint);
      expect(tavus.conversationId, 'cvi-777');
      expect(tavus.conversationUrl, 'https://daily.co/tavus-call');
    });

    test('endTavusSession calls aiFacultyTavusEndEndpoint', () async {
      mockClient.postResponseData = {'status': 'ended'};
      await service.endTavusSession('cvi-777');
      expect(mockClient.lastPostPath, AppConfig.aiFacultyTavusEndEndpoint);
    });
  });
}
