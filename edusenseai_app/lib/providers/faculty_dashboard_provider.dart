import 'package:flutter/foundation.dart';
import '../core/errors/app_exception.dart';
import '../models/document_model.dart';
import '../models/meeting_model.dart';
import '../models/risk_profile_model.dart';
import '../models/subject_model.dart';
import '../models/user_model.dart';
import '../services/analytics_service.dart';
import '../services/document_service.dart';
import '../services/meeting_service.dart';
import '../services/session_cleanup_service.dart';
import '../services/subject_service.dart';

/// State provider for Faculty Dashboard, managing assigned courses,
/// course materials, student consultation bookings, and cohort risk profiles.
class FacultyDashboardProvider extends ChangeNotifier {
  final SubjectService _subjectService;
  final DocumentService _documentService;
  final MeetingService _meetingService;
  final AnalyticsService _analyticsService;

  bool _isLoading = false;
  String? _errorMessage;
  List<SubjectModel> _assignedSubjects = [];
  List<DocumentModel> _uploadedMaterials = [];
  List<MeetingBookingModel> _bookings = [];
  List<StudentRiskProfileModel> _riskProfiles = [];
  String? _updatingBookingId;
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  FacultyDashboardProvider({
    SubjectService? subjectService,
    DocumentService? documentService,
    MeetingService? meetingService,
    AnalyticsService? analyticsService,
  }) : _subjectService = subjectService ?? SubjectService(),
       _documentService = documentService ?? DocumentService(),
       _meetingService = meetingService ?? MeetingService(),
       _analyticsService = analyticsService ?? AnalyticsService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all in-memory faculty dashboard caches upon sign-out
  void clearSessionData() {
    _assignedSubjects = [];
    _uploadedMaterials = [];
    _bookings = [];
    _riskProfiles = [];
    _errorMessage = null;
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

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<SubjectModel> get assignedSubjects => _assignedSubjects;
  List<DocumentModel> get uploadedMaterials => _uploadedMaterials;
  List<MeetingBookingModel> get bookings => _bookings;
  List<StudentRiskProfileModel> get riskProfiles => _riskProfiles;
  String? get updatingBookingId => _updatingBookingId;

  List<MeetingBookingModel> get pendingBookings =>
      _bookings.where((b) => b.isRequested).toList();

  /// Loads all faculty dashboard data concurrently from real backend endpoints.
  Future<void> loadDashboard({
    bool refresh = false,
    UserModel? currentUser,
  }) async {
    if (!refresh && _assignedSubjects.isNotEmpty && _errorMessage == null) {
      return;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _subjectService.getSubjects(),
        _documentService.getDocuments(),
        _meetingService.getFacultyBookings(),
        _analyticsService.getRiskProfiles(),
      ]);

      final allSubjects = results[0] as List<SubjectModel>;
      final allDocs = results[1] as List<DocumentModel>;
      _bookings = results[2] as List<MeetingBookingModel>;
      _riskProfiles = results[3] as List<StudentRiskProfileModel>;

      // Filter assigned subjects
      if (currentUser != null) {
        final cId = currentUser.id.toLowerCase();
        final cEmail = currentUser.email.toLowerCase();
        _assignedSubjects =
            allSubjects.where((s) {
              final sFacId = (s.facultyId ?? '').toLowerCase();
              final sFacEmail = s.facultyEmail.toLowerCase();
              return (sFacId.isNotEmpty && sFacId == cId) ||
                  (sFacEmail.isNotEmpty && sFacEmail == cEmail);
            }).toList();

        // If no explicit assignment, fallback to all subjects so faculty can inspect curriculum
        if (_assignedSubjects.isEmpty) {
          _assignedSubjects = allSubjects;
        }

        // Filter uploaded documents
        _uploadedMaterials =
            allDocs.where((d) {
              final upId = (d.uploaderId ?? '').toLowerCase();
              return upId.isNotEmpty && (upId == cId || upId == cEmail);
            }).toList();

        if (_uploadedMaterials.isEmpty) {
          _uploadedMaterials = allDocs;
        }
      } else {
        _assignedSubjects = allSubjects;
        _uploadedMaterials = allDocs;
      }

      _errorMessage = null;
    } on AppException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'Failed to load faculty dashboard: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Faculty approves, rejects, or updates status of a doubt consultation.
  Future<bool> updateBookingStatus(
    String bookingId,
    String status, {
    String? notes,
  }) async {
    _updatingBookingId = bookingId;
    notifyListeners();

    try {
      final updatedBooking = await _meetingService.updateBookingStatus(
        bookingId,
        status,
        facultyNotes: notes,
      );

      final index = _bookings.indexWhere((b) => b.id == bookingId);
      if (index >= 0) {
        _bookings[index] = updatedBooking;
      }
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (e) {
      _errorMessage = 'Failed to update booking status: $e';
      return false;
    } finally {
      _updatingBookingId = null;
      notifyListeners();
    }
  }
}
