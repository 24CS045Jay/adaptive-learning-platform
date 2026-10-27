import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/admin/admin_home_screen.dart';
import 'package:edusenseai/features/auth/access_denied_screen.dart';
import 'package:edusenseai/features/auth/login_screen.dart';
import 'package:edusenseai/features/faculty/faculty_home_screen.dart';
import 'package:edusenseai/features/navigation/role_router.dart';
import 'package:edusenseai/features/splash/splash_screen.dart';
import 'package:edusenseai/features/student/student_home_screen.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/admin_dashboard_provider.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'package:edusenseai/providers/faculty_dashboard_provider.dart';
import 'package:edusenseai/providers/student_dashboard_provider.dart';
import 'auth_provider_test.dart';
import 'dashboard_providers_test.dart';

void main() {
  Widget createTestWidget(AuthProvider authProvider) {
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
      child: const MaterialApp(home: RoleRouter(autoRestore: false)),
    );
  }

  group('Role-Based Navigation & Dispatcher Tests', () {
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

    testWidgets('RoleRouter shows SplashScreen when checkingSession', (
      tester,
    ) async {
      // Create widget with initial/checkingSession status
      await tester.pumpWidget(createTestWidget(authProvider));
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Verifying session...'), findsOneWidget);
    });

    testWidgets('RoleRouter displays LoginScreen when unauthenticated', (
      tester,
    ) async {
      await authProvider.logout(); // sets unauthenticated

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('Sign In as STUDENT'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Faculty'), findsOneWidget);
      expect(find.text('Admin'), findsOneWidget);
    });

    testWidgets('RoleRouter routes student to StudentHomeScreen', (
      tester,
    ) async {
      await authProvider.login(
        email: 'alice@institution.edu',
        password: 'pass',
        role: 'student',
      );

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(StudentHomeScreen), findsOneWidget);
      expect(find.text('Alice Student'), findsOneWidget);
      expect(find.text('Learning Progress'), findsOneWidget);
      expect(find.text('Courses & Subjects'), findsOneWidget);
    });

    testWidgets('RoleRouter routes faculty to FacultyHomeScreen', (
      tester,
    ) async {
      await authProvider.login(
        email: 'smith@institution.edu',
        password: 'pass',
        role: 'faculty',
      );

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(FacultyHomeScreen), findsOneWidget);
      expect(find.text('Dr. Smith'), findsOneWidget);
      expect(find.text('Assigned Courses'), findsOneWidget);
      expect(find.text('Student Consultations'), findsOneWidget);
    });

    testWidgets('RoleRouter routes admin to AdminHomeScreen', (tester) async {
      await authProvider.login(
        email: 'admin@institution.edu',
        password: 'pass',
        role: 'admin',
      );

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(find.text('Chief Admin'), findsOneWidget);
      expect(find.text('Institutional Telemetry'), findsOneWidget);
      expect(find.text('User Registry'), findsOneWidget);
    });

    testWidgets('RoleRouter routes super_admin to AdminHomeScreen', (
      tester,
    ) async {
      const superAdminUser = UserModel(
        id: 'super-1',
        name: 'Root Administrator',
        email: 'root@institution.edu',
        role: 'super_admin',
        departmentId: 'CE',
      );
      fakeAuthService.sessionUser = superAdminUser;
      await fakeStorage.saveSession('super-token', superAdminUser);
      await authProvider.restoreSession();

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(AdminHomeScreen), findsOneWidget);
      expect(find.text('Root Administrator'), findsOneWidget);
      expect(find.text('Super Admin'), findsOneWidget);
    });

    testWidgets('RoleRouter routes unrecognized roles to AccessDeniedScreen', (
      tester,
    ) async {
      const guestUser = UserModel(
        id: 'guest-1',
        name: 'Guest User',
        email: 'guest@example.com',
        role: 'guest_observer',
      );
      fakeAuthService.sessionUser = guestUser;
      await fakeStorage.saveSession('guest-token', guestUser);
      await authProvider.restoreSession();

      await tester.pumpWidget(createTestWidget(authProvider));
      await tester.pumpAndSettle();

      expect(find.byType(AccessDeniedScreen), findsOneWidget);
      expect(find.text('Access Restricted'), findsOneWidget);
      expect(find.textContaining('guest_observer'), findsOneWidget);
      expect(find.text('Log Out & Switch Account'), findsOneWidget);
    });

    testWidgets(
      'Logging out from StudentHomeScreen transitions back to LoginScreen',
      (tester) async {
        await authProvider.login(
          email: 'alice@institution.edu',
          password: 'pass',
          role: 'student',
        );

        await tester.pumpWidget(createTestWidget(authProvider));
        await tester.pumpAndSettle();

        expect(find.byType(StudentHomeScreen), findsOneWidget);

        // Perform logout
        await authProvider.logout();
        await tester.pumpAndSettle();

        expect(find.byType(LoginScreen), findsOneWidget);
        expect(find.byType(StudentHomeScreen), findsNothing);
      },
    );
  });
}
