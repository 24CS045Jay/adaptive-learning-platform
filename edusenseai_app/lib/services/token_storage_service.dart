import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user_model.dart';

/// Secure token & session storage using Android Keystore / iOS Keychain.
class TokenStorageService {
  static const String _keyToken = 'edusense_auth_token';
  static const String _keyUser = 'edusense_user_data';

  final FlutterSecureStorage _storage;

  TokenStorageService({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock,
            ),
          );

  /// Saves the active JWT token and serialized user profile securely.
  Future<void> saveSession(String token, UserModel user) async {
    await _storage.write(key: _keyToken, value: token);
    await _storage.write(key: _keyUser, value: jsonEncode(user.toJson()));
  }

  /// Retrieves the stored JWT Bearer token if one exists.
  Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  /// Retrieves the cached user profile if available.
  Future<UserModel?> getUser() async {
    final raw = await _storage.read(key: _keyUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return UserModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  /// Checks whether a token exists in secure storage.
  Future<bool> hasSession() async {
    final token = await getToken();
    return token != null && token.trim().isNotEmpty;
  }

  /// Wipes all saved credentials and session data on logout or expiration.
  Future<void> clearSession() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keyUser);
  }
}
