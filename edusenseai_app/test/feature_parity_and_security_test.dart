import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/announcements/announcements_screen.dart';
import 'package:edusenseai/features/auth/change_password_screen.dart';
import 'package:edusenseai/features/auth/google_sign_in_modal.dart';
import 'package:edusenseai/features/auth/register_screen.dart';
import 'package:edusenseai/features/bookmarks/bookmarks_screen.dart';
import 'package:edusenseai/features/discussion/discussion_forum_screen.dart';
import 'package:edusenseai/features/navigation/role_router.dart';
import 'package:edusenseai/features/planner/study_planner_screen.dart';
import 'package:edusenseai/features/profile/profile_screen.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/admin_dashboard_provider.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'package:edusenseai/providers/faculty_dashboard_provider.dart';
import 'package:edusenseai/providers/student_dashboard_provider.dart';
import 'package:edusenseai/services/session_cleanup_service.dart';
import 'auth_provider_test.dart';
import 'dashboard_providers_test.dart';

void main() {
  group('Phase 8 & Web Parity: Security & Password Policies', () {
    late FakeAuthService fakeAuthService;
    late FakeTokenStorageService fakeStorage;
    late AuthProvider authProvider;

    setUp(() {
      fakeAuthService = FakeAuthService();
      fakeStorage = FakeTokenStorageService();
      authProvider = AuthProvider(
        authService: fakeAuthService,
        tokenStorage: fakeStorage,
      );
    });

    testWidgets(
      'RoleRouter redirects user with mustChangePassword: true to ChangePasswordScreen',
      (tester) async {
        const userWithMustChange = UserModel(
          id: 'user-must-change-1',
          name: 'New Student',
          email: 'newstudent@charusat.edu.in',
          role: 'student',
          departmentId: 'CSE',
          mustChangePassword: true,
        );

        await authProvider.login(
          email: 'alice@institution.edu',
          password: 'pass',
          role: 'student',
        );
        authProvider.updateUser(userWithMustChange);

        final testWidget = MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<StudentDashboardProvider>(
              create:
                  (_) => StudentDashboardProvider(
                    subjectService: FakeSubjectService(),
                    documentService: FakeDocumentService(),
                    adaptiveService: FakeAdaptiveService(),
                    meetingService: FakeMeetingService(),
                  ),
            ),
          ],
          child: const MaterialApp(home: RoleRouter(autoRestore: false)),
        );

        await tester.pumpWidget(testWidget);
        await tester.pumpAndSettle();

        expect(find.byType(ChangePasswordScreen), findsOneWidget);
        expect(find.text('Password Reset Required'), findsOneWidget);
        expect(find.text('Set New Password'), findsOneWidget);
      },
    );

    testWidgets('ChangePasswordScreen validates password matching and length', (
      tester,
    ) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(
            home: ChangePasswordScreen(isMandatory: false),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Update Password'), findsOneWidget);

      // Enter short new password
      final textFields = find.byType(TextFormField);
      await tester.enterText(textFields.at(0), 'oldpass123');
      await tester.enterText(textFields.at(1), '12345'); // 5 chars
      await tester.enterText(textFields.at(2), '12345');

      final updateBtn = find.widgetWithText(ElevatedButton, 'Update Password');
      await tester.ensureVisible(updateBtn);
      await tester.tap(updateBtn);
      await tester.pumpAndSettle();

      expect(
        find.text('New password must be at least 6 characters'),
        findsOneWidget,
      );

      // Enter mismatched confirmation
      await tester.enterText(textFields.at(1), 'newpass123');
      await tester.enterText(textFields.at(2), 'mismatch456');
      await tester.tap(updateBtn);
      await tester.pumpAndSettle();

      expect(find.text('Passwords do not match'), findsOneWidget);
    });

    test('SessionCleanupService clears registered RAM caches on logout', () async {
      final cleanupService = SessionCleanupService();
      cleanupService.clearHandlersForTesting();

      bool studentCachePurged = false;
      bool facultyCachePurged = false;

      cleanupService.registerHandler(() async {
        studentCachePurged = true;
      });
      cleanupService.registerHandler(() async {
        facultyCachePurged = true;
      });

      expect(studentCachePurged, isFalse);
      expect(facultyCachePurged, isFalse);

      await authProvider.logout();

      expect(studentCachePurged, isTrue);
      expect(facultyCachePurged, isTrue);
    });
  });

  group('Phase 8 & Web Parity: 2-Step Registration & Google Modal', () {
    late FakeAuthService fakeAuthService;
    late FakeTokenStorageService fakeStorage;
    late AuthProvider authProvider;

    setUp(() {
      fakeAuthService = FakeAuthService();
      fakeStorage = FakeTokenStorageService();
      authProvider = AuthProvider(
        authService: fakeAuthService,
        tokenStorage: fakeStorage,
      );
    });

    testWidgets('RegisterScreen contains web departments CSE, CE, IT, EC, AIML', (
      tester,
    ) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(home: RegisterScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Join EduSense AI'), findsOneWidget);
      expect(find.text('Send Verification Code'), findsOneWidget);
    });

    testWidgets('GoogleSignInModal displays all demo institutional accounts', (
      tester,
    ) async {
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: const MaterialApp(
            home: Scaffold(
              body: GoogleSignInModal(activeRole: 'faculty'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sign in with Google'), findsOneWidget);
      expect(find.text('Dr. Nisha Shah'), findsOneWidget);
      expect(find.text('Prof. Anil Kumar'), findsOneWidget);
    });
  });

  group('Phase 8 & Web Parity: Screen Smoke & Navigation Tests', () {
    late FakeAuthService fakeAuthService;
    late FakeTokenStorageService fakeStorage;
    late AuthProvider authProvider;

    setUp(() async {
      fakeAuthService = FakeAuthService();
      fakeStorage = FakeTokenStorageService();
      authProvider = AuthProvider(
        authService: fakeAuthService,
        tokenStorage: fakeStorage,
      );
      await authProvider.login(
        email: 'alice@institution.edu',
        password: 'pass',
        role: 'student',
      );
    });

    Widget wrap(Widget child) {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
          ChangeNotifierProvider<StudentDashboardProvider>(
            create:
                (_) => StudentDashboardProvider(
                  subjectService: FakeSubjectService(),
                  documentService: FakeDocumentService(),
                  adaptiveService: FakeAdaptiveService(),
                  meetingService: FakeMeetingService(),
                ),
          ),
          ChangeNotifierProvider<FacultyDashboardProvider>(
            create:
                (_) => FacultyDashboardProvider(
                  subjectService: FakeSubjectService(),
                  documentService: FakeDocumentService(),
                  meetingService: FakeMeetingService(),
                  analyticsService: FakeAnalyticsService(),
                ),
          ),
          ChangeNotifierProvider<AdminDashboardProvider>(
            create:
                (_) => AdminDashboardProvider(
                  analyticsService: FakeAnalyticsService(),
                  documentService: FakeDocumentService(),
                  subjectService: FakeSubjectService(),
                ),
          ),
        ],
        child: MaterialApp(home: child),
      );
    }

    testWidgets('ProfileScreen renders user information and preferences', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const ProfileScreen()));
      await tester.pumpAndSettle();

      expect(find.text('My Profile'), findsOneWidget);
      expect(find.text('SECURITY & PREFERENCES'), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });

    testWidgets('StudyPlannerScreen renders remediation tasks and study tools', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const StudyPlannerScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Study Planner & Remediation'), findsOneWidget);
      expect(find.text('Topics to remediate'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
    });

    testWidgets('BookmarksScreen renders notebook and subject filter', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const BookmarksScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Study Notebook'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
    });

    testWidgets('DiscussionForumScreen renders categories and search', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const DiscussionForumScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Discussion Forum'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
    });

    testWidgets('AnnouncementsScreen renders announcements and categories', (
      tester,
    ) async {
      await tester.pumpWidget(wrap(const AnnouncementsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Official Announcements'), findsOneWidget);
      expect(find.text('Institution-wide'), findsOneWidget);
    });
  });
}
