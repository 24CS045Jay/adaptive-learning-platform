import 'package:flutter/foundation.dart';

/// Centralized configuration for EduSense AI mobile application.
///
/// Handles environment-aware API base URLs, networking timeouts,
/// and core application metadata.
class AppConfig {
  AppConfig._();

  // App Metadata
  static const String appName = 'EduSense AI';
  static const String appTagline = 'Learn Smarter. Adapt Faster. Achieve More.';
  static const String appVersion = '1.0.0 (Phase 8 Production)';

  /// Optional override supplied at build time:
  /// Example: flutter run --dart-define=API_BASE_URL=https://api.edusense.example.com
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Production fallback URL (always HTTPS)
  static const String _productionBaseUrl = 'https://api.edusense.ai';

  /// Local development URLs:
  /// - Android Emulator: 10.0.2.2 maps to the Windows host machine's localhost
  /// - Desktop / iOS Simulator / Web: localhost
  static const String _androidEmulatorBaseUrl = 'http://10.0.2.2:5000';
  static const String _localhostBaseUrl = 'http://localhost:5000';

  /// Resolves the appropriate API base URL based on build mode and platform.
  static String get apiBaseUrl {
    // 1. Build-time environment override takes highest priority
    if (_envBaseUrl.isNotEmpty) {
      return _envBaseUrl;
    }

    // 2. Production builds must use secure HTTPS production endpoint
    if (kReleaseMode) {
      return _productionBaseUrl;
    }

    // 3. Debug/Development mode: resolve platform-specific host
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return _androidEmulatorBaseUrl;
    }

    return _localhostBaseUrl;
  }

  // Networking Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 25);
  static const Duration sendTimeout = Duration(seconds: 25);

  // Verified Backend API Endpoints (from Express server.express.js)
  static const String healthEndpoint = '/api/health';
  static const String readinessEndpoint = '/api/ready';
  static const String rootEndpoint = '/';

  // Verified Authentication Endpoints (routes/auth.js)
  static const String loginEndpoint = '/api/auth/login';
  static const String sendOtpEndpoint = '/api/auth/send-otp';
  static const String registerEndpoint = '/api/auth/register';
  static const String meEndpoint = '/api/auth/me';
  static const String forgotPasswordEndpoint = '/api/auth/forgot-password';
  static const String resetPasswordEndpoint = '/api/auth/reset-password';
  static const String changePasswordEndpoint = '/api/auth/change-password';

  // Verified Phase 3 Dashboard & Service Endpoints
  static const String subjectsEndpoint = '/api/subjects';
  static const String documentsEndpoint = '/api/documents';
  static const String adaptiveProfileEndpoint = '/api/adaptive/profile';
  static const String adaptiveRecommendationsEndpoint =
      '/api/adaptive/recommendations';
  static const String adaptivePreferencesEndpoint =
      '/api/adaptive/preferences';
  static const String adaptiveResetEndpoint = '/api/adaptive/reset';
  static const String adaptivePracticeQuizEndpoint =
      '/api/adaptive/practice-quiz';
  static const String feedbackEndpoint = '/api/feedback';
  static const String studentMeetingsEndpoint =
      '/api/meetings/student/bookings';
  static const String facultyBookingsEndpoint =
      '/api/meetings/faculty/bookings';
  static const String facultySlotsEndpoint = '/api/meetings/faculty/slots';
  static const String analyticsTelemetryEndpoint = '/api/analytics/telemetry';
  static const String analyticsRiskProfilesEndpoint =
      '/api/analytics/risk-profiles';
  static const String analyticsAuditLogsEndpoint = '/api/analytics/audit-logs';
  static const String usersEndpoint = '/api/users';

  // Verified Phase 4 RAG Chatbot, Conversations & Learning Endpoints
  static const String tutorAskEndpoint = '/api/tutor/ask';
  static const String tutorQueriesEndpoint = '/api/tutor/queries';
  static const String conversationsEndpoint = '/api/conversations';
  static const String quizzesEndpoint = '/api/quizzes';

  // Verified Phase 5 Meetings, Teams & Notification Endpoints
  static const String meetingsEndpoint = '/api/meetings';
  static const String meetingSlotsEndpoint = '/api/meetings/slots';
  static const String meetingBookingsEndpoint = '/api/meetings/bookings';
  static const String availableSlotsEndpoint = '/api/meetings/available-slots';
  static const String teamsStatusEndpoint = '/api/meetings/status';
  static const String eligibleStudentsEndpoint =
      '/api/meetings/students/eligible';
  static const String notificationsEndpoint = '/api/notifications';

  // Verified Phase 7 AI Faculty Real-Time Voice & Avatar Endpoints (routes/ai-faculty.js)
  static const String aiFacultyConfigEndpoint = '/api/ai-faculty/config';
  static const String aiFacultySubjectsEndpoint = '/api/ai-faculty/subjects';
  static const String aiFacultySessionEndpoint = '/api/ai-faculty/session';
  static const String aiFacultyTranscribeEndpoint = '/api/ai-faculty/transcribe';
  static const String aiFacultySynthesizeEndpoint = '/api/ai-faculty/synthesize';
  static const String aiFacultyInteractEndpoint = '/api/ai-faculty/interact';
  static const String aiFacultyTavusSessionEndpoint =
      '/api/ai-faculty/tavus/session';
  static const String aiFacultyTavusEndEndpoint = '/api/ai-faculty/tavus/end';
}
