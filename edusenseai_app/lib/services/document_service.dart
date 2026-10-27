import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/document_model.dart';

/// Service managing learning materials, lecture documents, and admin approvals.
class DocumentService {
  final ApiClient _apiClient;

  DocumentService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Retrieves list of documents, optionally filtered by status or subject.
  Future<List<DocumentModel>> getDocuments({
    String? status,
    String? subjectId,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty) {
        queryParams['status'] = status;
      }
      if (subjectId != null && subjectId.isNotEmpty) {
        queryParams['subjectId'] = subjectId;
      }

      final response = await _apiClient.get(
        AppConfig.documentsEndpoint,
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );

      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => DocumentModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch learning materials: $e');
    }
  }

  /// Admin approves a pending document and queues it for vector ingestion.
  Future<DocumentModel> approveDocument(String documentId) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.documentsEndpoint}/$documentId/approve',
      );
      if (response.data is Map && response.data['document'] is Map) {
        return DocumentModel.fromJson(
          response.data['document'] as Map<String, dynamic>,
        );
      }
      throw AppException('Failed to parse approval response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Document approval failed: $e');
    }
  }

  /// Admin rejects a document and marks it rejected.
  Future<DocumentModel> rejectDocument(String documentId) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.documentsEndpoint}/$documentId/reject',
      );
      if (response.data is Map && response.data['document'] is Map) {
        return DocumentModel.fromJson(
          response.data['document'] as Map<String, dynamic>,
        );
      }
      throw AppException('Failed to parse rejection response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Document rejection failed: $e');
    }
  }
}
