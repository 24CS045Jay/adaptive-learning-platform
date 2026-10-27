import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../errors/app_exception.dart';

/// Centralized API client for all EduSense AI HTTP/REST communications.
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio _dio;
  String? _authToken;

  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        sendTimeout: AppConfig.sendTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(_AuthAndSecurityInterceptor(this));

    if (kDebugMode) {
      _dio.interceptors.add(_SafeLoggingInterceptor());
    }
  }

  /// Underlying Dio instance if needed for advanced multipart uploads
  Dio get rawDio => _dio;

  /// Optional callback invoked when the backend returns a 401 Unauthorized response (session expired)
  void Function()? onUnauthorized;

  /// Current active base URL
  String get baseUrl => _dio.options.baseUrl;

  /// Updates the base URL dynamically if required
  void updateBaseUrl(String newBaseUrl) {
    _dio.options.baseUrl = newBaseUrl;
  }

  /// Sets the active JWT bearer token for subsequent authenticated requests
  void setAuthToken(String? token) {
    _authToken = token;
  }

  /// Clears the active authentication token on logout
  void clearAuthToken() {
    _authToken = null;
  }

  String? get authToken => _authToken;

  // ── Standard HTTP Methods ──────────────────────────────────────────────────

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    int maxRetries = 2,
    Duration retryDelay = const Duration(milliseconds: 500),
  }) async {
    int attempts = 0;
    while (true) {
      try {
        attempts++;
        return await _dio.get<T>(
          path,
          queryParameters: queryParameters,
          options: options,
        );
      } on DioException catch (e) {
        final isTransient =
            e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout ||
            e.type == DioExceptionType.connectionError ||
            (e.response != null &&
                (e.response!.statusCode == 503 ||
                    e.response!.statusCode == 504));

        if (isTransient && attempts <= maxRetries) {
          await Future.delayed(retryDelay * attempts);
          continue;
        }
        throw AppException.fromDioException(e);
      }
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw AppException.fromDioException(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw AppException.fromDioException(e);
    }
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw AppException.fromDioException(e);
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw AppException.fromDioException(e);
    }
  }
}

/// Automatically injects Authorization and correlation headers on requests
class _AuthAndSecurityInterceptor extends Interceptor {
  final ApiClient _client;
  _AuthAndSecurityInterceptor(this._client);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // End-to-end request correlation identifier
    if (!options.headers.containsKey('X-Request-ID')) {
      final reqId =
          'req_${DateTime.now().millisecondsSinceEpoch}_${options.method.toLowerCase()}_${(options.path.hashCode & 0x7FFFFFFF).toRadixString(16)}';
      options.headers['X-Request-ID'] = reqId;
    }

    // Platform telemetry headers
    options.headers['X-Client-Platform'] = 'flutter-mobile';
    options.headers['X-Client-Timestamp'] =
        DateTime.now().toUtc().toIso8601String();

    if (_client.authToken != null && _client.authToken!.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer ${_client.authToken}';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      _client.onUnauthorized?.call();
    }
    handler.next(err);
  }
}

/// Logs HTTP requests and responses safely without leaking secrets or credentials
class _SafeLoggingInterceptor extends Interceptor {
  static const _sensitiveKeys = {
    'password',
    'passwordhash',
    'token',
    'jwt',
    'secret',
    'otp',
    'newpassword',
    'currentpassword',
    'apikey',
    'authorization',
    'x-internal-token',
    'authtoken',
    'refreshtoken',
    'access_token',
    'refresh_token',
    'privatekey',
    'client_secret',
    'secretkey',
  };

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final sanitizedData = _sanitize(options.data);
    final reqId = options.headers['X-Request-ID'] ?? '';
    debugPrint(
      '🌐 [HTTP ->] ${options.method} ${options.uri.path}${options.uri.query.isNotEmpty ? "?${options.uri.query}" : ""} [$reqId]',
    );
    if (sanitizedData != null && kDebugMode) {
      debugPrint('   Payload: $sanitizedData');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final reqId = response.requestOptions.headers['X-Request-ID'] ?? '';
    debugPrint(
      '✅ [HTTP <-] ${response.statusCode} ${response.requestOptions.method} ${response.requestOptions.uri.path} [$reqId]',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final reqId = err.requestOptions.headers['X-Request-ID'] ?? '';
    debugPrint(
      '❌ [HTTP !] ${err.response?.statusCode ?? "ERR"} ${err.requestOptions.method} ${err.requestOptions.uri.path} : ${err.message} [$reqId]',
    );
    handler.next(err);
  }

  dynamic _sanitize(dynamic data) {
    if (data == null) return null;
    if (data is Map) {
      final sanitized = <String, dynamic>{};
      data.forEach((key, value) {
        final keyStr = key.toString().toLowerCase();
        if (_sensitiveKeys.contains(keyStr)) {
          sanitized[key.toString()] = '***[REDACTED]***';
        } else if (value is Map || value is List) {
          sanitized[key.toString()] = _sanitize(value);
        } else {
          sanitized[key.toString()] = value;
        }
      });
      return sanitized;
    }
    return data;
  }
}
