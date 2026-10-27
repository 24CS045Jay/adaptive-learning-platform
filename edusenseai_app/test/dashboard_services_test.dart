import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/services/adaptive_service.dart';
import 'package:edusenseai/services/analytics_service.dart';
import 'package:edusenseai/services/document_service.dart';
import 'package:edusenseai/services/meeting_service.dart';
import 'package:edusenseai/services/subject_service.dart';

/// Mock ApiClient returning canned responses for service testing.
class MockApiClient implements ApiClient {
  dynamic getResponseData;
  dynamic postResponseData;
  dynamic patchResponseData;
  bool shouldThrow = false;
  AppException? exceptionToThrow;

  String? lastGetPath;
  String? lastPostPath;
  String? lastPatchPath;
  dynamic lastPostData;
  dynamic lastPatchData;

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
      throw exceptionToThrow ?? NetworkException('Post request failed.');
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
    lastPatchPath = path;
    lastPatchData = data;
    if (shouldThrow) {
      throw exceptionToThrow ?? NetworkException('Patch request failed.');
    }
    return Response<T>(
      data: patchResponseData as T?,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(requestOptions: RequestOptions(path: path));
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return Response<T>(requestOptions: RequestOptions(path: path));
  }
}

void main() {
  group('Phase 3 Services Unit Tests', () {
    late MockApiClient mockApi;

    setUp(() {
      mockApi = MockApiClient();
    });

    test('SubjectService fetches subjects and processes enrollment', () async {
      final service = SubjectService(apiClient: mockApi);

      mockApi.getResponseData = [
        {
          'id': 'subj-1',
          'name': 'Cloud Computing',
          'code': 'CS401',
          'semester': 7,
          'departmentId': 'CE',
          'enrolledStudentIds': ['stu-1'],
        },
      ];

      final subjects = await service.getSubjects();
      expect(subjects.length, 1);
      expect(subjects.first.code, 'CS401');
      expect(mockApi.lastGetPath, '/api/subjects');

      mockApi.postResponseData = {
        'id': 'subj-1',
        'name': 'Cloud Computing',
        'code': 'CS401',
        'semester': 7,
        'departmentId': 'CE',
        'enrolledStudentIds': ['stu-1', 'stu-2'],
      };

      final enrolled = await service.enrollSubject('subj-1');
      expect(enrolled.enrolledStudentIds.contains('stu-2'), isTrue);
      expect(mockApi.lastPostPath, '/api/subjects/subj-1/enroll');
    });

    test('DocumentService fetches documents and processes approvals', () async {
      final service = DocumentService(apiClient: mockApi);

      mockApi.getResponseData = [
        {
          '_id': 'doc-10',
          'fileName': 'DBMS_Notes.pdf',
          'fileUrl': 'http://file.com',
          'status': 'pending',
          'chunkCount': 10,
        },
      ];

      final docs = await service.getDocuments(status: 'pending');
      expect(docs.length, 1);
      expect(docs.first.fileName, 'DBMS_Notes.pdf');

      mockApi.patchResponseData = {
        'message': 'Approved',
        'document': {
          '_id': 'doc-10',
          'fileName': 'DBMS_Notes.pdf',
          'status': 'approved',
          'chunkCount': 10,
        },
      };

      final approved = await service.approveDocument('doc-10');
      expect(approved.isApproved, isTrue);
      expect(mockApi.lastPatchPath, '/api/documents/doc-10/approve');
    });

    test('AdaptiveService fetches learner profile and preferences', () async {
      final service = AdaptiveService(apiClient: mockApi);

      mockApi.getResponseData = {
        'hasData': true,
        'stats': {'overallMasteryPct': 82, 'totalTopicsTracked': 5},
        'weakTopics': [],
      };

      final profile = await service.getProfile();
      expect(profile.hasData, isTrue);
      expect(profile.overallMasteryPct, 82);
      expect(mockApi.lastGetPath, '/api/adaptive/profile');
    });

    test('MeetingService fetches consultations and updates status', () async {
      final service = MeetingService(apiClient: mockApi);

      mockApi.getResponseData = [
        {
          'id': 'b-1',
          'topic': 'Graph BFS/DFS',
          'facultyName': 'Dr. Patel',
          'status': 'requested',
        },
      ];

      final bookings = await service.getFacultyBookings();
      expect(bookings.length, 1);
      expect(bookings.first.isRequested, isTrue);

      mockApi.patchResponseData = {
        'booking': {
          'id': 'b-1',
          'topic': 'Graph BFS/DFS',
          'facultyName': 'Dr. Patel',
          'status': 'approved',
          'teamsJoinUrl': 'https://teams.microsoft.com/meet/123',
        },
      };

      final updated = await service.updateBookingStatus('b-1', 'approved');
      expect(updated.isApproved, isTrue);
      expect(updated.teamsJoinUrl, isNotNull);
    });

    test(
      'AnalyticsService fetches institutional telemetry and audit logs',
      () async {
        final service = AnalyticsService(apiClient: mockApi);

        mockApi.getResponseData = {
          'totalQueries': 540,
          'groundingAccuracyPct': 95.2,
          'helpfulnessRatePct': 98,
          'registeredUsers': {
            'total': 80,
            'students': 60,
            'faculty': 15,
            'admins': 5,
          },
        };

        final telemetry = await service.getTelemetry();
        expect(telemetry.totalQueries, 540);
        expect(telemetry.groundingAccuracyPct, 95.2);
        expect(telemetry.studentCount, 60);

        mockApi.getResponseData = [
          {
            'id': 'a-1',
            'actor': 'admin@edusense.ai',
            'action': 'USER_REGISTER',
            'time': '10/21/2026',
          },
        ];

        final logs = await service.getAuditLogs();
        expect(logs.length, 1);
        expect(logs.first.action, 'USER_REGISTER');
      },
    );

    test('Services rethrow AppException on network error', () async {
      final service = SubjectService(apiClient: mockApi);
      mockApi.shouldThrow = true;
      mockApi.exceptionToThrow = NetworkException('Server is unreachable.');

      expect(
        () async => await service.getSubjects(),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
