import 'package:flutter/foundation.dart';

/// Callback signature for wiping in-memory state on logout or session expiration.
typedef LogoutCleanupHandler = Future<void> Function();

/// Centralized registry for clearing in-memory cached state across all providers
/// upon user logout or session expiration, preventing cross-student/faculty data leakage.
class SessionCleanupService {
  static final SessionCleanupService _instance = SessionCleanupService._internal();
  factory SessionCleanupService() => _instance;
  SessionCleanupService._internal();

  final List<LogoutCleanupHandler> _handlers = [];

  /// Registers a provider cleanup routine to be triggered on session termination.
  void registerHandler(LogoutCleanupHandler handler) {
    if (!_handlers.contains(handler)) {
      _handlers.add(handler);
    }
  }

  /// Unregisters a provider cleanup routine if disposed.
  void unregisterHandler(LogoutCleanupHandler handler) {
    _handlers.remove(handler);
  }

  /// Executes all registered cleanup routines sequentially and safely.
  Future<void> executeAllCleanups() async {
    for (final handler in List<LogoutCleanupHandler>.from(_handlers)) {
      try {
        await handler();
      } catch (e) {
        debugPrint('[SessionCleanupService] Handler cleanup error: $e');
      }
    }
  }

  @visibleForTesting
  int get registeredHandlerCount => _handlers.length;

  @visibleForTesting
  void clearHandlersForTesting() {
    _handlers.clear();
  }
}
