import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/eligible_student_model.dart';
import '../models/meeting_model.dart';
import '../models/meeting_slot_model.dart';

/// Comprehensive service managing meetings, Microsoft Teams online sessions,
/// student requests, and office hour slot scheduling.
class MeetingService {
  final ApiClient _apiClient;

  MeetingService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Student views their booked doubt sessions and Teams join links.
  Future<List<MeetingBookingModel>> getStudentBookings() async {
    try {
      final response = await _apiClient.get(AppConfig.studentMeetingsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => MeetingBookingModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch scheduled doubt sessions: $e');
    }
  }

  /// Student browses open faculty office hours and session slots.
  Future<List<MeetingSlotModel>> getAvailableSlots({
    String? subjectCode,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        if (subjectCode != null && subjectCode.isNotEmpty)
          'subjectCode': subjectCode,
      };

      final response = await _apiClient.get(
        AppConfig.availableSlotsEndpoint,
        queryParameters: queryParams.isEmpty ? null : queryParams,
      );

      dynamic raw = response.data;
      if (raw is Map && raw['data'] is List) {
        raw = raw['data'];
      }
      if (raw is List) {
        return raw
            .whereType<Map<String, dynamic>>()
            .map((json) => MeetingSlotModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch available office hour slots: $e');
    }
  }

  /// Student requests a doubt session booking for an active slot.
  Future<MeetingBookingModel> bookMeetingSlot({
    required String slotId,
    required String topic,
    String? doubtDescription,
    String? meetingType,
    String? idempotencyKey,
  }) async {
    try {
      final payload = <String, dynamic>{
        'slotId': slotId,
        'topic': topic.trim(),
        if (doubtDescription != null)
          'doubtDescription': doubtDescription.trim(),
        if (meetingType != null) 'meetingType': meetingType,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      };

      final response = await _apiClient.post(
        AppConfig.meetingBookingsEndpoint,
        data: payload,
      );

      dynamic raw = response.data;
      if (raw is Map) {
        final bMap = raw['booking'] ?? raw['data'] ?? raw;
        if (bMap is Map<String, dynamic>) {
          return MeetingBookingModel.fromJson(bMap);
        }
      }
      throw AppException('Invalid booking response received from server.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to submit meeting request: $e');
    }
  }

  /// Student cancels their own meeting request or confirmed consultation.
  Future<MeetingBookingModel> studentCancelBooking(
    String bookingId, {
    String? reason,
  }) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.meetingsEndpoint}/bookings/$bookingId/student-cancel',
        data: {'reason': reason ?? 'Cancelled by student via mobile'},
      );

      dynamic raw = response.data;
      if (raw is Map) {
        final bMap = raw['booking'] ?? raw['data'] ?? raw;
        if (bMap is Map<String, dynamic>) {
          return MeetingBookingModel.fromJson(bMap);
        }
      }
      throw AppException('Invalid cancellation response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to cancel meeting request: $e');
    }
  }

  /// Faculty views booking requests and confirmed consultations.
  Future<List<MeetingBookingModel>> getFacultyBookings() async {
    try {
      final response = await _apiClient.get(AppConfig.facultyBookingsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => MeetingBookingModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch faculty appointments: $e');
    }
  }

  /// Faculty views their created slots and office hours.
  Future<List<MeetingSlotModel>> getFacultySlots() async {
    try {
      final response = await _apiClient.get(AppConfig.facultySlotsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => MeetingSlotModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch faculty slots: $e');
    }
  }

  /// Faculty creates an office hour slot or direct Microsoft Teams session.
  Future<MeetingSlotModel> createFacultySlot({
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
    try {
      final payload = <String, dynamic>{
        'topic': topic.trim(),
        if (subjectCode != null) 'subjectCode': subjectCode,
        if (subjectName != null) 'subjectName': subjectName,
        if (subjectId != null) 'subjectId': subjectId,
        if (description != null) 'description': description.trim(),
        'startTime': startTime.toIso8601String(),
        'endTime': endTime.toIso8601String(),
        'capacity': capacity ?? 1,
        'audienceType': audienceType ?? 'department',
        if (invitedStudentIds != null) 'invitedStudentIds': invitedStudentIds,
        'createTeamsMeeting': createTeamsMeeting,
        if (notes != null) 'notes': notes.trim(),
      };

      final response = await _apiClient.post(
        AppConfig.meetingSlotsEndpoint,
        data: payload,
      );

      dynamic raw = response.data;
      if (raw is Map) {
        final sMap = raw['slot'] ?? raw['data'] ?? raw;
        if (sMap is Map<String, dynamic>) {
          return MeetingSlotModel.fromJson(sMap);
        }
      }
      throw AppException('Failed to parse created slot payload.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to schedule session slot: $e');
    }
  }

  /// Faculty cancels an entire slot/session.
  Future<void> cancelFacultySlot(String slotId, {String? reason}) async {
    try {
      await _apiClient.patch(
        '${AppConfig.meetingSlotsEndpoint}/$slotId/cancel',
        data: {'reason': reason ?? 'Cancelled by faculty'},
      );
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to cancel session: $e');
    }
  }

  /// Faculty approves, rejects, or completes a student booking.
  Future<MeetingBookingModel> updateBookingStatus(
    String bookingId,
    String status, {
    String? facultyNotes,
    String? rejectionReason,
  }) async {
    try {
      final payload = <String, dynamic>{
        'status': status,
        if (facultyNotes != null) 'facultyNotes': facultyNotes,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
      };

      final response = await _apiClient.patch(
        '${AppConfig.meetingsEndpoint}/bookings/$bookingId/status',
        data: payload,
      );

      dynamic raw = response.data;
      if (raw is Map) {
        final bMap = raw['booking'] ?? raw['data'] ?? raw;
        if (bMap is Map<String, dynamic>) {
          return MeetingBookingModel.fromJson(bMap);
        }
      }
      throw AppException('Invalid status update response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to update booking status: $e');
    }
  }

  /// Faculty fetches eligible students in department for targeted invites.
  Future<List<EligibleStudentModel>> getEligibleStudents() async {
    try {
      final response = await _apiClient.get(AppConfig.eligibleStudentsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => EligibleStudentModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch eligible students: $e');
    }
  }

  /// Retrieves sanitized Microsoft Teams integration configuration status.
  Future<Map<String, dynamic>> getTeamsStatus() async {
    try {
      final response = await _apiClient.get(AppConfig.teamsStatusEndpoint);
      dynamic data = response.data;
      if (data is Map && data['data'] is Map) {
        data = data['data'];
      }
      if (data is Map<String, dynamic>) {
        return data;
      }
      return {'isConfigured': false};
    } on AppException {
      rethrow;
    } catch (e) {
      return {'isConfigured': false, 'error': e.toString()};
    }
  }
}
