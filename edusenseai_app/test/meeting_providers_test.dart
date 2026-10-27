import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/eligible_student_model.dart';
import 'package:edusenseai/models/meeting_model.dart';
import 'package:edusenseai/models/meeting_slot_model.dart';
import 'package:edusenseai/models/notification_model.dart';
import 'package:edusenseai/providers/meeting_provider.dart';
import 'package:edusenseai/providers/notification_provider.dart';
import 'package:edusenseai/services/meeting_service.dart';
import 'package:edusenseai/services/notification_service.dart';

class FakeMeetingServiceImpl implements MeetingService {
  bool shouldThrow = false;

  List<MeetingBookingModel> studentBookings = [
    const MeetingBookingModel(
      id: 'b-1',
      slotId: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-1',
      studentName: 'Alice',
      topic: 'Recursion trees',
      status: 'requested',
    ),
  ];

  List<MeetingSlotModel> availableSlots = [
    MeetingSlotModel(
      id: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      topic: 'Weekly Office Hours',
      date: '2026-10-25',
      startTime: DateTime(2026, 10, 25, 10, 0),
      endTime: DateTime(2026, 10, 25, 10, 30),
      capacity: 2,
      bookedCount: 1,
      status: 'active',
    ),
  ];

  List<MeetingBookingModel> facultyBookings = [
    const MeetingBookingModel(
      id: 'b-2',
      slotId: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-2',
      studentName: 'Charlie',
      topic: 'Dynamic Programming',
      status: 'requested',
    ),
  ];

  List<MeetingSlotModel> facultySlots = [
    MeetingSlotModel(
      id: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      topic: 'Weekly Office Hours',
      date: '2026-10-25',
      startTime: DateTime(2026, 10, 25, 10, 0),
      endTime: DateTime(2026, 10, 25, 10, 30),
      capacity: 2,
      bookedCount: 1,
      status: 'active',
    ),
  ];

  List<EligibleStudentModel> eligibleStudents = [
    const EligibleStudentModel(
      id: 'stu-1',
      name: 'Alice',
      email: 'alice@edusense.ai',
      departmentId: 'CE',
    ),
  ];

  @override
  Future<List<MeetingBookingModel>> getStudentBookings() async {
    if (shouldThrow) throw Exception('Failed student bookings');
    return studentBookings;
  }

  @override
  Future<List<MeetingSlotModel>> getAvailableSlots({
    String? subjectCode,
  }) async {
    if (shouldThrow) throw Exception('Failed available slots');
    return availableSlots;
  }

  @override
  Future<List<MeetingBookingModel>> getFacultyBookings() async {
    if (shouldThrow) throw Exception('Failed faculty bookings');
    return facultyBookings;
  }

  @override
  Future<List<MeetingSlotModel>> getFacultySlots() async {
    if (shouldThrow) throw Exception('Failed faculty slots');
    return facultySlots;
  }

  @override
  Future<List<EligibleStudentModel>> getEligibleStudents({
    String? departmentId,
    String? subjectId,
  }) async {
    if (shouldThrow) throw Exception('Failed eligible students');
    return eligibleStudents;
  }

  @override
  Future<Map<String, dynamic>> getTeamsStatus() async {
    return {'isConfigured': true, 'message': 'Microsoft Graph ready'};
  }

  @override
  Future<MeetingBookingModel> bookMeetingSlot({
    required String slotId,
    required String topic,
    String? doubtDescription,
    String? meetingType,
    String? idempotencyKey,
  }) async {
    if (shouldThrow) throw Exception('Booking conflict');
    return MeetingBookingModel(
      id: 'new-b',
      slotId: slotId,
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-1',
      studentName: 'Alice',
      topic: topic,
      doubtDescription: doubtDescription ?? '',
      status: 'requested',
    );
  }

  @override
  Future<MeetingBookingModel> studentCancelBooking(
    String bookingId, {
    String? reason,
  }) async {
    if (shouldThrow) throw Exception('Cancel error');
    return const MeetingBookingModel(
      id: 'b-1',
      slotId: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-1',
      studentName: 'Alice',
      topic: 'Recursion trees',
      status: 'cancelled',
    );
  }

  @override
  Future<MeetingBookingModel> updateBookingStatus(
    String bookingId,
    String status, {
    String? facultyNotes,
    String? rejectionReason,
  }) async {
    if (shouldThrow) throw Exception('Update error');
    return MeetingBookingModel(
      id: bookingId,
      slotId: 's-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-2',
      studentName: 'Charlie',
      topic: 'Dynamic Programming',
      status: status,
      teamsJoinUrl:
          status == 'approved'
              ? 'https://teams.microsoft.com/meet/approved'
              : null,
      rejectionReason: rejectionReason,
      facultyNotes: facultyNotes,
    );
  }

  @override
  Future<MeetingSlotModel> createFacultySlot({
    required String topic,
    String? subjectCode,
    String? subjectName,
    String? subjectId,
    String? description,
    required DateTime startTime,
    required DateTime endTime,
    int? capacity,
    String? audienceType,
    List<String>? invitedStudentIds,
    bool createTeamsMeeting = false,
    String? notes,
  }) async {
    if (shouldThrow) throw Exception('Create slot error');
    return MeetingSlotModel(
      id: 'new-slot-101',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      topic: topic,
      date: '2026-10-27',
      startTime: startTime,
      endTime: endTime,
      capacity: capacity ?? 1,
      audienceType: audienceType ?? 'department',
      teamsJoinUrl:
          createTeamsMeeting ? 'https://teams.microsoft.com/meet/new' : null,
      status: 'active',
    );
  }

  @override
  Future<void> cancelFacultySlot(String slotId, {String? reason}) async {
    if (shouldThrow) throw Exception('Cancel slot error');
  }
}

class FakeNotificationServiceImpl implements NotificationService {
  bool shouldThrow = false;
  List<NotificationModel> notifs = [
    NotificationModel(
      id: 'notif-1',
      userId: 'user-1',
      title: 'New Meeting Request',
      message: 'Student Charlie requested an appointment.',
      read: false,
      type: 'meeting_requested',
      timestamp: DateTime(2026, 10, 21),
    ),
    NotificationModel(
      id: 'notif-2',
      userId: 'user-1',
      title: 'Lecture Published',
      message: 'CS304 group lecture scheduled.',
      read: true,
      type: 'meeting_created',
      timestamp: DateTime(2026, 10, 21),
    ),
  ];

  @override
  Future<List<NotificationModel>> getNotifications() async {
    if (shouldThrow) throw Exception('Get notifications failed');
    return notifs;
  }

  @override
  Future<NotificationModel> markAsRead(String id) async {
    if (shouldThrow) throw Exception('Mark read failed');
    final match = notifs.firstWhere((n) => n.id == id);
    return match.copyWith(read: true);
  }

  @override
  Future<void> markAllAsRead() async {
    if (shouldThrow) throw Exception('Mark all read failed');
    notifs = notifs.map((n) => n.copyWith(read: true)).toList();
  }
}

void main() {
  group('Phase 5 Providers State Management Tests', () {
    late FakeMeetingServiceImpl fakeMeetingService;
    late MeetingProvider meetingProvider;

    late FakeNotificationServiceImpl fakeNotifService;
    late NotificationProvider notificationProvider;

    setUp(() {
      fakeMeetingService = FakeMeetingServiceImpl();
      meetingProvider = MeetingProvider(meetingService: fakeMeetingService);

      fakeNotifService = FakeNotificationServiceImpl();
      notificationProvider = NotificationProvider(
        notificationService: fakeNotifService,
      );
    });

    test(
      'MeetingProvider loads student meetings and available slots',
      () async {
        await meetingProvider.loadStudentMeetings();

        expect(meetingProvider.isLoading, isFalse);
        expect(meetingProvider.errorMessage, isNull);
        expect(meetingProvider.studentBookings.length, 1);
        expect(meetingProvider.availableSlots.length, 1);
        expect(meetingProvider.isTeamsConfigured, isTrue);
      },
    );

    test('MeetingProvider handles error when loading fails', () async {
      fakeMeetingService.shouldThrow = true;
      await meetingProvider.loadStudentMeetings();

      expect(meetingProvider.isLoading, isFalse);
      expect(meetingProvider.errorMessage, contains('Failed to load meetings'));
    });

    test(
      'MeetingProvider student submits meeting request and increments slot count',
      () async {
        await meetingProvider.loadStudentMeetings();

        final success = await meetingProvider.requestMeeting(
          slotId: 's-1',
          topic: 'Graph Theory',
          doubtDescription: 'Depth-first search cycles',
        );

        expect(success, isTrue);
        expect(meetingProvider.studentBookings.length, 2);
        expect(meetingProvider.studentBookings.first.topic, 'Graph Theory');
        // Slot count was 1, should now be 2
        expect(meetingProvider.availableSlots.first.bookedCount, 2);
      },
    );

    test('MeetingProvider student cancels consultation request', () async {
      await meetingProvider.loadStudentMeetings();

      final success = await meetingProvider.cancelStudentBooking('b-1');

      expect(success, isTrue);
      expect(meetingProvider.studentBookings.first.status, 'cancelled');
    });

    test(
      'MeetingProvider faculty loads requests, approves request, and receives Teams link',
      () async {
        await meetingProvider.loadFacultyMeetings();

        expect(meetingProvider.facultyBookings.length, 1);
        expect(meetingProvider.eligibleStudents.length, 1);

        final success = await meetingProvider.updateFacultyBookingStatus(
          'b-2',
          'approved',
        );

        expect(success, isTrue);
        expect(meetingProvider.facultyBookings.first.isApproved, isTrue);
        expect(
          meetingProvider.facultyBookings.first.teamsJoinUrl,
          'https://teams.microsoft.com/meet/approved',
        );
      },
    );

    test(
      'MeetingProvider faculty creates a new slot and cancels a slot',
      () async {
        await meetingProvider.loadFacultyMeetings();

        final success = await meetingProvider.scheduleFacultySlot(
          topic: 'Algorithms Office Hours',
          startTime: DateTime(2026, 10, 27, 10, 0),
          endTime: DateTime(2026, 10, 27, 10, 30),
          createTeamsMeeting: true,
        );

        expect(success, isTrue);
        expect(
          meetingProvider.facultySlots.first.topic,
          'Algorithms Office Hours',
        );
        expect(meetingProvider.facultySlots.first.hasTeamsMeeting, isTrue);

        final cancelSuccess = await meetingProvider.cancelFacultySlot(
          'new-slot-101',
        );
        expect(cancelSuccess, isTrue);
        expect(meetingProvider.facultySlots.first.isCancelled, isTrue);
      },
    );

    test(
      'NotificationProvider loads notifications and calculates unread count',
      () async {
        await notificationProvider.loadNotifications();

        expect(notificationProvider.isLoading, isFalse);
        expect(notificationProvider.notifications.length, 2);
        expect(notificationProvider.unreadCount, 1);
      },
    );

    test('NotificationProvider marks single notification as read', () async {
      await notificationProvider.loadNotifications();

      await notificationProvider.markAsRead('notif-1');

      expect(notificationProvider.unreadCount, 0);
      expect(notificationProvider.notifications.first.read, isTrue);
    });

    test('NotificationProvider marks all notifications as read', () async {
      await notificationProvider.loadNotifications();

      await notificationProvider.markAllAsRead();

      expect(notificationProvider.unreadCount, 0);
      expect(notificationProvider.notifications.every((n) => n.read), isTrue);
    });
  });
}
