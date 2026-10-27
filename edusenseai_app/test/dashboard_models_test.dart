import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/adaptive_profile_model.dart';
import 'package:edusenseai/models/audit_log_model.dart';
import 'package:edusenseai/models/document_model.dart';
import 'package:edusenseai/models/meeting_model.dart';
import 'package:edusenseai/models/risk_profile_model.dart';
import 'package:edusenseai/models/subject_model.dart';
import 'package:edusenseai/models/telemetry_model.dart';

void main() {
  group('Phase 3 Dashboard Models Tests', () {
    test('SubjectModel correctly parses and evaluates enrollments', () {
      final json = {
        'id': 'subj-101',
        'name': 'Data Structures & Algorithms',
        'code': 'CS201',
        'semester': 3,
        'departmentId': 'CE',
        'faculty': 'Dr. Patel',
        'facultyEmail': 'patel@charusat.edu.in',
        'syllabus': 'Units 1 to 5',
        'enrolledStudentIds': ['stu-1', 'alice@institution.edu', '24CE001'],
      };

      final subject = SubjectModel.fromJson(json);

      expect(subject.id, 'subj-101');
      expect(subject.name, 'Data Structures & Algorithms');
      expect(subject.code, 'CS201');
      expect(subject.semester, 3);
      expect(subject.departmentId, 'CE');
      expect(subject.faculty, 'Dr. Patel');
      expect(subject.enrolledStudentIds.length, 3);

      // Verify isEnrolled checks
      expect(subject.isEnrolled(userId: 'stu-1'), isTrue);
      expect(subject.isEnrolled(email: 'alice@institution.edu'), isTrue);
      expect(
        subject.isEnrolled(studentId: '24ce001'),
        isTrue,
      ); // case-insensitive
      expect(subject.isEnrolled(userId: 'stu-999'), isFalse);

      final serialized = subject.toJson();
      expect(serialized['code'], 'CS201');
      expect(serialized['semester'], 3);
    });

    test('DocumentModel parses status and ingestion flags', () {
      final json = {
        '_id': 'doc-1',
        'fileName': 'Lecture_01_Trees.pdf',
        'fileUrl': 'http://10.0.2.2:5000/uploads/documents/doc-1.pdf',
        'status': 'approved',
        'ingestionStatus': 'ok',
        'chunkCount': 24,
        'topicTag': 'Binary Trees',
        'unit': 'Unit 3',
        'subjectId': {
          '_id': 'subj-101',
          'code': 'CS201',
          'name': 'Data Structures',
        },
        'uploaderId': {'_id': 'fac-1', 'name': 'Prof. Shah', 'role': 'faculty'},
        'createdAt': '2026-10-21T10:00:00.000Z',
      };

      final doc = DocumentModel.fromJson(json);

      expect(doc.id, 'doc-1');
      expect(doc.fileName, 'Lecture_01_Trees.pdf');
      expect(doc.isApproved, isTrue);
      expect(doc.isPending, isFalse);
      expect(doc.isIngested, isTrue);
      expect(doc.chunkCount, 24);
      expect(doc.subjectCode, 'CS201');
      expect(doc.subjectName, 'Data Structures');
      expect(doc.uploaderName, 'Prof. Shah');
      expect(doc.createdAt, isNotNull);
    });

    test('AdaptiveProfileModel parses mastery scores and weak concepts', () {
      final json = {
        'success': true,
        'hasData': true,
        'preferences': {'explanationLevel': 'proficient'},
        'stats': {
          'overallMasteryPct': 78,
          'totalTopicsTracked': 12,
          'evaluatedTopicsCount': 8,
          'weakCount': 2,
          'masteredCount': 4,
          'reviewDueCount': 3,
        },
        'topicMasteries': [
          {
            'topic': 'Sorting Algorithms',
            'score': 85,
            'totalAttempts': 4,
            'status': 'strong',
            'masteryLabel': 'mastered',
          },
        ],
        'weakTopics': [
          {
            'topic': 'Graph Traversal',
            'score': 45,
            'totalAttempts': 2,
            'status': 'needs_practice',
            'masteryLabel': 'weak',
          },
          {
            'topic': 'Dynamic Programming',
            'score': 52,
            'totalAttempts': 3,
            'status': 'needs_practice',
            'masteryLabel': 'weak',
          },
        ],
      };

      final profile = AdaptiveProfileModel.fromJson(json);

      expect(profile.hasData, isTrue);
      expect(profile.overallMasteryPct, 78);
      expect(profile.totalTopicsTracked, 12);
      expect(profile.evaluatedTopicsCount, 8);
      expect(profile.weakCount, 2);
      expect(profile.masteredCount, 4);
      expect(profile.reviewDueCount, 3);
      expect(profile.explanationLevel, 'proficient');
      expect(profile.topicMasteries.length, 1);
      expect(profile.weakTopics.length, 2);
      expect(profile.weakTopics[0].topic, 'Graph Traversal');
      expect(profile.weakTopics[0].score, 45);
    });

    test(
      'MeetingBookingModel parses consultation status and Teams join link',
      () {
        final json = {
          'id': 'book-901',
          'slotId': 'slot-501',
          'facultyId': 'fac-1',
          'facultyName': 'Dr. Patel',
          'studentId': 'stu-1',
          'studentName': 'Alice Smith',
          'studentEmail': 'alice@institution.edu',
          'subjectCode': 'CS201',
          'subjectName': 'Data Structures',
          'topic': 'Heapify Algorithm Clarification',
          'doubtDescription':
              'Why does building a max heap take O(n) instead of O(n log n)?',
          'startTime': '2026-10-25T14:00:00.000Z',
          'endTime': '2026-10-25T14:30:00.000Z',
          'durationMinutes': 30,
          'status': 'approved',
          'teamsJoinUrl':
              'https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz',
        };

        final booking = MeetingBookingModel.fromJson(json);

        expect(booking.id, 'book-901');
        expect(booking.facultyName, 'Dr. Patel');
        expect(booking.studentName, 'Alice Smith');
        expect(booking.topic, 'Heapify Algorithm Clarification');
        expect(booking.isApproved, isTrue);
        expect(booking.isRequested, isFalse);
        expect(booking.teamsJoinUrl, contains('teams.microsoft.com'));
        expect(booking.durationMinutes, 30);
      },
    );

    test(
      'TelemetryModel parses institutional RAG metrics and user distribution',
      () {
        final json = {
          'success': true,
          'totalQueries': 1520,
          'groundingAccuracyPct': 94.6,
          'helpfulnessRatePct': 96,
          'totalRatings': 340,
          'registeredUsers': {
            'total': 180,
            'students': 150,
            'faculty': 25,
            'admins': 5,
          },
        };

        final telemetry = TelemetryModel.fromJson(json);

        expect(telemetry.totalQueries, 1520);
        expect(telemetry.groundingAccuracyPct, 94.6);
        expect(telemetry.helpfulnessRatePct, 96);
        expect(telemetry.totalRatings, 340);
        expect(telemetry.totalUsers, 180);
        expect(telemetry.studentCount, 150);
        expect(telemetry.facultyCount, 25);
        expect(telemetry.adminCount, 5);
      },
    );

    test('StudentRiskProfileModel and AuditLogModel parse correctly', () {
      final riskJson = {
        'studentId': 'stu-88',
        'studentName': 'Bob Student',
        'email': 'bob@institution.edu',
        'subject': 'Operating Systems',
        'trend': 'Declining',
        'risk': 'High',
        'scorePct': 48,
        'hasAttempts': true,
        'weakTopicCount': 3,
      };

      final risk = StudentRiskProfileModel.fromJson(riskJson);
      expect(risk.studentId, 'stu-88');
      expect(risk.isHighRisk, isTrue);
      expect(risk.weakTopicCount, 3);
      expect(risk.scorePct, 48);

      final auditJson = {
        'id': 'audit-1',
        'actor': 'admin@edusense.ai',
        'action': 'APPROVE_DOCUMENT',
        'target': 'doc-1',
        'details': 'Approved for vector ingestion',
        'time': '10/21/2026, 7:30 PM',
      };

      final log = AuditLogModel.fromJson(auditJson);
      expect(log.id, 'audit-1');
      expect(log.actor, 'admin@edusense.ai');
      expect(log.action, 'APPROVE_DOCUMENT');
    });
  });
}
