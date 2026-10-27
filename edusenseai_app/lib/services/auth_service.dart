import 'package:dio/dio.dart';
import '../core/config/app_config.dart';
import '../core/network/api_client.dart';
import '../models/auth_response.dart';
import '../models/user_model.dart';

/// Service communicating with the verified EduSense AI authentication endpoints.
class AuthService {
  final ApiClient _client;

  AuthService({ApiClient? client}) : _client = client ?? ApiClient();

  /// Logs in using email, password, and optional role filter.
  Future<AuthResponse> login({
    required String email,
    required String password,
    String? role,
  }) async {
    final payload = <String, dynamic>{
      'email': email.trim().toLowerCase(),
      'password': password,
    };
    if (role != null && role.isNotEmpty) {
      payload['role'] = role.trim().toLowerCase();
    }

    final response = await _client.post(AppConfig.loginEndpoint, data: payload);

    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Sends a 6-digit verification code to the target email via Brevo transactional email.
  Future<OtpResponse> sendOtp({required String email, String? name}) async {
    final payload = <String, dynamic>{
      'email': email.trim().toLowerCase(),
      'name': (name ?? 'Student').trim(),
    };

    final response = await _client.post(
      AppConfig.sendOtpEndpoint,
      data: payload,
    );

    return OtpResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Verifies OTP code and registers a new account in the system.
  Future<AuthResponse> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String departmentId = 'CE',
    String? otp,
  }) async {
    final payload = <String, dynamic>{
      'name': name.trim(),
      'email': email.trim().toLowerCase(),
      'password': password,
      'role': role.trim().toLowerCase(),
      'departmentId': departmentId.trim().toUpperCase(),
    };
    if (otp != null && otp.trim().isNotEmpty) {
      payload['otp'] = otp.trim();
    }

    final response = await _client.post(
      AppConfig.registerEndpoint,
      data: payload,
    );

    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Validates an active JWT Bearer token via `GET /api/auth/me`.
  Future<UserModel> validateSession(String token) async {
    final response = await _client.get(
      AppConfig.meEndpoint,
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    final data = response.data as Map<String, dynamic>;
    final userMap = data['user'] as Map<String, dynamic>? ?? data;
    return UserModel.fromJson(userMap);
  }

  /// Submits a password recovery request.
  Future<PasswordResetResponse> forgotPassword({required String email}) async {
    final response = await _client.post(
      AppConfig.forgotPasswordEndpoint,
      data: {'email': email.trim().toLowerCase()},
    );

    return PasswordResetResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Submits a new password along with a reset token received via email.
  Future<PasswordResetResponse> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final response = await _client.post(
      AppConfig.resetPasswordEndpoint,
      data: {'token': token.trim(), 'newPassword': newPassword},
    );

    return PasswordResetResponse.fromJson(
      response.data as Map<String, dynamic>,
    );
  }

  /// Changes the user's password via authenticated `POST /api/auth/change-password`.
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _client.post(
      AppConfig.changePasswordEndpoint,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );

    final data = response.data as Map<String, dynamic>;
    return data['ok'] == true;
  }
}
