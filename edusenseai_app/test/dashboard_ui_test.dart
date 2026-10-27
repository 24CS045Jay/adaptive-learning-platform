import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/admin/admin_home_screen.dart';
import 'package:edusenseai/features/faculty/faculty_home_screen.dart';
import 'package:edusenseai/features/student/student_home_screen.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/admin_dashboard_provider.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'package:edusenseai/providers/faculty_dashboard_provider.dart';
import 'package:edusenseai/providers/student_dashboard_provider.dart';
import 'auth_provider_test.dart';
import 'dashboard_providers_test.dart';

void main() {
  group('Phase 3 Dashboard UI & Integration Widget Tests', () {
    late FakeAuthService fakeAuthService;
    late FakeTokenStorageService fakeStorage;
    late AuthProvider authProvider;

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

    const adminUser = UserModel(
      id: 'admin-1',
      name: 'Chief Admin',
      email: 'admin@institution.edu',
      role: 'admin',
      departmentId: 'CE',
    );

    setUp(() {
      fakeAuthService = FakeAuthService();
      fakeStorage = FakeTokenStorageService();
      authProvider = AuthProvider(
        authService: fakeAuthService,
        tokenStorage: fakeStorage,
      );
    });

    Widget createHarness({
      required Widget child,
      StudentDashboardProvider? studentProv,
      FacultyDashboardProvider? facultyProv,
      AdminDashboardProvider? adminProv,
    }) {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
          ChangeNotifierProvider<StudentDashboardProvider>.value(
            value:
                studentProv ??
                StudentDashboardProvider(
                  subjectService: FakeSubjectService(),
                  documentService: FakeDocumentService(),
                  adaptiveService: FakeAdaptiveService(),
                  meetingService: FakeMeetingService(),
                ),
          ),
          ChangeNotifierProvider<FacultyDashboardProvider>.value(
            value:
                facultyProv ??
                FacultyDashboardProvider(
                  subjectService: FakeSubjectService(),
                  documentService: FakeDocumentService(),
                  meetingService: FakeMeetingService(),
                  analyticsService: FakeAnalyticsService(),
                ),
          ),
          ChangeNotifierProvider<AdminDashboardProvider>.value(
            value:
                adminProv ??
                AdminDashboardProvider(
                  analyticsService: FakeAnalyticsService(),
                  documentService: FakeDocumentService(),
                  subjectService: FakeSubjectService(),
                ),
          ),
        ],
        child: MaterialApp(home: child),
      );
    }

    testWidgets(
      'StudentHomeScreen renders profile, progress, courses, and materials',
      (tester) async {
        final studentProv = StudentDashboardProvider(
          subjectService: FakeSubjectService(),
          documentService: FakeDocumentService(),
          adaptiveService: FakeAdaptiveService(),
          meetingService: FakeMeetingService(),
        );

        await tester.pumpWidget(
          createHarness(
            child: const StudentHomeScreen(student: studentUser),
            studentProv: studentProv,
          ),
        );
        await tester.pumpAndSettle();

        // Profile details
        expect(find.text('Alice Student'), findsOneWidget);
        expect(find.text('Dept: CE'), findsOneWidget);

        // Adaptive progress
        expect(find.text('Learning Progress'), findsOneWidget);
        expect(find.text('88% Mastery'), findsOneWidget);

        // Courses
        expect(find.text('Courses & Subjects'), findsOneWidget);
        expect(find.text('CS304'), findsOneWidget);
        expect(find.text('Enrolled ✓'), findsOneWidget);

        // Learning materials
        expect(find.text('Learning Materials'), findsOneWidget);
        expect(find.text('Flutter_Notes.pdf'), findsOneWidget);

        // Doubt sessions
        expect(find.text('Faculty Doubt Sessions'), findsOneWidget);
        expect(find.text('Widget Testing Doubts'), findsOneWidget);
      },
    );

    testWidgets(
      'StudentHomeScreen switches between Enrolled and All Subjects filter',
      (tester) async {
        final studentProv = StudentDashboardProvider(
          subjectService: FakeSubjectService(),
          documentService: FakeDocumentService(),
          adaptiveService: FakeAdaptiveService(),
          meetingService: FakeMeetingService(),
        );

        await tester.pumpWidget(
          createHarness(
            child: const StudentHomeScreen(student: studentUser),
            studentProv: studentProv,
          ),
        );
        await tester.pumpAndSettle();

        // Initially on Enrolled Courses tab (1 course CS304)
        expect(find.text('CS304'), findsOneWidget);
        expect(find.text('CS305'), findsNothing);

        // Tap 'All Subjects' chip
        await tester.tap(find.textContaining('All Subjects'));
        await tester.pumpAndSettle();

        // Now both CS304 and CS305 are displayed
        expect(find.text('CS304'), findsOneWidget);
        expect(find.text('CS305'), findsOneWidget);
        expect(find.text('Enroll'), findsOneWidget);
      },
    );

    testWidgets(
      'FacultyHomeScreen renders assigned courses, materials, and consultation actions',
      (tester) async {
        final facultyProv = FacultyDashboardProvider(
          subjectService: FakeSubjectService(),
          documentService: FakeDocumentService(),
          meetingService: FakeMeetingService(),
          analyticsService: FakeAnalyticsService(),
        );

        await tester.pumpWidget(
          createHarness(
            child: const FacultyHomeScreen(faculty: facultyUser),
            facultyProv: facultyProv,
          ),
        );
        await tester.pumpAndSettle();

        // Profile details
        expect(find.text('Dr. Smith'), findsOneWidget);
        expect(find.text('Dept: CE'), findsOneWidget);

        // Assigned courses
        expect(find.text('Assigned Courses'), findsOneWidget);
        expect(find.text('CS304'), findsOneWidget);

        // Consultations with action buttons
        expect(find.text('Student Consultations'), findsOneWidget);
        expect(find.text('Widget Testing Doubts'), findsOneWidget);
        expect(find.text('Approve (Create Teams)'), findsOneWidget);
        expect(find.text('Reject'), findsOneWidget);

        // Risk monitoring
        expect(find.text('Cohort Risk Monitoring'), findsOneWidget);
        expect(find.text('At-Risk Student'), findsOneWidget);
        expect(find.text('High Risk'), findsOneWidget);
      },
    );

    testWidgets('FacultyHomeScreen one-tap Approve updates booking status', (
      tester,
    ) async {
      final facultyProv = FacultyDashboardProvider(
        subjectService: FakeSubjectService(),
        documentService: FakeDocumentService(),
        meetingService: FakeMeetingService(),
        analyticsService: FakeAnalyticsService(),
      );

      await tester.pumpWidget(
        createHarness(
          child: const FacultyHomeScreen(faculty: facultyUser),
          facultyProv: facultyProv,
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Approve (Create Teams)' button
      await tester.tap(find.text('Approve (Create Teams)'));
      await tester.pumpAndSettle();

      // Verify status changed to APPROVED and Teams meeting link button appeared
      expect(find.text('APPROVED'), findsWidgets);
      expect(find.text('Launch Microsoft Teams Meeting'), findsOneWidget);
      expect(find.text('Approve (Create Teams)'), findsNothing);
    });

    testWidgets(
      'AdminHomeScreen renders institutional telemetry, pending approvals, and users',
      (tester) async {
        final adminProv = AdminDashboardProvider(
          analyticsService: FakeAnalyticsService(),
          documentService: FakeDocumentService(),
          subjectService: FakeSubjectService(),
        );

        await tester.pumpWidget(
          createHarness(
            child: const AdminHomeScreen(admin: adminUser),
            adminProv: adminProv,
          ),
        );
        await tester.pumpAndSettle();

        // Profile
        expect(find.text('Chief Admin'), findsOneWidget);
        expect(find.text('Administrator'), findsOneWidget);

        // Telemetry matrix
        expect(find.text('Institutional Telemetry'), findsOneWidget);
        expect(find.text('AI Queries'), findsOneWidget);
        expect(find.text('100'), findsOneWidget);
        expect(find.text('94.0%'), findsOneWidget);

        // Pending Document Approvals
        expect(find.text('Pending Document Approvals'), findsOneWidget);
        expect(find.text('Pending_Lab.pdf'), findsOneWidget);
        expect(find.text('Approve & Ingest'), findsOneWidget);

        // User Registry
        expect(find.text('User Registry'), findsOneWidget);
        expect(find.text('User One'), findsOneWidget);

        // Audit logs
        expect(find.text('Audit Log Activity'), findsOneWidget);
        expect(find.text('APPROVE_DOC'), findsOneWidget);
      },
    );

    testWidgets('AdminHomeScreen Approve & Ingest approves pending document', (
      tester,
    ) async {
      final adminProv = AdminDashboardProvider(
        analyticsService: FakeAnalyticsService(),
        documentService: FakeDocumentService(),
        subjectService: FakeSubjectService(),
      );

      await tester.pumpWidget(
        createHarness(
          child: const AdminHomeScreen(admin: adminUser),
          adminProv: adminProv,
        ),
      );
      await tester.pumpAndSettle();

      final approveButton = find.text('Approve & Ingest');
      expect(approveButton, findsOneWidget);

      // Ensure button is scrolled into viewport then tap
      await tester.ensureVisible(approveButton);
      await tester.pumpAndSettle();
      await tester.tap(approveButton);
      await tester.pumpAndSettle();

      // Document should be approved and removed from pending list
      expect(find.text('Pending_Lab.pdf'), findsNothing);
      expect(
        find.text(
          'No documents pending approval. All faculty materials are processed.',
        ),
        findsOneWidget,
      );
    });
  });
}
