import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';
import '../models/health_response.dart';
import '../services/health_service.dart';

enum ConnectivityStatus { initial, checking, connected, error }

/// State provider managing backend connectivity and health diagnostics.
class ConnectivityProvider extends ChangeNotifier {
  final HealthService _healthService;
  final ApiClient _apiClient;

  ConnectivityStatus _status = ConnectivityStatus.initial;
  HealthResponse? _health;
  String? _errorMessage;

  ConnectivityProvider({HealthService? healthService, ApiClient? apiClient})
    : _healthService = healthService ?? HealthService(),
      _apiClient = apiClient ?? ApiClient();

  ConnectivityStatus get status => _status;
  HealthResponse? get health => _health;
  String? get errorMessage => _errorMessage;
  String get activeBaseUrl => _apiClient.baseUrl;

  bool get isChecking => _status == ConnectivityStatus.checking;
  bool get isConnected => _status == ConnectivityStatus.connected;
  bool get hasError => _status == ConnectivityStatus.error;

  /// Pings the EduSense AI backend and updates reactive state.
  Future<void> checkConnectivity() async {
    _status = ConnectivityStatus.checking;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _healthService.checkHealth();
      _health = result;
      _status =
          result.isHealthy
              ? ConnectivityStatus.connected
              : ConnectivityStatus.error;
      if (!result.isHealthy) {
        _errorMessage = 'Backend reported status: ${result.status}';
      }
    } catch (e) {
      _health = null;
      _status = ConnectivityStatus.error;
      _errorMessage = e.toString();
    } finally {
      notifyListeners();
    }
  }

  /// Allows updating the base URL dynamically (e.g. for testing with physical phone IP).
  void setBaseUrl(String newBaseUrl) {
    _apiClient.updateBaseUrl(newBaseUrl);
    checkConnectivity();
  }
}
