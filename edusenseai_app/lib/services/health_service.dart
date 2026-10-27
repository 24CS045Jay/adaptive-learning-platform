import 'package:flutter/foundation.dart';
import '../core/config/app_config.dart';
import '../core/network/api_client.dart';
import '../models/health_response.dart';

/// Service responsible for verifying connectivity to the EduSense AI backend.
class HealthService {
  final ApiClient _client;

  HealthService({ApiClient? client}) : _client = client ?? ApiClient();

  /// Pings the verified Express `/api/health` route and measures round-trip latency.
  Future<HealthResponse> checkHealth() async {
    final stopwatch = Stopwatch()..start();
    try {
      final response = await _client.get(AppConfig.healthEndpoint);
      stopwatch.stop();

      if (response.data is Map<String, dynamic>) {
        return HealthResponse.fromJson(
          response.data as Map<String, dynamic>,
          responseTimeMs: stopwatch.elapsedMilliseconds,
        );
      }

      // If response is a string or fallback JSON
      return HealthResponse(
        status: response.statusCode == 200 ? 'ok' : 'error',
        service: 'EduSense AI Express API Gateway',
        responseTimeMs: stopwatch.elapsedMilliseconds,
      );
    } catch (e) {
      stopwatch.stop();
      debugPrint('[HealthService] Connectivity check notice: $e');
      rethrow;
    }
  }
}
