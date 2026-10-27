import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/meetings/faculty_schedule_slot_modal.dart';
import 'package:edusenseai/features/meetings/meetings_screen.dart';
import 'package:edusenseai/features/meetings/request_meeting_modal.dart';
import 'package:edusenseai/features/notifications/notifications_screen.dart';
import 'package:edusenseai/models/eligible_student_model.dart';
import 'package:edusenseai/models/meeting_model.dart';
import 'package:edusenseai/models/meeting_slot_model.dart';
import 'package:edusenseai/models/notification_model.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'package:edusenseai/providers/faculty_dashboard_provider.dart';
import 'package:edusenseai/providers/meeting_provider.dart';
import 'package:edusenseai/providers/notification_provider.dart';
import 'package:edusenseai/services/meeting_service.dart';
import 'package:edusenseai/services/notification_service.dart';

class MockMeetingServiceForUi implements MeetingService {
  @override
  Future<List<MeetingBookingModel>> getStudentBookings() async => [
    const MeetingBookingModel(
      id: 'b-10',
      slotId: 's-10',
      facultyId: 'fac-1',
      facultyName: 'Dr. Turing',
      studentId: 'stu-1',
      studentName: 'Alice',
      topic: 'Turing Machines Consultation',
      status: 'approved',
      teamsJoinUrl: 'https://teams.microsoft.com/meet/test-turing',
    ),
  ];

  @override
  Future<List<MeetingSlotModel>> getAvailableSlots({
    String? subjectCode,
  }) async => [
    MeetingSlotModel(
      id: 's-10',
      facultyId: 'fac-1',
      facultyName: 'Dr. Turing',
      topic: 'Automata Office Hours',
      date: '2026-10-25',
      startTime: DateTime(2026, 10, 25, 11, 0),
      endTime: DateTime(2026, 10, 25, 11, 30),
      capacity: 3,
      bookedCount: 1,
      status: 'active',
    ),
  ];

  @override
  Future<List<MeetingBookingModel>> getFacultyBookings() async => [
    const MeetingBookingModel(
      id: 'b-20',
      slotId: 's-10',
      facultyId: 'fac-1',
      facultyName: 'Dr. Turing',
      studentId: 'stu-2',
      studentName: 'Bob',
      topic: 'Context-Free Grammars',
      status: 'requested',
    ),
  ];

  @override
  Future<List<MeetingSlotModel>> getFacultySlots() async => [
    MeetingSlotModel(
      id: 's-10',
      facultyId: 'fac-1',
      facultyName: 'Dr. Turing',
      topic: 'Automata Office Hours',
      date: '2026-10-25',
      startTime: DateTime(2026, 10, 25, 11, 0),
      endTime: DateTime(2026, 10, 25, 11, 30),
      capacity: 3,
      bookedCount: 1,
      status: 'active',
    ),
  ];

  @override
  Future<List<EligibleStudentModel>> getEligibleStudents({
    String? departmentId,
    String? subjectId,
  }) async => [
    const EligibleStudentModel(
      id: 'stu-1',
      name: 'Alice Student',
      email: 'alice@edusense.ai',
      departmentId: 'CE',
    ),
  ];

  @override
  Future<Map<String, dynamic>> getTeamsStatus() async => {
    'isConfigured': true,
    'message': 'Microsoft Graph ready',
  };

  @override
  Future<MeetingBookingModel> bookMeetingSlot({
    required String slotId,
    required String topic,
    String? doubtDescription,
    String? meetingType,
    String? idempotencyKey,
  }) async => const MeetingBookingModel(
    id: 'b-new',
    slotId: 's-10',
    facultyId: 'fac-1',
    facultyName: 'Dr. Turing',
    studentId: 'stu-1',
    studentName: 'Alice',
    topic: 'Automata Doubt',
    status: 'requested',
  );

  @override
  Future<MeetingBookingModel> studentCancelBooking(
    String bookingId, {
    String? reason,
  }) async => const MeetingBookingModel(
    id: 'b-10',
    slotId: 's-10',
    facultyId: 'fac-1',
    facultyName: 'Dr. Turing',
    studentId: 'stu-1',
    studentName: 'Alice',
    topic: 'Turing Machines Consultation',
    status: 'cancelled',
  );

  @override
  Future<MeetingBookingModel> updateBookingStatus(
    String bookingId,
    String status, {
    String? facultyNotes,
    String? rejectionReason,
  }) async => MeetingBookingModel(
    id: bookingId,
    slotId: 's-10',
    facultyId: 'fac-1',
    facultyName: 'Dr. Turing',
    studentId: 'stu-2',
    studentName: 'Bob',
    topic: 'Context-Free Grammars',
    status: status,
    teamsJoinUrl: 'https://teams.microsoft.com/meet/approved',
  );

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
  }) async => MeetingSlotModel(
    id: 'slot-created',
    facultyId: 'fac-1',
    facultyName: 'Dr. Turing',
    topic: topic,
    date: '2026-10-25',
    startTime: startTime,
    endTime: endTime,
  );

  @override
  Future<void> cancelFacultySlot(String slotId, {String? reason}) async {}
}

class MockNotificationServiceForUi implements NotificationService {
  @override
  Future<List<NotificationModel>> getNotifications() async => [
    NotificationModel(
      id: 'notif-10',
      userId: 'user-1',
      title: 'Doubt Session Approved',
      message: 'Your meeting with Dr. Turing has been confirmed.',
      read: false,
      type: 'meeting_approved',
      timestamp: DateTime(2026, 10, 21),
    ),
    NotificationModel(
      id: 'notif-20',
      userId: 'user-1',
      title: 'New Office Hours Slot',
      message: 'Dr. Turing published new office hours.',
      read: true,
      type: 'meeting_created',
      timestamp: DateTime(2026, 10, 21),
    ),
  ];

  @override
  Future<NotificationModel> markAsRead(String id) async => NotificationModel(
    id: 'notif-10',
    userId: 'user-1',
    title: 'Doubt Session Approved',
    message: 'Your meeting with Dr. Turing has been confirmed.',
    read: true,
    type: 'meeting_approved',
    timestamp: DateTime(2026, 10, 21),
  );

  @override
  Future<void> markAllAsRead() async {}
}

Widget createTestApp({required Widget child, required UserModel user}) {
  final mockMeetingService = MockMeetingServiceForUi();
  final mockNotifService = MockNotificationServiceForUi();

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>(
        create: (_) {
          final p = AuthProvider();
          p.setUserForTesting(user);
          return p;
        },
      ),
      ChangeNotifierProvider<MeetingProvider>(
        create: (_) => MeetingProvider(meetingService: mockMeetingService),
      ),
      ChangeNotifierProvider<NotificationProvider>(
        create:
            (_) => NotificationProvider(notificationService: mockNotifService),
      ),
      ChangeNotifierProvider<FacultyDashboardProvider>(
        create: (_) => FacultyDashboardProvider(),
      ),
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  group('Phase 5 UI & Widget Interaction Tests', () {
    const studentUser = UserModel(
      id: 'stu-1',
      name: 'Alice Student',
      email: 'alice@edusense.ai',
      role: 'student',
    );

    const facultyUser = UserModel(
      id: 'fac-1',
      name: 'Dr. Turing',
      email: 'turing@edusense.ai',
      role: 'faculty',
    );

    testWidgets(
      'NotificationsScreen renders items, unread counter, and mark read action',
      (tester) async {
        await tester.pumpWidget(
          createTestApp(user: studentUser, child: const NotificationsScreen()),
        );
        await tester.pumpAndSettle();

        expect(find.text('Notifications'), findsOneWidget);
        expect(find.text('Doubt Session Approved'), findsOneWidget);
        expect(find.text('New Office Hours Slot'), findsOneWidget);
        expect(find.text('Mark All Read'), findsOneWidget);

        // Tap Mark All Read
        await tester.tap(find.text('Mark All Read'));
        await tester.pumpAndSettle();
      },
    );

    testWidgets(
      'MeetingsManagementScreen renders Student view with tabs, banner, and FAB',
      (tester) async {
        await tester.pumpWidget(
          createTestApp(
            user: studentUser,
            child: const MeetingsManagementScreen(),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Faculty Connect'), findsOneWidget);
        expect(find.text('My Consultations'), findsOneWidget);
        expect(find.text('Office Hours'), findsOneWidget);
        expect(find.text('Faculty Directory'), findsOneWidget);
        expect(find.text('Request Consultation'), findsOneWidget);
        expect(
          find.textContaining('Microsoft Teams Live Integration'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'MeetingsManagementScreen renders Faculty view with requests and schedule FAB',
      (tester) async {
        await tester.pumpWidget(
          createTestApp(
            user: facultyUser,
            child: const MeetingsManagementScreen(),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Faculty Meeting Hub'), findsOneWidget);
        expect(find.text('Student Requests'), findsOneWidget);
        expect(find.text('My Sessions'), findsOneWidget);
        expect(find.text('Eligible Students'), findsOneWidget);
        expect(find.text('Schedule Session'), findsOneWidget);
      },
    );

    testWidgets(
      'RequestMeetingModal renders form and submits booking request',
      (tester) async {
        final slot = MeetingSlotModel(
          id: 's-10',
          facultyId: 'fac-1',
          facultyName: 'Dr. Turing',
          topic: 'Automata Office Hours',
          date: '2026-10-25',
          startTime: DateTime(2026, 10, 25, 11, 0),
          endTime: DateTime(2026, 10, 25, 11, 30),
        );

        await tester.pumpWidget(
          createTestApp(
            user: studentUser,
            child: Scaffold(body: RequestMeetingModal(initialSlot: slot)),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Request Consultation'), findsOneWidget);
        expect(find.text('Automata Office Hours'), findsAtLeast(1));

        // Enter doubt description
        await tester.enterText(
          find.byType(TextFormField).last,
          'Pumping Lemma for Regular Languages',
        );
        await tester.pumpAndSettle();

        expect(find.text('Submit Consultation Request'), findsOneWidget);
        await tester.tap(find.text('Submit Consultation Request'));
        await tester.pumpAndSettle();
      },
    );

    testWidgets(
      'FacultyScheduleSlotModal renders inputs for topic, date, and Teams checkbox',
      (tester) async {
        await tester.pumpWidget(
          createTestApp(
            user: facultyUser,
            child: const Scaffold(body: FacultyScheduleSlotModal()),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Schedule Session Slot'), findsOneWidget);
        expect(find.text('Generate Microsoft Teams Meeting'), findsOneWidget);
        expect(find.text('Audience & Target Students'), findsOneWidget);

        // Enter topic
        await tester.enterText(
          find.byType(TextFormField).first,
          'Exam Preparation Lecture',
        );
        await tester.pumpAndSettle();

        expect(find.text('Publish Session Slot'), findsOneWidget);
      },
    );
  });
}
