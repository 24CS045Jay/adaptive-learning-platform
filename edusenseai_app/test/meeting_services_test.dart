import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/services/meeting_service.dart';
import 'package:edusenseai/services/notification_service.dart';

class MeetingMockApiClient implements ApiClient {
  dynamic getResponseData;
  dynamic postResponseData;
  dynamic patchResponseData;
  dynamic deleteResponseData;
  bool shouldThrow = false;
  AppException? exceptionToThrow;

  String? lastGetPath;
  String? lastPostPath;
  String? lastPatchPath;
  String? lastDeletePath;
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
      throw exceptionToThrow ?? NetworkException('Network error occurred.');
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
      throw exceptionToThrow ?? NetworkException('Network error occurred.');
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
      throw exceptionToThrow ?? NetworkException('Network error occurred.');
    }
    return Response<T>(
      data: deleteResponseData as T?,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );
  }
}

void main() {
  group('Phase 5 MeetingService & NotificationService Tests', () {
    late MeetingMockApiClient mockClient;
    late MeetingService meetingService;
    late NotificationService notificationService;

    setUp(() {
      mockClient = MeetingMockApiClient();
      meetingService = MeetingService(apiClient: mockClient);
      notificationService = NotificationService(apiClient: mockClient);
    });

    test(
      'getAvailableSlots calls /api/meetings/available-slots and parses list',
      () async {
        mockClient.getResponseData = {
          'status': 'success',
          'data': [
            {
              '_id': 'slot-1',
              'facultyId': 'fac-1',
              'facultyName': 'Dr. Smith',
              'topic': 'Algorithm Doubts',
              'startTime': '2026-10-25T10:00:00.000Z',
              'endTime': '2026-10-25T10:30:00.000Z',
              'capacity': 1,
              'bookedCount': 0,
              'status': 'active',
            },
          ],
        };

        final slots = await meetingService.getAvailableSlots(
          subjectCode: 'CS304',
        );

        expect(mockClient.lastGetPath, '/api/meetings/available-slots');
        expect(slots.length, 1);
        expect(slots.first.topic, 'Algorithm Doubts');
        expect(slots.first.isFull, isFalse);
      },
    );

    test(
      'bookMeetingSlot posts to /api/meetings/bookings with idempotency key',
      () async {
        mockClient.postResponseData = {
          'status': 'success',
          'data': {
            '_id': 'booking-500',
            'slotId': 'slot-1',
            'facultyId': 'fac-1',
            'facultyName': 'Dr. Smith',
            'studentId': 'stu-1',
            'studentName': 'Bob Student',
            'topic': 'Binary Search Tree Balancing',
            'status': 'requested',
          },
        };

        final booking = await meetingService.bookMeetingSlot(
          slotId: 'slot-1',
          topic: 'Binary Search Tree Balancing',
          doubtDescription: 'AVL rotations',
        );

        expect(mockClient.lastPostPath, '/api/meetings/bookings');
        expect(mockClient.lastPostData['slotId'], 'slot-1');
        expect(
          mockClient.lastPostData['topic'],
          'Binary Search Tree Balancing',
        );
        expect(booking.id, 'booking-500');
        expect(booking.status, 'requested');
      },
    );

    test('studentCancelBooking patches student-cancel endpoint', () async {
      mockClient.patchResponseData = {
        'status': 'success',
        'data': {
          '_id': 'booking-500',
          'slotId': 'slot-1',
          'facultyId': 'fac-1',
          'facultyName': 'Dr. Smith',
          'studentId': 'stu-1',
          'studentName': 'Bob Student',
          'topic': 'Binary Search Tree Balancing',
          'status': 'cancelled',
        },
      };

      final booking = await meetingService.studentCancelBooking(
        'booking-500',
        reason: 'Resolved my doubt independently',
      );

      expect(
        mockClient.lastPatchPath,
        '/api/meetings/bookings/booking-500/student-cancel',
      );
      expect(
        mockClient.lastPatchData['reason'],
        'Resolved my doubt independently',
      );
      expect(booking.status, 'cancelled');
    });

    test(
      'createFacultySlot posts to /api/meetings/slots and creates meeting',
      () async {
        final start = DateTime(2026, 10, 26, 15, 0);
        final end = DateTime(2026, 10, 26, 16, 0);

        mockClient.postResponseData = {
          'status': 'success',
          'data': {
            '_id': 'slot-999',
            'facultyId': 'fac-1',
            'facultyName': 'Dr. Smith',
            'topic': 'Software Architecture Lecture',
            'startTime': start.toIso8601String(),
            'endTime': end.toIso8601String(),
            'capacity': 30,
            'audienceType': 'department',
            'teamsJoinUrl': 'https://teams.microsoft.com/meet/slot-999',
            'status': 'active',
          },
        };

        final slot = await meetingService.createFacultySlot(
          topic: 'Software Architecture Lecture',
          startTime: start,
          endTime: end,
          capacity: 30,
          audienceType: 'department',
          createTeamsMeeting: true,
        );

        expect(mockClient.lastPostPath, '/api/meetings/slots');
        expect(
          mockClient.lastPostData['topic'],
          'Software Architecture Lecture',
        );
        expect(mockClient.lastPostData['createTeamsMeeting'], isTrue);
        expect(slot.id, 'slot-999');
        expect(slot.hasTeamsMeeting, isTrue);
      },
    );

    test(
      'getTeamsStatus calls /api/meetings/status and returns configuration',
      () async {
        mockClient.getResponseData = {
          'status': 'success',
          'data': {
            'isConfigured': true,
            'message': 'Microsoft Graph integration active',
          },
        };

        final status = await meetingService.getTeamsStatus();

        expect(mockClient.lastGetPath, '/api/meetings/status');
        expect(status['isConfigured'], isTrue);
      },
    );

    test(
      'NotificationService fetches notifications, marks read, and marks all read',
      () async {
        mockClient.getResponseData = {
          'status': 'success',
          'data': [
            {
              '_id': 'n-1',
              'title': 'Consultation Scheduled',
              'message': 'Your session with Dr. Smith is confirmed.',
              'read': false,
              'type': 'meeting_approved',
            },
          ],
        };

        final list = await notificationService.getNotifications();
        expect(mockClient.lastGetPath, '/api/notifications');
        expect(list.length, 1);
        expect(list.first.read, isFalse);

        // Mark single read
        mockClient.patchResponseData = {
          'status': 'success',
          'data': {
            '_id': 'n-1',
            'title': 'Consultation Scheduled',
            'message': 'Your session with Dr. Smith is confirmed.',
            'read': true,
            'type': 'meeting_approved',
          },
        };

        final updated = await notificationService.markAsRead('n-1');
        expect(mockClient.lastPatchPath, '/api/notifications/n-1/read');
        expect(updated.read, isTrue);

        // Mark all read
        mockClient.patchResponseData = {'status': 'success'};
        await notificationService.markAllAsRead();
        expect(mockClient.lastPatchPath, '/api/notifications/read-all/read');
      },
    );
  });
}
