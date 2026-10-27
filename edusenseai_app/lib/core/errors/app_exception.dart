import 'package:dio/dio.dart';

/// Base exception class for all EduSense AI errors.
class AppException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic originalError;

  AppException(this.message, {this.statusCode, this.originalError});

  @override
  String toString() => message;

  /// Factory helper that maps [DioException] into structured, user-friendly [AppException]s.
  factory AppException.fromDioException(DioException dioError) {
    switch (dioError.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return NetworkException(
          'Connection timed out. Please check if the EduSense AI backend is running.',
          originalError: dioError,
        );

      case DioExceptionType.connectionError:
        return NetworkException(
          'Unable to reach EduSense AI server. For Android emulator, ensure the backend runs on port 5000.',
          originalError: dioError,
        );

      case DioExceptionType.badResponse:
        final status = dioError.response?.statusCode;
        final data = dioError.response?.data;
        String extractedMsg = 'Server responded with status $status';

        if (data is Map && data['error'] != null) {
          extractedMsg = data['error'].toString();
        } else if (data is Map && data['message'] != null) {
          extractedMsg = data['message'].toString();
        } else if (data is String && data.isNotEmpty) {
          extractedMsg = data;
        }

        if (status == 401) {
          return UnauthorizedException(extractedMsg, statusCode: status);
        } else if (status == 403) {
          return ForbiddenException(extractedMsg, statusCode: status);
        } else if (status == 404) {
          return NotFoundException(extractedMsg, statusCode: status);
        } else if (status == 429) {
          return RateLimitException(
            extractedMsg.contains('429')
                ? 'Too many requests. Please slow down and try again shortly.'
                : extractedMsg,
            statusCode: status,
          );
        } else if (status != null && status >= 500) {
          return ServerException(extractedMsg, statusCode: status);
        }

        return ApiException(extractedMsg, statusCode: status);

      case DioExceptionType.cancel:
        return AppException('Request was cancelled.');

      case DioExceptionType.badCertificate:
        return NetworkException('Untrusted SSL certificate detected.');

      case DioExceptionType.unknown:
      default:
        return NetworkException(
          'An unexpected network error occurred: ${dioError.message ?? "Unknown"}',
          originalError: dioError,
        );
    }
  }
}

/// Thrown when connection fails, times out, or network is unavailable.
class NetworkException extends AppException {
  NetworkException(super.message, {super.statusCode, super.originalError});
}

/// Thrown when the backend API returns a 4xx error.
class ApiException extends AppException {
  ApiException(super.message, {super.statusCode, super.originalError});
}

/// Thrown on HTTP 401 Unauthorized.
class UnauthorizedException extends ApiException {
  UnauthorizedException(super.message, {super.statusCode, super.originalError});
}

/// Thrown on HTTP 403 Forbidden (insufficient role permission).
class ForbiddenException extends ApiException {
  ForbiddenException(super.message, {super.statusCode, super.originalError});
}

/// Thrown on HTTP 404 Not Found.
class NotFoundException extends ApiException {
  NotFoundException(super.message, {super.statusCode, super.originalError});
}

/// Thrown on HTTP 429 Too Many Requests (Rate Limiting).
class RateLimitException extends ApiException {
  RateLimitException(super.message, {super.statusCode, super.originalError});
}

/// Thrown on HTTP 500+ Internal Server Error.
class ServerException extends AppException {
  ServerException(super.message, {super.statusCode, super.originalError});
}
