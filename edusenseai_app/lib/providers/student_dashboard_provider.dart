import 'package:flutter/foundation.dart';
import '../core/errors/app_exception.dart';
import '../models/adaptive_profile_model.dart';
import '../models/document_model.dart';
import '../models/meeting_model.dart';
import '../models/subject_model.dart';
import '../models/user_model.dart';
import '../services/adaptive_service.dart';
import '../services/document_service.dart';
import '../services/meeting_service.dart';
import '../services/session_cleanup_service.dart';
import '../services/subject_service.dart';

/// State provider for Student Dashboard, managing enrolled courses,
/// learning materials, adaptive topic mastery, and scheduled doubt sessions.
class StudentDashboardProvider extends ChangeNotifier {
  final SubjectService _subjectService;
  final DocumentService _documentService;
  final AdaptiveService _adaptiveService;
  final MeetingService _meetingService;

  bool _isLoading = false;
  String? _errorMessage;
  List<SubjectModel> _allSubjects = [];
  List<SubjectModel> _enrolledSubjects = [];
  List<DocumentModel> _learningMaterials = [];
  AdaptiveProfileModel? _adaptiveProfile;
  List<MeetingBookingModel> _bookings = [];
  String? _enrollingSubjectId;
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  StudentDashboardProvider({
    SubjectService? subjectService,
    DocumentService? documentService,
    AdaptiveService? adaptiveService,
    MeetingService? meetingService,
  }) : _subjectService = subjectService ?? SubjectService(),
       _documentService = documentService ?? DocumentService(),
       _adaptiveService = adaptiveService ?? AdaptiveService(),
       _meetingService = meetingService ?? MeetingService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all in-memory dashboard and profile caches upon sign-out
  void clearSessionData() {
    _allSubjects = [];
    _enrolledSubjects = [];
    _learningMaterials = [];
    _adaptiveProfile = null;
    _bookings = [];
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
  List<SubjectModel> get allSubjects => _allSubjects;
  List<SubjectModel> get enrolledSubjects => _enrolledSubjects;
  List<DocumentModel> get learningMaterials => _learningMaterials;
  AdaptiveProfileModel? get adaptiveProfile => _adaptiveProfile;
  List<MeetingBookingModel> get bookings => _bookings;
  String? get enrollingSubjectId => _enrollingSubjectId;

  /// Loads all student dashboard data concurrently from real backend endpoints.
  Future<void> loadDashboard({
    bool refresh = false,
    UserModel? currentUser,
  }) async {
    if (!refresh && _allSubjects.isNotEmpty && _errorMessage == null) {
      return;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _subjectService.getSubjects(),
        _documentService.getDocuments(status: 'approved'),
        _adaptiveService.getProfile(),
        _meetingService.getStudentBookings(),
      ]);

      _allSubjects = results[0] as List<SubjectModel>;
      _learningMaterials = results[1] as List<DocumentModel>;
      _adaptiveProfile = results[2] as AdaptiveProfileModel;
      _bookings = results[3] as List<MeetingBookingModel>;

      _computeEnrolledSubjects(currentUser);
      _errorMessage = null;
    } on AppException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'Failed to load student dashboard: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _computeEnrolledSubjects(UserModel? currentUser) {
    if (currentUser == null) {
      _enrolledSubjects = [];
      return;
    }

    _enrolledSubjects =
        _allSubjects.where((s) {
          return s.isEnrolled(
            userId: currentUser.id,
            email: currentUser.email,
            studentId: currentUser.studentId,
          );
        }).toList();
  }

  /// Enrolls the student in a course and updates the list.
  Future<bool> enrollCourse(String subjectId, UserModel? currentUser) async {
    _enrollingSubjectId = subjectId;
    notifyListeners();

    try {
      final updatedSubject = await _subjectService.enrollSubject(subjectId);
      final index = _allSubjects.indexWhere((s) => s.id == subjectId);
      if (index >= 0) {
        _allSubjects[index] = updatedSubject;
      } else {
        _allSubjects.add(updatedSubject);
      }
      _computeEnrolledSubjects(currentUser);
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (e) {
      _errorMessage = 'Enrollment failed: $e';
      return false;
    } finally {
      _enrollingSubjectId = null;
      notifyListeners();
    }
  }

  /// Unenrolls the student from a course and updates the list.
  Future<bool> unenrollCourse(String subjectId, UserModel? currentUser) async {
    _enrollingSubjectId = subjectId;
    notifyListeners();

    try {
      final updatedSubject = await _subjectService.unenrollSubject(subjectId);
      final index = _allSubjects.indexWhere((s) => s.id == subjectId);
      if (index >= 0) {
        _allSubjects[index] = updatedSubject;
      }
      _computeEnrolledSubjects(currentUser);
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (e) {
      _errorMessage = 'Unenrollment failed: $e';
      return false;
    } finally {
      _enrollingSubjectId = null;
      notifyListeners();
    }
  }
}
