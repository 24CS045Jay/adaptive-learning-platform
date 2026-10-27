import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/auth/forgot_password_dialog.dart';
import 'package:edusenseai/features/auth/login_screen.dart';
import 'package:edusenseai/features/auth/register_screen.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'auth_provider_test.dart';

void main() {
  Widget wrapWithProvider(Widget child, AuthProvider authProvider) {
    return ChangeNotifierProvider<AuthProvider>.value(
      value: authProvider,
      child: MaterialApp(home: child),
    );
  }

  group('LoginScreen Form & UI Tests', () {
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

    testWidgets('LoginScreen validates empty email and password', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrapWithProvider(const LoginScreen(), authProvider),
      );
      await tester.pumpAndSettle();

      // Clear pre-filled demo credentials to test validation
      await tester.enterText(find.byType(TextFormField).first, '');
      await tester.enterText(find.byType(TextFormField).at(1), '');

      // Tap Sign In without filling fields
      final signInButton = find.text('Sign In as STUDENT');
      await tester.ensureVisible(signInButton);
      await tester.tap(signInButton);
      await tester.pumpAndSettle();

      expect(find.text('Please enter your email'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
    });

    testWidgets('LoginScreen validates invalid email format', (tester) async {
      await tester.pumpWidget(
        wrapWithProvider(const LoginScreen(), authProvider),
      );
      await tester.pumpAndSettle();

      // Enter invalid email format
      await tester.enterText(find.byType(TextFormField).first, 'not-an-email');
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'secretpassword',
      );

      final signInButton = find.text('Sign In as STUDENT');
      await tester.ensureVisible(signInButton);
      await tester.tap(signInButton);
      await tester.pumpAndSettle();

      expect(find.text('Please enter a valid email address'), findsOneWidget);
    });

    testWidgets(
      'LoginScreen switches role tabs between Student, Faculty, and Admin',
      (tester) async {
        await tester.pumpWidget(
          wrapWithProvider(const LoginScreen(), authProvider),
        );
        await tester.pumpAndSettle();

        expect(find.text('Sign In as STUDENT'), findsOneWidget);

        // Tap Faculty tab
        await tester.tap(find.text('Faculty'));
        await tester.pumpAndSettle();
        expect(find.text('Sign In as FACULTY'), findsOneWidget);

        // Tap Admin tab
        await tester.tap(find.text('Admin'));
        await tester.pumpAndSettle();
        expect(find.text('Sign In as ADMIN'), findsOneWidget);
      },
    );

    testWidgets('Password visibility toggle toggles obscureText', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrapWithProvider(const LoginScreen(), authProvider),
      );
      await tester.pumpAndSettle();

      final visibilityButton = find.byTooltip('Show password');
      expect(visibilityButton, findsOneWidget);

      await tester.tap(visibilityButton);
      await tester.pumpAndSettle();

      expect(find.byTooltip('Hide password'), findsOneWidget);
    });
  });

  group('RegisterScreen Form & OTP Tests', () {
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

    testWidgets('RegisterScreen validates required fields on submission', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrapWithProvider(const RegisterScreen(), authProvider),
      );
      await tester.pumpAndSettle();

      final sendCodeBtn = find.widgetWithText(
        ElevatedButton,
        'Send Verification Code',
      );
      await tester.tap(sendCodeBtn);
      await tester.pumpAndSettle();

      expect(find.text('Please enter your full name'), findsOneWidget);
      expect(find.text('Please enter your email'), findsOneWidget);
      expect(find.text('Please enter a password'), findsOneWidget);
    });

    testWidgets(
      'RegisterScreen enforces password minimum length of 6 characters',
      (tester) async {
        await tester.pumpWidget(
          wrapWithProvider(const RegisterScreen(), authProvider),
        );
        await tester.pumpAndSettle();

        await tester.enterText(find.byType(TextFormField).at(0), 'John Doe');
        await tester.enterText(
          find.byType(TextFormField).at(1),
          'john@example.com',
        );
        await tester.enterText(
          find.byType(TextFormField).at(2),
          '12345',
        ); // 5 chars

        final sendCodeBtn = find.widgetWithText(
          ElevatedButton,
          'Send Verification Code',
        );
        await tester.tap(sendCodeBtn);
        await tester.pumpAndSettle();

        expect(
          find.text('Password must be at least 6 characters'),
          findsOneWidget,
        );
      },
    );
  });

  group('ForgotPasswordDialog UI Tests', () {
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
      'ForgotPasswordDialog validates email input and allows token mode switch',
      (tester) async {
        await tester.pumpWidget(
          wrapWithProvider(
            const Scaffold(body: ForgotPasswordDialog(initialEmail: '')),
            authProvider,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Forgot Password'), findsOneWidget);
        expect(find.text('Send Password Reset Link'), findsOneWidget);

        // Validate empty email
        await tester.tap(find.text('Send Password Reset Link'));
        await tester.pumpAndSettle();
        expect(find.text('Please enter your email'), findsOneWidget);

        // Switch to token input mode
        await tester.tap(find.text('Already have a reset token?'));
        await tester.pumpAndSettle();

        expect(find.text('Reset Password'), findsOneWidget);
        expect(find.text('Update Password'), findsOneWidget);
      },
    );
  });
}
