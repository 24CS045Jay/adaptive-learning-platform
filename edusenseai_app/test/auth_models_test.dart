import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/auth_response.dart';
import 'package:edusenseai/models/user_model.dart';

void main() {
  group('UserModel & UserRole Tests', () {
    test('UserRole parsing handles all backend role strings', () {
      expect(UserRole.fromString('student'), equals(UserRole.student));
      expect(UserRole.fromString('STUDENT'), equals(UserRole.student));
      expect(UserRole.fromString('faculty'), equals(UserRole.faculty));
      expect(UserRole.fromString('Faculty'), equals(UserRole.faculty));
      expect(UserRole.fromString('admin'), equals(UserRole.admin));
      expect(UserRole.fromString('Admin'), equals(UserRole.admin));
      expect(UserRole.fromString('super_admin'), equals(UserRole.superAdmin));
      expect(UserRole.fromString('superadmin'), equals(UserRole.superAdmin));
      expect(UserRole.fromString('guest'), equals(UserRole.unknown));
      expect(UserRole.fromString(null), equals(UserRole.unknown));
    });

    test('UserRole displayName and toBackendString', () {
      expect(UserRole.student.displayName, equals('Student'));
      expect(UserRole.student.toBackendString(), equals('student'));

      expect(UserRole.faculty.displayName, equals('Faculty Member'));
      expect(UserRole.faculty.toBackendString(), equals('faculty'));

      expect(UserRole.admin.displayName, equals('Administrator'));
      expect(UserRole.admin.toBackendString(), equals('admin'));

      expect(UserRole.superAdmin.displayName, equals('Super Administrator'));
      expect(UserRole.superAdmin.toBackendString(), equals('super_admin'));
    });

    test('UserModel boolean getters evaluate correct role permissions', () {
      const studentUser = UserModel(
        id: 'u-1',
        name: 'Alice Student',
        email: 'alice@institution.edu',
        role: 'student',
        departmentId: 'CE',
      );
      expect(studentUser.isStudent, isTrue);
      expect(studentUser.isFaculty, isFalse);
      expect(studentUser.isAdmin, isFalse);
      expect(studentUser.isSuperAdmin, isFalse);

      const facultyUser = UserModel(
        id: 'u-2',
        name: 'Dr. Bob',
        email: 'bob@institution.edu',
        role: 'faculty',
        departmentId: 'IT',
      );
      expect(facultyUser.isStudent, isFalse);
      expect(facultyUser.isFaculty, isTrue);
      expect(facultyUser.isAdmin, isFalse);
      expect(facultyUser.isSuperAdmin, isFalse);

      const adminUser = UserModel(
        id: 'u-3',
        name: 'Carol Admin',
        email: 'carol@institution.edu',
        role: 'admin',
      );
      expect(adminUser.isStudent, isFalse);
      expect(adminUser.isFaculty, isFalse);
      expect(adminUser.isAdmin, isTrue);
      expect(adminUser.isSuperAdmin, isFalse);

      const superAdminUser = UserModel(
        id: 'u-4',
        name: 'Dave Super',
        email: 'dave@institution.edu',
        role: 'super_admin',
      );
      expect(superAdminUser.isStudent, isFalse);
      expect(superAdminUser.isFaculty, isFalse);
      expect(superAdminUser.isAdmin, isTrue);
      expect(superAdminUser.isSuperAdmin, isTrue);
    });

    test(
      'UserModel JSON serialization and deserialization matches backend format',
      () {
        final backendJson = {
          'id': 'usr_12345',
          'name': 'Jay Ladva',
          'email': 'jay@example.com',
          'role': 'student',
          'departmentId': 'CE',
          'mustChangePassword': false,
        };

        final user = UserModel.fromJson(backendJson);
        expect(user.id, equals('usr_12345'));
        expect(user.name, equals('Jay Ladva'));
        expect(user.email, equals('jay@example.com'));
        expect(user.role, equals('student'));
        expect(user.departmentId, equals('CE'));
        expect(user.mustChangePassword, isFalse);

        final serialized = user.toJson();
        expect(serialized['id'], equals('usr_12345'));
        expect(serialized['name'], equals('Jay Ladva'));
        expect(serialized['email'], equals('jay@example.com'));
        expect(serialized['role'], equals('student'));
        expect(serialized['departmentId'], equals('CE'));
      },
    );

    test('UserModel copyWith produces modified clone', () {
      const user = UserModel(
        id: 'u-1',
        name: 'Original',
        email: 'orig@example.com',
        role: 'student',
      );

      final updated = user.copyWith(name: 'Updated Name', role: 'faculty');
      expect(updated.id, equals('u-1'));
      expect(updated.name, equals('Updated Name'));
      expect(updated.role, equals('faculty'));
      expect(updated.email, equals('orig@example.com'));
    });
  });

  group('AuthResponse Models Tests', () {
    test('AuthResponse parses token and nested user object', () {
      final json = {
        'token': 'mock-jwt-token-xyz',
        'user': {
          'id': 'u-99',
          'name': 'Test User',
          'email': 'test@institution.edu',
          'role': 'student',
          'departmentId': 'CE',
        },
      };

      final authResponse = AuthResponse.fromJson(json);
      expect(authResponse.token, equals('mock-jwt-token-xyz'));
      expect(authResponse.user.id, equals('u-99'));
      expect(authResponse.user.name, equals('Test User'));
      expect(authResponse.user.email, equals('test@institution.edu'));
      expect(authResponse.user.isStudent, isTrue);
    });

    test('OtpResponse parses Brevo email delivery response', () {
      final successJson = {
        'ok': true,
        'message':
            'A 6-digit verification code has been sent to test@example.com.',
        'expiresInSeconds': 600,
        'emailSent': true,
      };

      final otp = OtpResponse.fromJson(successJson);
      expect(otp.ok, isTrue);
      expect(otp.message, contains('6-digit verification code'));
      expect(otp.expiresInSeconds, equals(600));
      expect(otp.emailSent, isTrue);

      final failJson = {
        'ok': false,
        'error': 'Failed to deliver email.',
        'emailSent': false,
      };
      final failOtp = OtpResponse.fromJson(failJson);
      expect(failOtp.ok, isFalse);
      expect(failOtp.message, equals('Failed to deliver email.'));
      expect(failOtp.emailSent, isFalse);
    });

    test('PasswordResetResponse parses forgot and reset password responses', () {
      final json = {
        'ok': true,
        'message':
            'If an account with this email exists, a password reset link has been sent.',
        'emailSent': true,
      };

      final resetRes = PasswordResetResponse.fromJson(json);
      expect(resetRes.ok, isTrue);
      expect(resetRes.message, contains('password reset link has been sent'));
      expect(resetRes.emailSent, isTrue);
    });
  });
}
