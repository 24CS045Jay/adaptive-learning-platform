/// Represents the health status response from the EduSense AI backend.
class HealthResponse {
  final String status;
  final String service;
  final String? ragService;
  final DateTime? timestamp;
  final int? responseTimeMs;

  HealthResponse({
    required this.status,
    required this.service,
    this.ragService,
    this.timestamp,
    this.responseTimeMs,
  });

  bool get isHealthy => status.toLowerCase() == 'ok';

  factory HealthResponse.fromJson(
    Map<String, dynamic> json, {
    int? responseTimeMs,
  }) {
    DateTime? parsedDate;
    if (json['timestamp'] != null) {
      try {
        parsedDate = DateTime.parse(json['timestamp'].toString());
      } catch (_) {}
    }

    return HealthResponse(
      status: json['status']?.toString() ?? 'unknown',
      service: json['service']?.toString() ?? 'EduSense AI Backend',
      ragService: json['rag_service']?.toString(),
      timestamp: parsedDate,
      responseTimeMs: responseTimeMs,
    );
  }

  Map<String, dynamic> toJson() => {
    'status': status,
    'service': service,
    'rag_service': ragService,
    'timestamp': timestamp?.toIso8601String(),
    'responseTimeMs': responseTimeMs,
  };
}
