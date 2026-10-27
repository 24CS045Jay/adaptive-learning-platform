import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/core/network/api_client.dart';
import 'package:edusenseai/models/auth_response.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/auth_provider.dart';
import 'package:edusenseai/services/auth_service.dart';
import 'package:edusenseai/services/token_storage_service.dart';

/// Fake in-memory implementation of TokenStorageService for testing.
class FakeTokenStorageService implements TokenStorageService {
  String? _token;
  UserModel? _cachedUser;

  @override
  Future<void> saveSession(String token, UserModel user) async {
    _token = token;
    _cachedUser = user;
  }

  @override
  Future<String?> getToken() async => _token;

  @override
  Future<UserModel?> getUser() async => _cachedUser;

  @override
  Future<bool> hasSession() async => _token != null && _token!.isNotEmpty;

  @override
  Future<void> clearSession() async {
    _token = null;
    _cachedUser = null;
  }
}

/// Fake implementation of AuthService that mocks backend responses.
class FakeAuthService implements AuthService {
  bool failNextLogin = false;
  String? loginErrorMessage;
  bool sessionInvalid = false;

  final UserModel mockStudent = const UserModel(
    id: 'student-101',
    name: 'Alice Student',
    email: 'alice@institution.edu',
    role: 'student',
    departmentId: 'CE',
  );

  final UserModel mockFaculty = const UserModel(
    id: 'faculty-201',
    name: 'Dr. Smith',
    email: 'smith@institution.edu',
    role: 'faculty',
    departmentId: 'CE',
  );

  final UserModel mockAdmin = const UserModel(
    id: 'admin-301',
    name: 'Chief Admin',
    email: 'admin@institution.edu',
    role: 'admin',
    departmentId: 'CE',
  );

  @override
  Future<AuthResponse> login({
    required String email,
    required String password,
    String? role,
  }) async {
    if (failNextLogin) {
      throw AppException(
        loginErrorMessage ?? 'Invalid email or password.',
        statusCode: 401,
      );
    }

    if (role == 'faculty') {
      return AuthResponse(token: 'valid-jwt-faculty', user: mockFaculty);
    } else if (role == 'admin') {
      return AuthResponse(token: 'valid-jwt-admin', user: mockAdmin);
    }

    return AuthResponse(token: 'valid-jwt-student', user: mockStudent);
  }

  UserModel? sessionUser;

  @override
  Future<UserModel> validateSession(String token) async {
    if (sessionInvalid || token == 'expired-token') {
      throw AppException('Invalid or expired session token.', statusCode: 401);
    }
    return sessionUser ?? mockStudent;
  }

  @override
  Future<OtpResponse> sendOtp({required String email, String? name}) async {
    if (email == 'conflict@example.com') {
      throw AppException(
        'An account with this email already exists.',
        statusCode: 409,
      );
    }
    return const OtpResponse(
      ok: true,
      message: 'A 6-digit verification code has been sent.',
      expiresInSeconds: 600,
      emailSent: true,
    );
  }

  @override
  Future<AuthResponse> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String departmentId = 'CE',
    String? otp,
  }) async {
    if (otp != '123456') {
      throw AppException('Invalid 6-digit verification code.', statusCode: 400);
    }
    return AuthResponse(
      token: 'jwt-registered-user',
      user: UserModel(
        id: 'new-user-1',
        name: name,
        email: email,
        role: role,
        departmentId: departmentId,
      ),
    );
  }

  @override
  Future<PasswordResetResponse> forgotPassword({required String email}) async {
    return const PasswordResetResponse(
      ok: true,
      message: 'If an account exists, a reset link has been sent.',
      emailSent: true,
    );
  }

  @override
  Future<PasswordResetResponse> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    if (token == 'invalid-token') {
      throw AppException(
        'Invalid or expired password reset link.',
        statusCode: 400,
      );
    }
    return const PasswordResetResponse(
      ok: true,
      message: 'Password has been successfully reset.',
      emailSent: false,
    );
  }

  @override
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (currentPassword == 'wrong-current-password') {
      throw AppException('Current password is incorrect.', statusCode: 400);
    }
    return true;
  }
}

void main() {
  late FakeAuthService fakeAuthService;
  late FakeTokenStorageService fakeStorage;
  late ApiClient apiClient;
  late AuthProvider authProvider;

  setUp(() {
    fakeAuthService = FakeAuthService();
    fakeStorage = FakeTokenStorageService();
    apiClient = ApiClient();
    authProvider = AuthProvider(
      authService: fakeAuthService,
      tokenStorage: fakeStorage,
      apiClient: apiClient,
    );
  });

  group('AuthProvider State & Authentication Tests', () {
    test('Initial status is AuthStatus.initial with no active user', () {
      expect(authProvider.status, equals(AuthStatus.initial));
      expect(authProvider.user, isNull);
      expect(authProvider.token, isNull);
      expect(authProvider.isAuthenticated, isFalse);
    });

    test(
      'Successful login saves token, populates user, and updates status to authenticated',
      () async {
        final success = await authProvider.login(
          email: 'alice@institution.edu',
          password: 'password123',
          role: 'student',
        );

        expect(success, isTrue);
        expect(authProvider.status, equals(AuthStatus.authenticated));
        expect(authProvider.isAuthenticated, isTrue);
        expect(authProvider.user?.name, equals('Alice Student'));
        expect(authProvider.user?.isStudent, isTrue);
        expect(authProvider.token, equals('valid-jwt-student'));

        // Verify token persisted in secure storage
        final storedToken = await fakeStorage.getToken();
        expect(storedToken, equals('valid-jwt-student'));
      },
    );

    test(
      'Login with invalid credentials records error and sets status to error',
      () async {
        fakeAuthService.failNextLogin = true;
        fakeAuthService.loginErrorMessage = 'Invalid email or password.';

        final success = await authProvider.login(
          email: 'bad@institution.edu',
          password: 'wrongpassword',
          role: 'student',
        );

        expect(success, isFalse);
        expect(authProvider.status, equals(AuthStatus.error));
        expect(authProvider.isAuthenticated, isFalse);
        expect(authProvider.errorMessage, equals('Invalid email or password.'));
        expect(authProvider.user, isNull);
      },
    );

    test(
      'Session restoration with valid token restores authenticated state',
      () async {
        await fakeStorage.saveSession(
          'saved-valid-jwt',
          fakeAuthService.mockStudent,
        );

        await authProvider.restoreSession();

        expect(authProvider.status, equals(AuthStatus.authenticated));
        expect(authProvider.isAuthenticated, isTrue);
        expect(authProvider.user?.email, equals('alice@institution.edu'));
        expect(authProvider.token, equals('saved-valid-jwt'));
      },
    );

    test(
      'Session restoration with expired token wipes secure storage and returns unauthenticated',
      () async {
        await fakeStorage.saveSession(
          'expired-token',
          fakeAuthService.mockStudent,
        );
        fakeAuthService.sessionInvalid = true;

        await authProvider.restoreSession();

        expect(authProvider.status, equals(AuthStatus.unauthenticated));
        expect(authProvider.isAuthenticated, isFalse);
        expect(authProvider.user, isNull);
        expect(authProvider.token, isNull);

        // Storage must be cleared
        final stored = await fakeStorage.getToken();
        expect(stored, isNull);
      },
    );

    test('Send OTP successfully and handles email conflict errors', () async {
      final successOtp = await authProvider.sendOtp(
        email: 'newuser@example.com',
        name: 'New User',
      );
      expect(successOtp, isNotNull);
      expect(successOtp?.ok, isTrue);

      final conflictOtp = await authProvider.sendOtp(
        email: 'conflict@example.com',
        name: 'Conflict User',
      );
      expect(conflictOtp, isNull);
      expect(
        authProvider.errorMessage,
        contains('account with this email already exists'),
      );
    });

    test(
      'Registration with valid OTP signs in user and updates authenticated state',
      () async {
        final registered = await authProvider.register(
          name: 'Fresh Student',
          email: 'fresh@example.com',
          password: 'securePass123',
          role: 'student',
          departmentId: 'CE',
          otp: '123456',
        );

        expect(registered, isTrue);
        expect(authProvider.status, equals(AuthStatus.authenticated));
        expect(authProvider.user?.name, equals('Fresh Student'));
        expect(authProvider.user?.role, equals('student'));
        expect(authProvider.token, equals('jwt-registered-user'));
      },
    );

    test(
      'Registration with invalid OTP reports backend error message',
      () async {
        final registered = await authProvider.register(
          name: 'Fresh Student',
          email: 'fresh@example.com',
          password: 'securePass123',
          role: 'student',
          departmentId: 'CE',
          otp: '999999',
        );

        expect(registered, isFalse);
        expect(
          authProvider.errorMessage,
          equals('Invalid 6-digit verification code.'),
        );
      },
    );

    test('Forgot password and reset password flows execute properly', () async {
      final forgotRes = await authProvider.forgotPassword(
        email: 'alice@institution.edu',
      );
      expect(forgotRes, isNotNull);
      expect(forgotRes?.ok, isTrue);

      final resetRes = await authProvider.resetPassword(
        token: 'valid-reset-token',
        newPassword: 'newSecretPassword123',
      );
      expect(resetRes, isNotNull);
      expect(resetRes?.ok, isTrue);

      final badReset = await authProvider.resetPassword(
        token: 'invalid-token',
        newPassword: 'newSecretPassword123',
      );
      expect(badReset, isNull);
      expect(
        authProvider.errorMessage,
        contains('Invalid or expired password reset link'),
      );
    });

    test(
      'Logout clears user, token, secure storage, and sets unauthenticated status',
      () async {
        // First log in
        await authProvider.login(
          email: 'alice@institution.edu',
          password: 'password123',
          role: 'student',
        );
        expect(authProvider.isAuthenticated, isTrue);

        // Now log out
        await authProvider.logout();
        expect(authProvider.status, equals(AuthStatus.unauthenticated));
        expect(authProvider.isAuthenticated, isFalse);
        expect(authProvider.user, isNull);
        expect(authProvider.token, isNull);

        final storedToken = await fakeStorage.getToken();
        expect(storedToken, isNull);
      },
    );
  });
}
