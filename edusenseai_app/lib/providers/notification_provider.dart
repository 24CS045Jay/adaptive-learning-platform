import 'package:flutter/foundation.dart';
import '../models/notification_model.dart';
import '../services/notification_service.dart';

/// State management for user notifications and unread badges.
class NotificationProvider extends ChangeNotifier {
  final NotificationService _notificationService;

  List<NotificationModel> _notifications = [];
  bool _isLoading = false;
  String? _errorMessage;

  NotificationProvider({NotificationService? notificationService})
    : _notificationService = notificationService ?? NotificationService();

  List<NotificationModel> get notifications =>
      List.unmodifiable(_notifications);
  int get unreadCount => _notifications.where((n) => !n.read).length;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Loads notifications for the current authenticated user.
  Future<void> loadNotifications({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      _notifications = await _notificationService.getNotifications();
    } catch (e) {
      _errorMessage = 'Failed to load notifications: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Marks an individual notification as read.
  Future<void> markAsRead(String id) async {
    try {
      final updated = await _notificationService.markAsRead(id);
      final index = _notifications.indexWhere((n) => n.id == id);
      if (index != -1) {
        _notifications[index] = updated;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[NotificationProvider] Error marking read: $e');
    }
  }

  /// Marks all notifications for this user as read.
  Future<void> markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      _notifications =
          _notifications.map((n) => n.copyWith(read: true)).toList();
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to mark all as read: $e';
      notifyListeners();
    }
  }
}
