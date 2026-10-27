import 'package:flutter/foundation.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/auth_response.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/session_cleanup_service.dart';
import '../services/token_storage_service.dart';

enum AuthStatus {
  initial,
  checkingSession,
  authenticated,
  unauthenticated,
  error,
}

/// Central state provider managing user session, login, registration, and role routing.
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final TokenStorageService _tokenStorage;
  final ApiClient _apiClient;

  AuthStatus _status = AuthStatus.initial;
  UserModel? _user;
  String? _token;
  String? _errorMessage;
  bool _isLoading = false;

  AuthProvider({
    AuthService? authService,
    TokenStorageService? tokenStorage,
    ApiClient? apiClient,
  }) : _authService = authService ?? AuthService(),
       _tokenStorage = tokenStorage ?? TokenStorageService(),
       _apiClient = apiClient ?? ApiClient() {
    _apiClient.onUnauthorized = handleSessionExpired;
  }

  AuthStatus get status => _status;
  UserModel? get user => _user;
  String? get token => _token;
  String? get errorMessage => _errorMessage;
  bool get isLoading => _isLoading;
  bool get isAuthenticated =>
      _status == AuthStatus.authenticated && _user != null;

  @visibleForTesting
  void setUserForTesting(UserModel user) {
    _user = user;
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  /// Restores session on app startup by validating the stored token against the backend.
  Future<void> restoreSession() async {
    _status = AuthStatus.checkingSession;
    _errorMessage = null;
    notifyListeners();

    try {
      final savedToken = await _tokenStorage.getToken();
      if (savedToken == null || savedToken.trim().isEmpty) {
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return;
      }

      // Configure ApiClient with stored token
      _apiClient.setAuthToken(savedToken);

      // Validate token with backend `GET /api/auth/me`
      final verifiedUser = await _authService.validateSession(savedToken);
      _user = verifiedUser;
      _token = savedToken;
      _status = AuthStatus.authenticated;

      // Update cached user in storage
      await _tokenStorage.saveSession(savedToken, verifiedUser);
    } catch (e) {
      debugPrint('[AuthProvider] Session restoration expired or failed: $e');
      // Token is invalid or expired — wipe it cleanly
      await _tokenStorage.clearSession();
      _apiClient.clearAuthToken();
      _user = null;
      _token = null;
      _status = AuthStatus.unauthenticated;
    } finally {
      notifyListeners();
    }
  }

  /// Logs in the user with email, password, and optional role filter.
  Future<bool> login({
    required String email,
    required String password,
    String? role,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.login(
        email: email,
        password: password,
        role: role,
      );

      _token = response.token;
      _user = response.user;
      _apiClient.setAuthToken(response.token);

      // Persist to secure encrypted storage
      await _tokenStorage.saveSession(response.token, response.user);

      _status = AuthStatus.authenticated;
      _isLoading = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _status = AuthStatus.error;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage =
          'An unexpected error occurred during login. Please try again.';
      _status = AuthStatus.error;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Requests a 6-digit OTP code sent via Brevo email for registration.
  Future<OtpResponse?> sendOtp({required String email, String? name}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.sendOtp(email: email, name: name);
      _isLoading = false;
      notifyListeners();
      return response;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      _errorMessage =
          'Failed to send verification code. Please check your network.';
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  /// Verifies OTP and registers a new account in the system.
  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String departmentId = 'CE',
    String? otp,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.register(
        name: name,
        email: email,
        password: password,
        role: role,
        departmentId: departmentId,
        otp: otp,
      );

      _token = response.token;
      _user = response.user;
      _apiClient.setAuthToken(response.token);

      await _tokenStorage.saveSession(response.token, response.user);

      _status = AuthStatus.authenticated;
      _isLoading = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _status = AuthStatus.error;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during registration.';
      _status = AuthStatus.error;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Sends a password reset request to the user's email.
  Future<PasswordResetResponse?> forgotPassword({required String email}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.forgotPassword(email: email);
      _isLoading = false;
      notifyListeners();
      return response;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      _errorMessage = 'Failed to submit password reset request.';
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  /// Confirms a password reset with token and new password.
  Future<PasswordResetResponse?> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _authService.resetPassword(
        token: token,
        newPassword: newPassword,
      );
      _isLoading = false;
      notifyListeners();
      return response;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return null;
    } catch (e) {
      _errorMessage = 'Failed to reset password.';
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  /// Handles 401 Unauthorized API responses from backend by securely clearing session
  Future<void> handleSessionExpired() async {
    if (_status == AuthStatus.unauthenticated) return;
    try {
      await _tokenStorage.clearSession();
      _apiClient.clearAuthToken();
      await SessionCleanupService().executeAllCleanups();
      _user = null;
      _token = null;
      _status = AuthStatus.unauthenticated;
      _errorMessage = 'Your session has expired. Please sign in again.';
    } finally {
      notifyListeners();
    }
  }

  /// Clears the user session and secure storage, returning to login.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _tokenStorage.clearSession();
      _apiClient.clearAuthToken();
      await SessionCleanupService().executeAllCleanups();
      _user = null;
      _token = null;
      _status = AuthStatus.unauthenticated;
      _errorMessage = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Changes the user's password and clears the mustChangePassword flag.
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final success = await _authService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      if (success && _user != null) {
        _user = _user!.copyWith(mustChangePassword: false);
        if (_token != null) {
          await _tokenStorage.saveSession(_token!, _user!);
        }
      }

      _isLoading = false;
      notifyListeners();
      return success;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Failed to update password. Please check your current password.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Updates local user profile state after profile modifications
  void updateUser(UserModel updatedUser) {
    _user = updatedUser;
    if (_token != null) {
      _tokenStorage.saveSession(_token!, updatedUser);
    }
    notifyListeners();
  }

  /// Clears transient error messages.
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
