import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/models/adaptive_profile_model.dart';
import 'package:edusenseai/models/audit_log_model.dart';
import 'package:edusenseai/models/document_model.dart';
import 'package:edusenseai/models/eligible_student_model.dart';
import 'package:edusenseai/models/meeting_model.dart';
import 'package:edusenseai/models/meeting_slot_model.dart';
import 'package:edusenseai/models/practice_quiz_model.dart';
import 'package:edusenseai/models/risk_profile_model.dart';
import 'package:edusenseai/models/subject_model.dart';
import 'package:edusenseai/models/telemetry_model.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/admin_dashboard_provider.dart';
import 'package:edusenseai/providers/faculty_dashboard_provider.dart';
import 'package:edusenseai/providers/student_dashboard_provider.dart';
import 'package:edusenseai/services/adaptive_service.dart';
import 'package:edusenseai/services/analytics_service.dart';
import 'package:edusenseai/services/document_service.dart';
import 'package:edusenseai/services/meeting_service.dart';
import 'package:edusenseai/services/subject_service.dart';

// Fake implementations for services
class FakeSubjectService implements SubjectService {
  bool shouldThrow = false;
  List<SubjectModel> subjects = [
    const SubjectModel(
      id: 'subj-1',
      name: 'Mobile App Development',
      code: 'CS304',
      semester: 5,
      departmentId: 'CE',
      faculty: 'Dr. Smith',
      facultyId: 'fac-1',
      enrolledStudentIds: ['stu-1', 'alice@institution.edu'],
    ),
    const SubjectModel(
      id: 'subj-2',
      name: 'Computer Networks',
      code: 'CS305',
      semester: 5,
      departmentId: 'CE',
      faculty: 'Prof. Roy',
      facultyId: 'fac-2',
      enrolledStudentIds: ['stu-2'],
    ),
  ];

  @override
  Future<List<SubjectModel>> getSubjects() async {
    if (shouldThrow) throw NetworkException('Subjects error.');
    return subjects;
  }

  @override
  Future<SubjectModel> getSubject(String id) async => subjects.first;

  @override
  Future<SubjectModel> enrollSubject(String subjectId) async {
    if (shouldThrow) throw ApiException('Enrollment failed.');
    final s = subjects.firstWhere((s) => s.id == subjectId);
    return s.copyWith(enrolledStudentIds: [...s.enrolledStudentIds, 'stu-1']);
  }

  @override
  Future<SubjectModel> unenrollSubject(String subjectId) async {
    if (shouldThrow) throw ApiException('Unenrollment failed.');
    final s = subjects.firstWhere((s) => s.id == subjectId);
    return s.copyWith(
      enrolledStudentIds:
          s.enrolledStudentIds
              .where((id) => id != 'stu-1' && id != 'alice@institution.edu')
              .toList(),
    );
  }
}

class FakeDocumentService implements DocumentService {
  bool shouldThrow = false;
  List<DocumentModel> documents = [
    const DocumentModel(
      id: 'doc-1',
      fileName: 'Flutter_Notes.pdf',
      fileUrl: 'http://docs.com/flutter.pdf',
      status: 'approved',
      chunkCount: 15,
      uploaderId: 'fac-1',
      subjectCode: 'CS304',
    ),
    const DocumentModel(
      id: 'doc-2',
      fileName: 'Pending_Lab.pdf',
      fileUrl: 'http://docs.com/pending.pdf',
      status: 'pending',
      chunkCount: 8,
      uploaderId: 'fac-1',
      subjectCode: 'CS304',
    ),
  ];

  @override
  Future<List<DocumentModel>> getDocuments({
    String? status,
    String? subjectId,
  }) async {
    if (shouldThrow) throw NetworkException('Documents error.');
    if (status != null) {
      return documents.where((d) => d.status == status).toList();
    }
    return documents;
  }

  @override
  Future<DocumentModel> approveDocument(String documentId) async {
    if (shouldThrow) throw ApiException('Approval failed.');
    final doc = documents.firstWhere((d) => d.id == documentId);
    return doc.copyWith(status: 'approved');
  }

  @override
  Future<DocumentModel> rejectDocument(String documentId) async {
    if (shouldThrow) throw ApiException('Rejection failed.');
    final doc = documents.firstWhere((d) => d.id == documentId);
    return doc.copyWith(status: 'rejected');
  }
}

class FakeAdaptiveService implements AdaptiveService {
  bool shouldThrow = false;
  @override
  Future<AdaptiveProfileModel> getProfile() async {
    if (shouldThrow) throw NetworkException('Adaptive profile error.');
    return const AdaptiveProfileModel(
      hasData: true,
      overallMasteryPct: 88,
      totalTopicsTracked: 6,
      evaluatedTopicsCount: 4,
      weakCount: 1,
      masteredCount: 3,
    );
  }

  @override
  Future<List<Map<String, dynamic>>> getRecommendations({
    String? subjectId,
  }) async => [];

  @override
  Future<LearnerPreferences> updatePreferences({
    String? explanationLevel,
    String? preferredLanguage,
    String? preferredTeachingMode,
    int? dailyGoalMinutes,
    bool? enableSpacedRepetition,
  }) async => const LearnerPreferences();

  @override
  Future<void> recordInteraction({
    required String recommendationId,
    required String eventType,
    String? topic,
    String? courseId,
    String? feedbackValue,
  }) async {}

  @override
  Future<PracticeQuizModel> getPracticeQuiz({
    String? topic,
    String? subjectId,
    String difficulty = 'medium',
  }) async => const PracticeQuizModel();

  @override
  Future<void> resetProfile() async {}

  @override
  Future<bool> submitFeedback({
    required String question,
    required String answer,
    required bool isThumbsUp,
    String? comment,
    String? subjectId,
  }) async => true;
}

class FakeMeetingService implements MeetingService {
  bool shouldThrow = false;
  List<MeetingBookingModel> bookings = [
    const MeetingBookingModel(
      id: 'book-1',
      slotId: 'slot-1',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      studentId: 'stu-1',
      studentName: 'Alice Student',
      topic: 'Widget Testing Doubts',
      status: 'requested',
    ),
  ];

  @override
  Future<List<MeetingBookingModel>> getStudentBookings() async {
    if (shouldThrow) throw NetworkException('Student bookings error.');
    return bookings;
  }

  @override
  Future<List<MeetingBookingModel>> getFacultyBookings() async {
    if (shouldThrow) throw NetworkException('Faculty bookings error.');
    return bookings;
  }

  @override
  Future<MeetingBookingModel> updateBookingStatus(
    String bookingId,
    String status, {
    String? facultyNotes,
    String? rejectionReason,
  }) async {
    if (shouldThrow) throw ApiException('Status update failed.');
    final b = bookings.firstWhere((item) => item.id == bookingId);
    return MeetingBookingModel(
      id: b.id,
      slotId: b.slotId,
      facultyId: b.facultyId,
      facultyName: b.facultyName,
      studentId: b.studentId,
      studentName: b.studentName,
      topic: b.topic,
      status: status,
      teamsJoinUrl:
          status == 'approved' ? 'https://teams.microsoft.com/meet/test' : null,
    );
  }

  @override
  Future<List<MeetingSlotModel>> getAvailableSlots({
    String? subjectCode,
  }) async => [];

  @override
  Future<MeetingBookingModel> bookMeetingSlot({
    required String slotId,
    required String topic,
    String? doubtDescription,
    String? meetingType,
    String? idempotencyKey,
  }) async {
    return bookings.first;
  }

  @override
  Future<MeetingBookingModel> studentCancelBooking(
    String bookingId, {
    String? reason,
  }) async {
    return bookings.first;
  }

  @override
  Future<List<MeetingSlotModel>> getFacultySlots() async => [];

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
    return MeetingSlotModel(
      id: 'slot-created',
      facultyId: 'fac-1',
      facultyName: 'Dr. Smith',
      topic: topic,
      date: '2026-10-25',
      startTime: startTime,
      endTime: endTime,
    );
  }

  @override
  Future<void> cancelFacultySlot(String slotId, {String? reason}) async {}

  @override
  Future<List<EligibleStudentModel>> getEligibleStudents({
    String? departmentId,
    String? subjectId,
  }) async => [];

  @override
  Future<Map<String, dynamic>> getTeamsStatus() async => {
    'isConfigured': true,
    'message': 'Microsoft Graph ready',
  };
}

class FakeAnalyticsService implements AnalyticsService {
  bool shouldThrow = false;

  @override
  Future<TelemetryModel> getTelemetry() async {
    if (shouldThrow) throw NetworkException('Telemetry error.');
    return const TelemetryModel(
      totalQueries: 100,
      groundingAccuracyPct: 94.0,
      helpfulnessRatePct: 95,
      totalUsers: 50,
      studentCount: 40,
      facultyCount: 8,
      adminCount: 2,
    );
  }

  @override
  Future<List<StudentRiskProfileModel>> getRiskProfiles({
    String? subjectId,
  }) async {
    if (shouldThrow) throw NetworkException('Risk profiles error.');
    return const [
      StudentRiskProfileModel(
        studentId: 'stu-99',
        studentName: 'At-Risk Student',
        risk: 'High',
        scorePct: 45,
        weakTopicCount: 3,
      ),
    ];
  }

  @override
  Future<List<AuditLogModel>> getAuditLogs() async {
    if (shouldThrow) throw NetworkException('Audit logs error.');
    return const [
      AuditLogModel(
        id: 'a-1',
        actor: 'admin',
        action: 'APPROVE_DOC',
        time: 'now',
      ),
    ];
  }

  @override
  Future<List<UserModel>> getUsers() async {
    if (shouldThrow) throw NetworkException('Users error.');
    return const [
      UserModel(
        id: 'u-1',
        name: 'User One',
        email: 'u1@test.com',
        role: 'student',
      ),
    ];
  }
}

void main() {
  group('Phase 3 Dashboard Providers Tests', () {
    const studentUser = UserModel(
      id: 'stu-1',
      name: 'Alice Student',
      email: 'alice@institution.edu',
      role: 'student',
      departmentId: 'CE',
    );

    const facultyUser = UserModel(
      id: 'fac-1',
      name: 'Dr. Smith',
      email: 'smith@institution.edu',
      role: 'faculty',
      departmentId: 'CE',
    );

    test(
      'StudentDashboardProvider loads dashboard and computes enrollments',
      () async {
        final fakeSubj = FakeSubjectService();
        final fakeDocs = FakeDocumentService();
        final fakeAdaptive = FakeAdaptiveService();
        final fakeMeetings = FakeMeetingService();

        final provider = StudentDashboardProvider(
          subjectService: fakeSubj,
          documentService: fakeDocs,
          adaptiveService: fakeAdaptive,
          meetingService: fakeMeetings,
        );

        await provider.loadDashboard(currentUser: studentUser);

        expect(provider.isLoading, isFalse);
        expect(provider.errorMessage, isNull);
        expect(provider.allSubjects.length, 2);
        expect(provider.enrolledSubjects.length, 1);
        expect(provider.enrolledSubjects.first.code, 'CS304');
        expect(provider.learningMaterials.length, 1);
        expect(provider.adaptiveProfile?.overallMasteryPct, 88);
        expect(provider.bookings.length, 1);
      },
    );

    test('StudentDashboardProvider enrolls and unenrolls course', () async {
      final fakeSubj = FakeSubjectService();
      final provider = StudentDashboardProvider(
        subjectService: fakeSubj,
        documentService: FakeDocumentService(),
        adaptiveService: FakeAdaptiveService(),
        meetingService: FakeMeetingService(),
      );

      await provider.loadDashboard(currentUser: studentUser);

      // Enroll in subj-2
      final success = await provider.enrollCourse('subj-2', studentUser);
      expect(success, isTrue);
      expect(provider.enrolledSubjects.length, 2);

      // Unenroll from subj-1
      final unenrollSuccess = await provider.unenrollCourse(
        'subj-1',
        studentUser,
      );
      expect(unenrollSuccess, isTrue);
      expect(provider.enrolledSubjects.any((s) => s.id == 'subj-1'), isFalse);
    });

    test(
      'StudentDashboardProvider handles API network errors gracefully',
      () async {
        final fakeSubj = FakeSubjectService()..shouldThrow = true;
        final provider = StudentDashboardProvider(
          subjectService: fakeSubj,
          documentService: FakeDocumentService(),
          adaptiveService: FakeAdaptiveService(),
          meetingService: FakeMeetingService(),
        );

        await provider.loadDashboard(currentUser: studentUser);

        expect(provider.isLoading, isFalse);
        expect(provider.errorMessage, isNotNull);
        expect(provider.errorMessage, contains('Subjects error.'));
      },
    );

    test(
      'FacultyDashboardProvider loads data and filters assigned subjects',
      () async {
        final fakeSubj = FakeSubjectService();
        final fakeDocs = FakeDocumentService();
        final fakeMeetings = FakeMeetingService();
        final fakeAnalytics = FakeAnalyticsService();

        final provider = FacultyDashboardProvider(
          subjectService: fakeSubj,
          documentService: fakeDocs,
          meetingService: fakeMeetings,
          analyticsService: fakeAnalytics,
        );

        await provider.loadDashboard(currentUser: facultyUser);

        expect(provider.isLoading, isFalse);
        expect(provider.assignedSubjects.length, 1);
        expect(provider.assignedSubjects.first.code, 'CS304');
        expect(provider.uploadedMaterials.length, 2);
        expect(provider.bookings.length, 1);
        expect(provider.riskProfiles.length, 1);
        expect(provider.riskProfiles.first.isHighRisk, isTrue);
      },
    );

    test('FacultyDashboardProvider approves student booking request', () async {
      final provider = FacultyDashboardProvider(
        subjectService: FakeSubjectService(),
        documentService: FakeDocumentService(),
        meetingService: FakeMeetingService(),
        analyticsService: FakeAnalyticsService(),
      );

      await provider.loadDashboard(currentUser: facultyUser);
      expect(provider.pendingBookings.length, 1);

      final ok = await provider.updateBookingStatus('book-1', 'approved');
      expect(ok, isTrue);
      expect(provider.bookings.first.isApproved, isTrue);
      expect(provider.bookings.first.teamsJoinUrl, isNotNull);
      expect(provider.pendingBookings.isEmpty, isTrue);
    });

    test(
      'AdminDashboardProvider loads telemetry and approves document',
      () async {
        final fakeAnalytics = FakeAnalyticsService();
        final fakeDocs = FakeDocumentService();
        final fakeSubj = FakeSubjectService();

        final provider = AdminDashboardProvider(
          analyticsService: fakeAnalytics,
          documentService: fakeDocs,
          subjectService: fakeSubj,
        );

        await provider.loadDashboard();

        expect(provider.isLoading, isFalse);
        expect(provider.telemetry?.totalQueries, 100);
        expect(provider.pendingDocuments.length, 1);
        expect(provider.pendingDocuments.first.fileName, 'Pending_Lab.pdf');
        expect(provider.users.length, 1);
        expect(provider.auditLogs.length, 1);

        // Approve pending document
        final ok = await provider.approveDocument('doc-2');
        expect(ok, isTrue);
        expect(provider.pendingDocuments.isEmpty, isTrue);
      },
    );
  });
}
