import 'package:flutter/foundation.dart';
import '../core/errors/app_exception.dart';
import '../models/audit_log_model.dart';
import '../models/document_model.dart';
import '../models/subject_model.dart';
import '../models/telemetry_model.dart';
import '../models/user_model.dart';
import '../services/analytics_service.dart';
import '../services/document_service.dart';
import '../services/session_cleanup_service.dart';
import '../services/subject_service.dart';

/// State provider for Administrator & Super Admin Dashboard, managing institutional telemetry,
/// pending document ingestion approvals, user provisioning directory, and audit logs.
class AdminDashboardProvider extends ChangeNotifier {
  final AnalyticsService _analyticsService;
  final DocumentService _documentService;
  final SubjectService _subjectService;

  bool _isLoading = false;
  String? _errorMessage;
  TelemetryModel? _telemetry;
  List<DocumentModel> _allDocuments = [];
  List<DocumentModel> _pendingDocuments = [];
  List<UserModel> _users = [];
  List<SubjectModel> _subjects = [];
  List<AuditLogModel> _auditLogs = [];
  String? _approvingDocId;
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  AdminDashboardProvider({
    AnalyticsService? analyticsService,
    DocumentService? documentService,
    SubjectService? subjectService,
  }) : _analyticsService = analyticsService ?? AnalyticsService(),
       _documentService = documentService ?? DocumentService(),
       _subjectService = subjectService ?? SubjectService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all in-memory administrative dashboard caches upon sign-out
  void clearSessionData() {
    _telemetry = null;
    _allDocuments = [];
    _pendingDocuments = [];
    _users = [];
    _subjects = [];
    _auditLogs = [];
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
  TelemetryModel? get telemetry => _telemetry;
  List<DocumentModel> get allDocuments => _allDocuments;
  List<DocumentModel> get pendingDocuments => _pendingDocuments;
  List<UserModel> get users => _users;
  List<SubjectModel> get subjects => _subjects;
  List<AuditLogModel> get auditLogs => _auditLogs;
  String? get approvingDocId => _approvingDocId;

  /// Loads administrative telemetry, documents, users, and audit trail in parallel.
  Future<void> loadDashboard({bool refresh = false}) async {
    if (!refresh && _telemetry != null && _errorMessage == null) {
      return;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _analyticsService.getTelemetry(),
        _documentService.getDocuments(),
        _analyticsService.getUsers(),
        _subjectService.getSubjects(),
        _analyticsService.getAuditLogs(),
      ]);

      _telemetry = results[0] as TelemetryModel;
      _allDocuments = results[1] as List<DocumentModel>;
      _users = results[2] as List<UserModel>;
      _subjects = results[3] as List<SubjectModel>;
      _auditLogs = results[4] as List<AuditLogModel>;

      _pendingDocuments = _allDocuments.where((d) => d.isPending).toList();
      _errorMessage = null;
    } on AppException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'Failed to load administrator telemetry: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Approves a faculty uploaded document and initiates RAG vector ingestion.
  Future<bool> approveDocument(String documentId) async {
    _approvingDocId = documentId;
    notifyListeners();

    try {
      final updated = await _documentService.approveDocument(documentId);
      final idx = _allDocuments.indexWhere((d) => d.id == documentId);
      if (idx >= 0) {
        _allDocuments[idx] = updated;
      }
      _pendingDocuments.removeWhere((d) => d.id == documentId);
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (e) {
      _errorMessage = 'Approval failed: $e';
      return false;
    } finally {
      _approvingDocId = null;
      notifyListeners();
    }
  }

  /// Rejects a faculty uploaded document.
  Future<bool> rejectDocument(String documentId) async {
    _approvingDocId = documentId;
    notifyListeners();

    try {
      final updated = await _documentService.rejectDocument(documentId);
      final idx = _allDocuments.indexWhere((d) => d.id == documentId);
      if (idx >= 0) {
        _allDocuments[idx] = updated;
      }
      _pendingDocuments.removeWhere((d) => d.id == documentId);
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (e) {
      _errorMessage = 'Rejection failed: $e';
      return false;
    } finally {
      _approvingDocId = null;
      notifyListeners();
    }
  }
}
