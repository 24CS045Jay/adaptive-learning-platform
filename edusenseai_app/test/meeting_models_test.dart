import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/eligible_student_model.dart';
import 'package:edusenseai/models/meeting_model.dart';
import 'package:edusenseai/models/meeting_slot_model.dart';
import 'package:edusenseai/models/notification_model.dart';

void main() {
  group('Phase 5 Meeting Models Unit Tests', () {
    test('MeetingBookingModel parses valid JSON and status helpers work', () {
      final json = {
        'id': 'booking-101',
        'slotId': 'slot-55',
        'facultyId': 'fac-99',
        'facultyName': 'Dr. Alan Turing',
        'studentId': 'stu-77',
        'studentName': 'Ada Lovelace',
        'studentEmail': 'ada@edusense.ai',
        'subjectCode': 'CS304',
        'subjectName': 'Advanced Algorithms',
        'topic': 'Graph Traversal Complexity',
        'doubtDescription': 'Need clarification on Dijkstra vs A* heuristics',
        'startTime': '2026-10-25T10:00:00.000Z',
        'endTime': '2026-10-25T10:30:00.000Z',
        'durationMinutes': 30,
        'status': 'approved',
        'teamsJoinUrl': 'https://teams.microsoft.com/meet/test-session-101',
        'facultyNotes': 'Bring previous assignment notes',
      };

      final booking = MeetingBookingModel.fromJson(json);

      expect(booking.id, 'booking-101');
      expect(booking.slotId, 'slot-55');
      expect(booking.facultyName, 'Dr. Alan Turing');
      expect(booking.studentName, 'Ada Lovelace');
      expect(booking.subjectCode, 'CS304');
      expect(booking.topic, 'Graph Traversal Complexity');
      expect(booking.isApproved, isTrue);
      expect(booking.isRequested, isFalse);
      expect(booking.isRejected, isFalse);
      expect(booking.isCancelled, isFalse);
      expect(booking.teamsJoinUrl, contains('teams.microsoft.com'));

      final serialized = booking.toJson();
      expect(serialized['id'], 'booking-101');
      expect(serialized['status'], 'approved');
      expect(serialized['topic'], 'Graph Traversal Complexity');
    });

    test(
      'MeetingSlotModel correctly handles capacity, Teams status, and date/time',
      () {
        final start = DateTime(2026, 10, 25, 14, 0);
        final end = DateTime(2026, 10, 25, 15, 0);

        final slotJson = {
          'id': 'slot-202',
          'facultyId': 'fac-10',
          'facultyName': 'Prof. Grace Hopper',
          'facultyEmail': 'hopper@edusense.ai',
          'departmentId': 'CE',
          'subjectCode': 'CS201',
          'subjectName': 'Data Structures',
          'topic': 'Compiler Optimization Office Hours',
          'description': 'Open consultation for compiler lab tasks',
          'date': '2026-10-25',
          'startTime': start.toIso8601String(),
          'endTime': end.toIso8601String(),
          'durationMinutes': 60,
          'capacity': 5,
          'bookedCount': 5,
          'locationType': 'teams',
          'audienceType': 'department',
          'invitedStudentIds': ['stu-1', 'stu-2'],
          'teamsJoinUrl': 'https://teams.microsoft.com/l/meetup-join/test-202',
          'status': 'active',
        };

        final slot = MeetingSlotModel.fromJson(slotJson);

        expect(slot.id, 'slot-202');
        expect(slot.facultyName, 'Prof. Grace Hopper');
        expect(slot.capacity, 5);
        expect(slot.bookedCount, 5);
        expect(slot.isFull, isTrue);
        expect(slot.isActive, isTrue);
        expect(slot.isCancelled, isFalse);
        expect(slot.hasTeamsMeeting, isTrue);
        expect(slot.invitedStudentIds.length, 2);

        final serialized = slot.toJson();
        expect(serialized['id'], 'slot-202');
        expect(serialized['capacity'], 5);
        expect(serialized['teamsJoinUrl'], contains('teams.microsoft.com'));
      },
    );

    test(
      'NotificationModel parses JSON, checks unread state, and copyWith works',
      () {
        final notifJson = {
          '_id': 'notif-88',
          'userId': 'stu-77',
          'title': 'Meeting Approved',
          'message': 'Your consultation request on CS304 has been approved.',
          'type': 'meeting_approved',
          'read': false,
          'link': '/meetings/booking-101',
          'createdAt': '2026-10-21T14:30:00.000Z',
        };

        final notif = NotificationModel.fromJson(notifJson);

        expect(notif.id, 'notif-88');
        expect(notif.title, 'Meeting Approved');
        expect(notif.read, isFalse);
        expect(notif.type, 'meeting_approved');

        // Test copyWith
        final updated = notif.copyWith(read: true);
        expect(updated.read, isTrue);
        expect(updated.id, 'notif-88');
        expect(updated.title, 'Meeting Approved');

        final serialized = updated.toJson();
        expect(serialized['id'], 'notif-88');
        expect(serialized['read'], isTrue);
      },
    );

    test('EligibleStudentModel parses JSON and provides department getter', () {
      final studentJson = {
        'id': 'stu-501',
        'name': 'Bob Williams',
        'email': 'bob@edusense.ai',
        'departmentId': 'IT',
        'enrollmentNumber': '2026IT055',
        'semester': 5,
      };

      final student = EligibleStudentModel.fromJson(studentJson);

      expect(student.id, 'stu-501');
      expect(student.name, 'Bob Williams');
      expect(student.email, 'bob@edusense.ai');
      expect(student.department, 'IT');
      expect(student.enrollmentNumber, '2026IT055');
      expect(student.semester, 5);

      final serialized = student.toJson();
      expect(serialized['id'], 'stu-501');
      expect(serialized['enrollmentNumber'], '2026IT055');
    });
  });
}
