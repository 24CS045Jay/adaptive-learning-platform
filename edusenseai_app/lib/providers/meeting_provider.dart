import 'package:flutter/foundation.dart';
import '../models/eligible_student_model.dart';
import '../models/meeting_model.dart';
import '../models/meeting_slot_model.dart';
import '../services/meeting_service.dart';
import '../services/session_cleanup_service.dart';

/// State management for faculty-student connect, office hour slots,
/// consultation booking requests, and Teams meeting links.
class MeetingProvider extends ChangeNotifier {
  final MeetingService _meetingService;

  List<MeetingBookingModel> _studentBookings = [];
  List<MeetingSlotModel> _availableSlots = [];
  List<MeetingBookingModel> _facultyBookings = [];
  List<MeetingSlotModel> _facultySlots = [];
  List<EligibleStudentModel> _eligibleStudents = [];
  Map<String, dynamic> _teamsStatus = {};

  bool _isLoading = false;
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _successMessage;
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  MeetingProvider({MeetingService? meetingService})
    : _meetingService = meetingService ?? MeetingService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all in-memory meeting bookings and slots upon sign-out
  void clearSessionData() {
    _studentBookings = [];
    _availableSlots = [];
    _facultyBookings = [];
    _facultySlots = [];
    _eligibleStudents = [];
    _teamsStatus = {};
    _errorMessage = null;
    _successMessage = null;
    if (!_disposed && hasListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    SessionCleanupService().unregisterHandler(_cleanupHandler);
    super.dispose();
  }

  // Getters
  List<MeetingBookingModel> get studentBookings =>
      List.unmodifiable(_studentBookings);
  List<MeetingSlotModel> get availableSlots =>
      List.unmodifiable(_availableSlots);
  List<MeetingBookingModel> get facultyBookings =>
      List.unmodifiable(_facultyBookings);
  List<MeetingSlotModel> get facultySlots => List.unmodifiable(_facultySlots);
  List<EligibleStudentModel> get eligibleStudents =>
      List.unmodifiable(_eligibleStudents);
  Map<String, dynamic> get teamsStatus => _teamsStatus;
  bool get isTeamsConfigured => _teamsStatus['isConfigured'] == true;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;

  void clearMessages() {
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();
  }

  /// Loads student's booked consultations and open office hour slots.
  Future<void> loadStudentMeetings({String? subjectCode}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _meetingService.getStudentBookings(),
        _meetingService.getAvailableSlots(subjectCode: subjectCode),
        _meetingService.getTeamsStatus(),
      ]);

      _studentBookings = results[0] as List<MeetingBookingModel>;
      _availableSlots = results[1] as List<MeetingSlotModel>;
      _teamsStatus = results[2] as Map<String, dynamic>;
    } catch (e) {
      _errorMessage = 'Failed to load meetings: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Loads faculty's incoming booking requests, scheduled slots, and eligible students.
  Future<void> loadFacultyMeetings() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _meetingService.getFacultyBookings(),
        _meetingService.getFacultySlots(),
        _meetingService.getEligibleStudents(),
        _meetingService.getTeamsStatus(),
      ]);

      _facultyBookings = results[0] as List<MeetingBookingModel>;
      _facultySlots = results[1] as List<MeetingSlotModel>;
      _eligibleStudents = results[2] as List<EligibleStudentModel>;
      _teamsStatus = results[3] as Map<String, dynamic>;
    } catch (e) {
      _errorMessage = 'Failed to load faculty sessions: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Student submits a doubt session request for an open faculty slot.
  Future<bool> requestMeeting({
    required String slotId,
    required String topic,
    String? doubtDescription,
    String? meetingType,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final booking = await _meetingService.bookMeetingSlot(
        slotId: slotId,
        topic: topic,
        doubtDescription: doubtDescription,
        meetingType: meetingType,
      );

      _studentBookings.insert(0, booking);
      _successMessage =
          'Meeting request submitted successfully! Awaiting faculty approval.';

      // Refresh slot counts
      final slotIndex = _availableSlots.indexWhere((s) => s.id == slotId);
      if (slotIndex != -1) {
        final s = _availableSlots[slotIndex];
        _availableSlots[slotIndex] = MeetingSlotModel(
          id: s.id,
          facultyId: s.facultyId,
          facultyName: s.facultyName,
          facultyEmail: s.facultyEmail,
          departmentId: s.departmentId,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          subjectId: s.subjectId,
          topic: s.topic,
          description: s.description,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes,
          capacity: s.capacity,
          bookedCount: s.bookedCount + 1,
          locationType: s.locationType,
          audienceType: s.audienceType,
          invitedStudentIds: s.invitedStudentIds,
          teamsMeetingId: s.teamsMeetingId,
          teamsJoinUrl: s.teamsJoinUrl,
          status: s.status,
          notes: s.notes,
        );
      }

      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  /// Student cancels their consultation booking.
  Future<bool> cancelStudentBooking(String bookingId, {String? reason}) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updated = await _meetingService.studentCancelBooking(
        bookingId,
        reason: reason,
      );
      final index = _studentBookings.indexWhere((b) => b.id == bookingId);
      if (index != -1) {
        _studentBookings[index] = updated;
      }
      _successMessage = 'Meeting request cancelled.';
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to cancel meeting: $e';
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  /// Faculty updates student booking status (approve, reject, etc.).
  Future<bool> updateFacultyBookingStatus(
    String bookingId,
    String status, {
    String? facultyNotes,
    String? rejectionReason,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updated = await _meetingService.updateBookingStatus(
        bookingId,
        status,
        facultyNotes: facultyNotes,
        rejectionReason: rejectionReason,
      );

      final index = _facultyBookings.indexWhere((b) => b.id == bookingId);
      if (index != -1) {
        _facultyBookings[index] = updated;
      }

      _successMessage =
          status == 'approved'
              ? 'Meeting approved! Microsoft Teams link created.'
              : 'Booking updated to $status.';

      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to update meeting: $e';
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  /// Faculty publishes a new office hour slot or direct Teams session.
  Future<bool> scheduleFacultySlot({
    required String topic,
    String? subjectCode,
    String? subjectName,
    String? subjectId,
    String? description,
    required DateTime startTime,
    required DateTime endTime,
    int? capacity,
    String? audienceType,
    List<String>? invitedStudentIds,
    bool createTeamsMeeting = false,
    String? notes,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final slot = await _meetingService.createFacultySlot(
        topic: topic,
        subjectCode: subjectCode,
        subjectName: subjectName,
        subjectId: subjectId,
        description: description,
        startTime: startTime,
        endTime: endTime,
        capacity: capacity,
        audienceType: audienceType,
        invitedStudentIds: invitedStudentIds,
        createTeamsMeeting: createTeamsMeeting,
        notes: notes,
      );

      _facultySlots.insert(0, slot);
      _successMessage =
          createTeamsMeeting
              ? 'Session published with live Microsoft Teams meeting!'
              : 'Office hour slot published successfully.';

      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  /// Faculty cancels a meeting slot.
  Future<bool> cancelFacultySlot(String slotId, {String? reason}) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _meetingService.cancelFacultySlot(slotId, reason: reason);
      final index = _facultySlots.indexWhere((s) => s.id == slotId);
      if (index != -1) {
        final s = _facultySlots[index];
        _facultySlots[index] = MeetingSlotModel(
          id: s.id,
          facultyId: s.facultyId,
          facultyName: s.facultyName,
          facultyEmail: s.facultyEmail,
          departmentId: s.departmentId,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          subjectId: s.subjectId,
          topic: s.topic,
          description: s.description,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes,
          capacity: s.capacity,
          bookedCount: s.bookedCount,
          locationType: s.locationType,
          audienceType: s.audienceType,
          invitedStudentIds: s.invitedStudentIds,
          teamsMeetingId: s.teamsMeetingId,
          teamsJoinUrl: s.teamsJoinUrl,
          status: 'cancelled',
          notes: s.notes,
        );
      }
      _successMessage = 'Session slot cancelled.';
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Failed to cancel slot: $e';
      notifyListeners();
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }
}
