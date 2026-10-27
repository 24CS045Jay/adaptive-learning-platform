import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../models/eligible_student_model.dart';
import '../../models/meeting_model.dart';
import '../../models/meeting_slot_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/meeting_provider.dart';
import '../../providers/notification_provider.dart';
import '../notifications/notifications_screen.dart';
import 'faculty_schedule_slot_modal.dart';
import 'request_meeting_modal.dart';

/// Full-featured Faculty-Student Connect and Meeting Scheduling screen
/// supporting Student and Faculty/Admin roles, with Microsoft Teams integration.
typedef MeetingsScreen = MeetingsManagementScreen;

class MeetingsManagementScreen extends StatefulWidget {
  final int initialTabIndex;

  const MeetingsManagementScreen({super.key, this.initialTabIndex = 0});

  @override
  State<MeetingsManagementScreen> createState() =>
      _MeetingsManagementScreenState();
}

class _MeetingsManagementScreenState extends State<MeetingsManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedStatusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadData() {
    final user = context.read<AuthProvider>().user;
    final isFaculty =
        user?.role.toLowerCase() == 'faculty' ||
        user?.role.toLowerCase() == 'admin';

    final prov = context.read<MeetingProvider>();
    if (isFaculty) {
      prov.loadFacultyMeetings();
    } else {
      prov.loadStudentMeetings();
    }

    // Refresh notification badge
    context.read<NotificationProvider>().loadNotifications(silent: true);
  }

  Future<void> _launchMeetingUrl(String url) async {
    String resolved = url;
    if (resolved.startsWith('http://localhost:5000')) {
      resolved = resolved.replaceFirst(
        'http://localhost:5000',
        AppConfig.apiBaseUrl,
      );
    }
    final uri = Uri.tryParse(resolved);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not open Microsoft Teams link on this device.',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authUser = context.watch<AuthProvider>().user;
    final isFaculty =
        authUser?.role.toLowerCase() == 'faculty' ||
        authUser?.role.toLowerCase() == 'admin';
    final meetingProv = context.watch<MeetingProvider>();
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
        title: Text(
          isFaculty ? 'Faculty Meeting Hub' : 'Faculty Connect',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        actions: [
          // Notification Bell
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                tooltip: 'Notifications',
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const NotificationsScreen(),
                    ),
                  );
                },
              ),
              if (notifProv.unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 10,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.accentCyan,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '${notifProv.unreadCount}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryNavy,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accentCyan,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          labelStyle: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
          tabs:
              isFaculty
                  ? const [
                    Tab(
                      text: 'Student Requests',
                      icon: Icon(Icons.mark_email_unread_outlined, size: 18),
                    ),
                    Tab(
                      text: 'My Sessions',
                      icon: Icon(Icons.calendar_month_outlined, size: 18),
                    ),
                    Tab(
                      text: 'Eligible Students',
                      icon: Icon(Icons.group_outlined, size: 18),
                    ),
                  ]
                  : const [
                    Tab(
                      text: 'My Consultations',
                      icon: Icon(Icons.event_note_outlined, size: 18),
                    ),
                    Tab(
                      text: 'Office Hours',
                      icon: Icon(Icons.access_time_outlined, size: 18),
                    ),
                    Tab(
                      text: 'Faculty Directory',
                      icon: Icon(Icons.badge_outlined, size: 18),
                    ),
                  ],
        ),
      ),
      floatingActionButton:
          isFaculty
              ? FloatingActionButton.extended(
                backgroundColor: AppColors.primaryNavy,
                foregroundColor: AppColors.accentCyan,
                icon: const Icon(Icons.add_task_rounded),
                label: const Text(
                  'Schedule Session',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder:
                        (ctx) => FacultyScheduleSlotModal(
                          onSlotCreated:
                              () => meetingProv.loadFacultyMeetings(),
                        ),
                  );
                },
              )
              : FloatingActionButton.extended(
                backgroundColor: AppColors.primaryNavy,
                foregroundColor: AppColors.accentCyan,
                icon: const Icon(Icons.add_comment_rounded),
                label: const Text(
                  'Request Consultation',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder:
                        (ctx) => RequestMeetingModal(
                          availableSlots: meetingProv.availableSlots,
                          onRequestSubmitted:
                              () => meetingProv.loadStudentMeetings(),
                        ),
                  );
                },
              ),
      body: Column(
        children: [
          // Banner for Microsoft Teams Integration Status
          _buildTeamsStatusBanner(meetingProv),

          // Feedback snackbars / inline messages
          if (meetingProv.errorMessage != null)
            _buildStatusAlert(
              meetingProv.errorMessage!,
              isError: true,
              onDismiss: meetingProv.clearMessages,
            ),
          if (meetingProv.successMessage != null)
            _buildStatusAlert(
              meetingProv.successMessage!,
              isError: false,
              onDismiss: meetingProv.clearMessages,
            ),

          // Tab Body
          Expanded(
            child:
                meetingProv.isLoading &&
                        meetingProv.studentBookings.isEmpty &&
                        meetingProv.facultyBookings.isEmpty &&
                        meetingProv.facultySlots.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : isFaculty
                    ? TabBarView(
                      controller: _tabController,
                      children: [
                        _buildFacultyRequestsTab(meetingProv),
                        _buildFacultySlotsTab(meetingProv),
                        _buildFacultyEligibleStudentsTab(meetingProv),
                      ],
                    )
                    : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildStudentBookingsTab(meetingProv),
                        _buildStudentAvailableSlotsTab(meetingProv),
                        _buildStudentFacultyDirectoryTab(meetingProv),
                      ],
                    ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TEAMS STATUS BANNER
  // ===========================================================================
  Widget _buildTeamsStatusBanner(MeetingProvider prov) {
    final isConfigured = prov.isTeamsConfigured;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isConfigured ? const Color(0xFFEFF6FF) : const Color(0xFFFFFBEB),
        border: Border(
          bottom: BorderSide(
            color:
                isConfigured
                    ? const Color(0xFFBFDBFE)
                    : const Color(0xFFFDE68A),
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isConfigured ? Icons.verified_rounded : Icons.info_outline_rounded,
            size: 16,
            color:
                isConfigured
                    ? const Color(0xFF2563EB)
                    : const Color(0xFFD97706),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isConfigured
                  ? 'Microsoft Teams Live Integration: Online links generated automatically.'
                  : 'Microsoft Teams Direct Mode: Set tenant credentials in backend .env to enable auto-links.',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color:
                    isConfigured
                        ? const Color(0xFF1E40AF)
                        : const Color(0xFF92400E),
              ),
            ),
          ),
          TextButton(
            onPressed: () => _showTeamsDiagnosticDialog(prov.teamsStatus),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Info',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color:
                    isConfigured
                        ? const Color(0xFF2563EB)
                        : const Color(0xFFB45309),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showTeamsDiagnosticDialog(Map<String, dynamic> status) {
    showDialog(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.video_call_rounded, color: Color(0xFF4F46E5)),
                SizedBox(width: 8),
                Text(
                  'Microsoft Teams Status',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Configuration: ${status["isConfigured"] == true ? "Configured & Active" : "Pending Credentials"}',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color:
                        status["isConfigured"] == true
                            ? AppColors.success
                            : AppColors.warning,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'EduSense AI backend securely interacts with Microsoft Graph API using application credentials:\n'
                  '• MICROSOFT_TENANT_ID\n'
                  '• MICROSOFT_CLIENT_ID\n'
                  '• MICROSOFT_CLIENT_SECRET\n'
                  '• MICROSOFT_ORGANIZER_USER_ID',
                  style: TextStyle(fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 10),
                Text(
                  'Status Message: ${status["message"] ?? "Real-time communication ready."}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontStyle: FontStyle.italic,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Close'),
              ),
            ],
          ),
    );
  }

  Widget _buildStatusAlert(
    String message, {
    required bool isError,
    required VoidCallback onDismiss,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isError ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isError ? const Color(0xFFFECACA) : const Color(0xFFBBF7D0),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            size: 16,
            color: isError ? AppColors.error : AppColors.success,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                color: isError ? AppColors.error : AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 16),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onDismiss,
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // STUDENT TABS
  // ===========================================================================

  // Tab 0: Student Consultations & Bookings
  Widget _buildStudentBookingsTab(MeetingProvider prov) {
    var bookings = prov.studentBookings;
    if (_selectedStatusFilter != 'all') {
      bookings =
          bookings.where((b) => b.status == _selectedStatusFilter).toList();
    }

    return Column(
      children: [
        _buildFilterChips(
          options: const ['all', 'requested', 'approved', 'rejected'],
          selected: _selectedStatusFilter,
          onSelected: (val) => setState(() => _selectedStatusFilter = val),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => prov.loadStudentMeetings(),
            child:
                bookings.isEmpty
                    ? _buildEmptyState(
                      title: 'No Consultation Bookings',
                      subtitle:
                          _selectedStatusFilter == 'all'
                              ? 'You have not requested any faculty appointments yet. Tap "Request Consultation" below.'
                              : 'No bookings matching the "$_selectedStatusFilter" filter.',
                    )
                    : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                      itemCount: bookings.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (ctx, i) {
                        return _buildStudentBookingCard(bookings[i], prov);
                      },
                    ),
          ),
        ),
      ],
    );
  }

  Widget _buildStudentBookingCard(
    MeetingBookingModel booking,
    MeetingProvider prov,
  ) {
    final isApproved = booking.isApproved;
    final isRequested = booking.isRequested;
    final isCancelled = booking.isCancelled;
    final dateStr =
        booking.startTime != null
            ? DateFormat(
              'EEE, MMM d, y • h:mm a',
            ).format(booking.startTime!.toLocal())
            : 'Pending Faculty Scheduling';

    Color statusColor = AppColors.warning;
    if (isApproved) {
      statusColor = AppColors.success;
    } else if (booking.isRejected || isCancelled) {
      statusColor = AppColors.error;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color:
              isApproved ? AppColors.success.withAlpha(60) : AppColors.divider,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  booking.topic,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  booking.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(
                Icons.person_pin_circle_outlined,
                size: 14,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Faculty: ${booking.facultyName} • ${booking.subjectCode}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(
                Icons.access_time_rounded,
                size: 14,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Text(
                dateStr,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          if (booking.doubtDescription.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Doubt: "${booking.doubtDescription}"',
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: Color(0xFF334155),
                ),
              ),
            ),
          ],
          if (booking.rejectionReason != null &&
              booking.rejectionReason!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Reason for rejection: ${booking.rejectionReason}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (booking.facultyNotes != null &&
              booking.facultyNotes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Faculty Note: ${booking.facultyNotes}',
              style: const TextStyle(fontSize: 12, color: AppColors.navy),
            ),
          ],

          const SizedBox(height: 12),
          // Action Buttons
          Row(
            children: [
              if (isApproved &&
                  booking.teamsJoinUrl != null &&
                  booking.teamsJoinUrl!.isNotEmpty)
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _launchMeetingUrl(booking.teamsJoinUrl!),
                    icon: const Icon(Icons.videocam_rounded, size: 16),
                    label: const Text('Join Teams Meeting'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              if (isRequested) ...[
                OutlinedButton.icon(
                  onPressed:
                      prov.isSubmitting
                          ? null
                          : () =>
                              _confirmCancelStudentBooking(booking.id, prov),
                  icon: const Icon(
                    Icons.cancel_outlined,
                    size: 16,
                    color: AppColors.error,
                  ),
                  label: const Text(
                    'Cancel Request',
                    style: TextStyle(color: AppColors.error),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.error),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  void _confirmCancelStudentBooking(String bookingId, MeetingProvider prov) {
    showDialog(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Cancel Consultation Request'),
            content: const Text(
              'Are you sure you want to cancel this consultation request? Your faculty member will be notified.',
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Keep Booking'),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.of(ctx).pop();
                  await prov.cancelStudentBooking(
                    bookingId,
                    reason: 'Cancelled by student from mobile app.',
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Confirm Cancel'),
              ),
            ],
          ),
    );
  }

  // Tab 1: Student Available Slots (Open Office Hours)
  Widget _buildStudentAvailableSlotsTab(MeetingProvider prov) {
    final slots = prov.availableSlots;
    return RefreshIndicator(
      onRefresh: () => prov.loadStudentMeetings(),
      child:
          slots.isEmpty
              ? _buildEmptyState(
                title: 'No Open Office Hours',
                subtitle:
                    'Faculty members have not posted upcoming open slots at the moment. Please check back later or submit a consultation inquiry.',
              )
              : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
                itemCount: slots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, i) {
                  final slot = slots[i];
                  return _buildAvailableSlotCard(slot, prov);
                },
              ),
    );
  }

  Widget _buildAvailableSlotCard(MeetingSlotModel slot, MeetingProvider prov) {
    final isFull = slot.isFull;
    final dateStr = DateFormat(
      'EEE, MMM d, y',
    ).format(slot.startTime.toLocal());
    final timeStr =
        '${DateFormat("h:mm a").format(slot.startTime.toLocal())} – ${DateFormat("h:mm a").format(slot.endTime.toLocal())}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isFull ? AppColors.divider : const Color(0xFFBAE6FD),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  slot.topic,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color:
                      isFull
                          ? AppColors.error.withAlpha(20)
                          : AppColors.success.withAlpha(20),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isFull
                      ? 'FULLY BOOKED'
                      : '${slot.capacity - slot.bookedCount} SLOTS OPEN',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isFull ? AppColors.error : AppColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Prof. ${slot.facultyName} • ${slot.subjectCode}',
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$dateStr • $timeStr (${slot.durationMinutes} mins)',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          if (slot.description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              slot.description,
              style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed:
                  isFull
                      ? null
                      : () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder:
                              (ctx) => RequestMeetingModal(
                                preselectedSlotId: slot.id,
                                availableSlots: prov.availableSlots,
                                onRequestSubmitted:
                                    () => prov.loadStudentMeetings(),
                              ),
                        );
                      },
              icon: const Icon(Icons.bookmark_add_rounded, size: 16),
              label: Text(
                isFull ? 'Slot Full' : 'Book One-on-One Session',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryNavy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Tab 2: Student Assigned Faculty Directory
  Widget _buildStudentFacultyDirectoryTab(MeetingProvider prov) {
    // Unique faculty from available slots or booked sessions
    final Map<String, String> facultyMap = {};
    for (final s in prov.availableSlots) {
      facultyMap[s.facultyName] =
          '${s.subjectCode} (${s.subjectName}) • ${s.facultyEmail}';
    }
    for (final b in prov.studentBookings) {
      facultyMap[b.facultyName] = '${b.subjectCode} (${b.subjectName})';
    }

    if (facultyMap.isEmpty) {
      return _buildEmptyState(
        title: 'Faculty Directory Loading',
        subtitle:
            'Subject faculty profiles synchronize with your enrolled courses. Check back shortly.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
      itemCount: facultyMap.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final facultyName = facultyMap.keys.elementAt(i);
        final details = facultyMap[facultyName]!;

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.divider),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.softBlue,
                child: Text(
                  facultyName.isNotEmpty ? facultyName[0] : 'F',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      facultyName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      details,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(
                  Icons.send_rounded,
                  color: AppColors.primaryNavy,
                ),
                tooltip: 'Request Consultation',
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder:
                        (ctx) => RequestMeetingModal(
                          availableSlots: prov.availableSlots,
                          onRequestSubmitted: () => prov.loadStudentMeetings(),
                        ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  // ===========================================================================
  // FACULTY TABS
  // ===========================================================================

  // Tab 0: Faculty Student Requests
  Widget _buildFacultyRequestsTab(MeetingProvider prov) {
    var bookings = prov.facultyBookings;
    if (_selectedStatusFilter != 'all') {
      bookings =
          bookings.where((b) => b.status == _selectedStatusFilter).toList();
    }

    return Column(
      children: [
        _buildFilterChips(
          options: const ['all', 'requested', 'approved', 'rejected'],
          selected: _selectedStatusFilter,
          onSelected: (val) => setState(() => _selectedStatusFilter = val),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => prov.loadFacultyMeetings(),
            child:
                bookings.isEmpty
                    ? _buildEmptyState(
                      title: 'No Consultation Requests',
                      subtitle:
                          _selectedStatusFilter == 'all'
                              ? 'No incoming student requests yet. Open slots published by you will appear here once booked.'
                              : 'No requests matching the "$_selectedStatusFilter" status.',
                    )
                    : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                      itemCount: bookings.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (ctx, i) {
                        return _buildFacultyBookingCard(bookings[i], prov);
                      },
                    ),
          ),
        ),
      ],
    );
  }

  Widget _buildFacultyBookingCard(
    MeetingBookingModel booking,
    MeetingProvider prov,
  ) {
    final isRequested = booking.isRequested;
    final isApproved = booking.isApproved;
    final dateStr =
        booking.startTime != null
            ? DateFormat(
              'EEE, MMM d • h:mm a',
            ).format(booking.startTime!.toLocal())
            : 'Unscheduled';

    Color statusColor = AppColors.warning;
    if (isApproved) {
      statusColor = AppColors.success;
    } else if (booking.isRejected || booking.isCancelled) {
      statusColor = AppColors.error;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color:
              isRequested ? AppColors.warning.withAlpha(60) : AppColors.divider,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  booking.topic,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  booking.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${booking.studentName} (${booking.studentEmail}) • $dateStr',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          if (booking.doubtDescription.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Student Doubt: "${booking.doubtDescription}"',
                style: const TextStyle(
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  color: Color(0xFF334155),
                ),
              ),
            ),
          ],
          if (isApproved &&
              booking.teamsJoinUrl != null &&
              booking.teamsJoinUrl!.isNotEmpty) ...[
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () => _launchMeetingUrl(booking.teamsJoinUrl!),
              icon: const Icon(Icons.videocam_rounded, size: 16),
              label: const Text('Start Microsoft Teams Session'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4F46E5),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
          if (isRequested) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed:
                        prov.isSubmitting
                            ? null
                            : () => _approveBookingWithTeams(booking.id, prov),
                    icon: const Icon(Icons.check_circle_rounded, size: 16),
                    label: const Text('Approve (Teams)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed:
                      prov.isSubmitting
                          ? null
                          : () => _showRejectBookingDialog(booking.id, prov),
                  icon: const Icon(
                    Icons.cancel_outlined,
                    size: 16,
                    color: AppColors.error,
                  ),
                  label: const Text(
                    'Reject',
                    style: TextStyle(color: AppColors.error),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.error),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _approveBookingWithTeams(
    String bookingId,
    MeetingProvider prov,
  ) async {
    await prov.updateFacultyBookingStatus(bookingId, 'approved');
  }

  void _showRejectBookingDialog(String bookingId, MeetingProvider prov) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Reject Consultation Request'),
            content: TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason for rejection (optional)',
                hintText:
                    'e.g. Schedule conflict, please book alternative slot',
              ),
              maxLines: 2,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.of(ctx).pop();
                  await prov.updateFacultyBookingStatus(
                    bookingId,
                    'rejected',
                    rejectionReason: reasonController.text.trim(),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Reject Request'),
              ),
            ],
          ),
    );
  }

  // Tab 1: Faculty Scheduled Sessions & Office Hours
  Widget _buildFacultySlotsTab(MeetingProvider prov) {
    final slots = prov.facultySlots;
    return RefreshIndicator(
      onRefresh: () => prov.loadFacultyMeetings(),
      child:
          slots.isEmpty
              ? _buildEmptyState(
                title: 'No Sessions Scheduled',
                subtitle:
                    'Publish office hour slots or group lectures using the "Schedule Session" button.',
              )
              : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
                itemCount: slots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, i) {
                  final slot = slots[i];
                  return _buildFacultySlotCard(slot, prov);
                },
              ),
    );
  }

  Widget _buildFacultySlotCard(MeetingSlotModel slot, MeetingProvider prov) {
    final isCancelled = slot.isCancelled;
    final dateStr = DateFormat(
      'EEE, MMM d, y',
    ).format(slot.startTime.toLocal());
    final timeStr =
        '${DateFormat("h:mm a").format(slot.startTime.toLocal())} – ${DateFormat("h:mm a").format(slot.endTime.toLocal())}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isCancelled ? AppColors.divider : const Color(0xFFC7D2FE),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  slot.topic,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color:
                      isCancelled
                          ? AppColors.error.withAlpha(20)
                          : AppColors.success.withAlpha(20),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  slot.status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isCancelled ? AppColors.error : AppColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${slot.subjectCode} • Audience: ${slot.audienceType.toUpperCase()}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$dateStr • $timeStr (${slot.durationMinutes} mins)',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Capacity: ${slot.bookedCount} / ${slot.capacity} booked',
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.navy,
            ),
          ),
          if (slot.teamsJoinUrl != null && slot.teamsJoinUrl!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _launchMeetingUrl(slot.teamsJoinUrl!),
                    icon: const Icon(Icons.videocam_rounded, size: 16),
                    label: const Text('Open Teams Meeting'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (!isCancelled) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed:
                    prov.isSubmitting
                        ? null
                        : () => _confirmCancelFacultySlot(slot.id, prov),
                icon: const Icon(Icons.cancel_outlined, size: 14),
                label: const Text('Cancel Slot'),
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _confirmCancelFacultySlot(String slotId, MeetingProvider prov) {
    showDialog(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Cancel Office Hour Slot'),
            content: const Text(
              'Are you sure you want to cancel this slot? Any booked students will be notified.',
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Keep Slot'),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.of(ctx).pop();
                  await prov.cancelFacultySlot(
                    slotId,
                    reason: 'Cancelled by faculty member.',
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Confirm Cancel'),
              ),
            ],
          ),
    );
  }

  // Tab 2: Faculty Eligible Students Directory
  Widget _buildFacultyEligibleStudentsTab(MeetingProvider prov) {
    final students = prov.eligibleStudents;
    return RefreshIndicator(
      onRefresh: () => prov.loadFacultyMeetings(),
      child:
          students.isEmpty
              ? _buildEmptyState(
                title: 'No Eligible Students Found',
                subtitle:
                    'Students enrolled in your assigned subjects will be listed here for targeted meeting invitations.',
              )
              : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
                itemCount: students.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final student = students[i];
                  return _buildEligibleStudentTile(student);
                },
              ),
    );
  }

  Widget _buildEligibleStudentTile(EligibleStudentModel student) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppColors.softBlue,
            child: Text(
              student.name.isNotEmpty ? student.name[0] : 'S',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.primaryNavy,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${student.email} • ${student.enrollmentNumber}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  '${student.department} • Semester ${student.semester}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // COMMON HELPER WIDGETS
  // ===========================================================================
  Widget _buildFilterChips({
    required List<String> options,
    required String selected,
    required ValueChanged<String> onSelected,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children:
              options.map((opt) {
                final isSelected = selected == opt;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Text(
                      opt.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color:
                            isSelected ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: AppColors.primaryNavy,
                    backgroundColor: Colors.white,
                    side: BorderSide(
                      color:
                          isSelected
                              ? AppColors.primaryNavy
                              : AppColors.divider,
                    ),
                    onSelected: (_) => onSelected(opt),
                  ),
                );
              }).toList(),
        ),
      ),
    );
  }

  Widget _buildEmptyState({required String title, required String subtitle}) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.event_available_outlined,
              size: 56,
              color: AppColors.textSecondary,
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
