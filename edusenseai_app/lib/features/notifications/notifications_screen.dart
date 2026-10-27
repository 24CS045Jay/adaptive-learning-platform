import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/notification_model.dart';
import '../../providers/notification_provider.dart';

/// Screen displaying user notifications, meeting updates, and read states.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notifProv = context.watch<NotificationProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppColors.primaryNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            const Text(
              'Notifications',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            if (notifProv.unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accentCyan,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${notifProv.unreadCount}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryNavy,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (notifProv.unreadCount > 0)
            TextButton(
              onPressed: () => notifProv.markAllAsRead(),
              child: const Text(
                'Mark All Read',
                style: TextStyle(
                  color: AppColors.accentCyan,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
      body:
          notifProv.isLoading && notifProv.notifications.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : notifProv.errorMessage != null &&
                  notifProv.notifications.isEmpty
              ? _buildErrorView(notifProv)
              : notifProv.notifications.isEmpty
              ? _buildEmptyView(notifProv)
              : RefreshIndicator(
                onRefresh: () => notifProv.loadNotifications(),
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  itemCount: notifProv.notifications.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, index) {
                    final item = notifProv.notifications[index];
                    return _buildNotificationCard(item, notifProv);
                  },
                ),
              ),
    );
  }

  Widget _buildEmptyView(NotificationProvider provider) {
    return RefreshIndicator(
      onRefresh: () => provider.loadNotifications(),
      child: ListView(
        padding: const EdgeInsets.all(32),
        children: const [
          SizedBox(height: 80),
          Center(
            child: Icon(
              Icons.notifications_none_rounded,
              size: 56,
              color: AppColors.slate300,
            ),
          ),
          SizedBox(height: 16),
          Center(
            child: Text(
              'No notifications yet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.deepSlate,
              ),
            ),
          ),
          SizedBox(height: 6),
          Center(
            child: Text(
              'Updates about scheduled sessions, approvals, and reminders will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: AppColors.slate500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView(NotificationProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: AppColors.slate400),
            const SizedBox(height: 12),
            Text(
              provider.errorMessage ?? 'Failed to load notifications.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.deepSlate),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => provider.loadNotifications(),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(
    NotificationModel item,
    NotificationProvider provider,
  ) {
    final timeStr = DateFormat(
      'MMM d, h:mm a',
    ).format(item.timestamp.toLocal());
    final isUnread = !item.read;

    IconData iconData = Icons.notifications_rounded;
    Color iconColor = AppColors.primary;
    if (item.title.contains('APPROVED') || item.title.contains('Approved')) {
      iconData = Icons.check_circle_rounded;
      iconColor = AppColors.success;
    } else if (item.title.contains('CANCELLED') ||
        item.title.contains('Cancelled') ||
        item.title.contains('REJECTED') ||
        item.title.contains('Rejected')) {
      iconData = Icons.cancel_rounded;
      iconColor = AppColors.error;
    } else if (item.title.contains('Invitation') ||
        item.title.contains('Session')) {
      iconData = Icons.videocam_rounded;
      iconColor = AppColors.secondary;
    }

    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color:
              isUnread
                  ? AppColors.primary.withValues(alpha: 0.3)
                  : AppColors.slate200,
          width: isUnread ? 1.5 : 1.0,
        ),
      ),
      color: isUnread ? const Color(0xFFF0F7FF) : Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (!item.read) {
            provider.markAsRead(item.id);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(iconData, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontWeight:
                                  isUnread ? FontWeight.w800 : FontWeight.w600,
                              color: AppColors.deepSlate,
                            ),
                          ),
                        ),
                        if (isUnread)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.message,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate600,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      timeStr,
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: AppColors.slate400,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
