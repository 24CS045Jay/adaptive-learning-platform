import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/notification_model.dart';

/// Service managing user notifications and read states.
class NotificationService {
  final ApiClient _apiClient;

  NotificationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Retrieves notifications for the authenticated user.
  Future<List<NotificationModel>> getNotifications() async {
    try {
      final response = await _apiClient.get(AppConfig.notificationsEndpoint);
      dynamic raw = response.data;
      if (raw is Map && raw['data'] is List) {
        raw = raw['data'];
      }
      if (raw is List) {
        return raw
            .whereType<Map<String, dynamic>>()
            .map((json) => NotificationModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch notifications: $e');
    }
  }

  /// Marks a specific notification as read.
  Future<NotificationModel> markAsRead(String id) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.notificationsEndpoint}/$id/read',
      );
      dynamic raw = response.data;
      if (raw is Map && raw['data'] is Map) {
        raw = raw['data'];
      }
      if (raw is Map<String, dynamic>) {
        return NotificationModel.fromJson(raw);
      }
      throw AppException('Invalid response marking notification read.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to mark notification as read: $e');
    }
  }

  /// Marks all unread notifications as read.
  Future<void> markAllAsRead() async {
    try {
      await _apiClient.patch(
        '${AppConfig.notificationsEndpoint}/read-all/read',
      );
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to mark all notifications as read: $e');
    }
  }
}
