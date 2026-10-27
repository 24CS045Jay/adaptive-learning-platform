import 'user_model.dart';

/// Response payload from `POST /api/auth/login` and `POST /api/auth/register`.
class AuthResponse {
  final String token;
  final UserModel user;

  const AuthResponse({required this.token, required this.user});

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      token: json['token']?.toString() ?? '',
      user: UserModel.fromJson(
        json['user'] is Map<String, dynamic>
            ? json['user'] as Map<String, dynamic>
            : {},
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {'token': token, 'user': user.toJson()};
  }
}

/// Response payload from `POST /api/auth/send-otp`.
class OtpResponse {
  final bool ok;
  final String message;
  final int expiresInSeconds;
  final bool emailSent;

  const OtpResponse({
    required this.ok,
    required this.message,
    required this.expiresInSeconds,
    required this.emailSent,
  });

  factory OtpResponse.fromJson(Map<String, dynamic> json) {
    return OtpResponse(
      ok: json['ok'] == true,
      message:
          json['message']?.toString() ??
          json['error']?.toString() ??
          'OTP processed.',
      expiresInSeconds: (json['expiresInSeconds'] as num?)?.toInt() ?? 600,
      emailSent: json['emailSent'] == true,
    );
  }
}

/// Response payload from password recovery endpoints.
class PasswordResetResponse {
  final bool ok;
  final String message;
  final bool emailSent;

  const PasswordResetResponse({
    required this.ok,
    required this.message,
    this.emailSent = false,
  });

  factory PasswordResetResponse.fromJson(Map<String, dynamic> json) {
    return PasswordResetResponse(
      ok: json['ok'] == true,
      message:
          json['message']?.toString() ??
          json['error']?.toString() ??
          'Request processed.',
      emailSent: json['emailSent'] == true,
    );
  }
}
