import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/audit_log_model.dart';
import '../models/risk_profile_model.dart';
import '../models/telemetry_model.dart';
import '../models/user_model.dart';

/// Service managing institutional analytics, student risk tracking, audit logs, and user directory.
class AnalyticsService {
  final ApiClient _apiClient;

  AnalyticsService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Retrieves live institutional RAG telemetry & platform usage metrics.
  Future<TelemetryModel> getTelemetry() async {
    try {
      final response = await _apiClient.get(
        AppConfig.analyticsTelemetryEndpoint,
      );
      if (response.data is Map<String, dynamic>) {
        return TelemetryModel.fromJson(response.data as Map<String, dynamic>);
      }
      return const TelemetryModel();
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch institutional telemetry: $e');
    }
  }

  /// Retrieves computed student risk profiles from TopicMastery and Attempt data.
  Future<List<StudentRiskProfileModel>> getRiskProfiles({
    String? subjectId,
  }) async {
    try {
      final query = subjectId != null ? {'subjectId': subjectId} : null;
      final response = await _apiClient.get(
        AppConfig.analyticsRiskProfilesEndpoint,
        queryParameters: query,
      );

      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => StudentRiskProfileModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to compute student risk profiles: $e');
    }
  }

  /// Admin fetches recent security and creation audit logs.
  Future<List<AuditLogModel>> getAuditLogs() async {
    try {
      final response = await _apiClient.get(
        AppConfig.analyticsAuditLogsEndpoint,
      );
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => AuditLogModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch audit logs: $e');
    }
  }

  /// Admin/Faculty fetches registered user directory.
  Future<List<UserModel>> getUsers() async {
    try {
      final response = await _apiClient.get(AppConfig.usersEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => UserModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch registered users: $e');
    }
  }
}
