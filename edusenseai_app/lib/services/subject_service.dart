import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/subject_model.dart';

/// Service managing subject catalog, course details, and student enrollments.
class SubjectService {
  final ApiClient _apiClient;

  SubjectService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Retrieves list of all active subjects with faculty details.
  Future<List<SubjectModel>> getSubjects() async {
    try {
      final response = await _apiClient.get(AppConfig.subjectsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => SubjectModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch subjects from server: $e');
    }
  }

  /// Retrieves single subject by ID or Code.
  Future<SubjectModel> getSubject(String id) async {
    try {
      final response = await _apiClient.get(
        '${AppConfig.subjectsEndpoint}/$id',
      );
      if (response.data is Map<String, dynamic>) {
        return SubjectModel.fromJson(response.data as Map<String, dynamic>);
      }
      throw AppException('Invalid subject payload returned by backend.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch subject details: $e');
    }
  }

  /// Enrolls the authenticated student in the specified subject.
  Future<SubjectModel> enrollSubject(String subjectId) async {
    try {
      final response = await _apiClient.post(
        '${AppConfig.subjectsEndpoint}/$subjectId/enroll',
      );
      if (response.data is Map<String, dynamic>) {
        return SubjectModel.fromJson(response.data as Map<String, dynamic>);
      }
      throw AppException('Failed to process enrollment response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Enrollment request failed: $e');
    }
  }

  /// Unenrolls the authenticated student from the specified subject.
  Future<SubjectModel> unenrollSubject(String subjectId) async {
    try {
      final response = await _apiClient.post(
        '${AppConfig.subjectsEndpoint}/$subjectId/unenroll',
      );
      if (response.data is Map<String, dynamic>) {
        return SubjectModel.fromJson(response.data as Map<String, dynamic>);
      }
      throw AppException('Failed to process unenrollment response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Unenrollment request failed: $e');
    }
  }
}
