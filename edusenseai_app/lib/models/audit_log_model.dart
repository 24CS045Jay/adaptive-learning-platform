/// Platform audit log entry matching backend /api/analytics/audit-logs response.
class AuditLogModel {
  final String id;
  final String actor;
  final String action;
  final String target;
  final String details;
  final String time;

  const AuditLogModel({
    required this.id,
    required this.actor,
    required this.action,
    this.target = '',
    this.details = '',
    required this.time,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    return AuditLogModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      actor: (json['actor'] ?? 'system').toString(),
      action: (json['action'] ?? 'SYSTEM_ACTION').toString(),
      target: (json['target'] ?? '').toString(),
      details: (json['details'] ?? '').toString(),
      time: (json['time'] ?? '').toString(),
    );
  }
}
