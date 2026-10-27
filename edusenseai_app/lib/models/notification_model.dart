/// In-app notification model matching backend /api/notifications schema.
class NotificationModel {
  final String id;
  final String userId;
  final String type;
  final String title;
  final String message;
  final bool read;
  final DateTime timestamp;
  final String? link;

  const NotificationModel({
    required this.id,
    required this.userId,
    this.type = 'info',
    required this.title,
    required this.message,
    this.read = false,
    required this.timestamp,
    this.link,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    DateTime ts = DateTime.now();
    if (json['timestamp'] != null) {
      ts = DateTime.tryParse(json['timestamp'].toString()) ?? ts;
    } else if (json['createdAt'] != null) {
      ts = DateTime.tryParse(json['createdAt'].toString()) ?? ts;
    }

    return NotificationModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      type: (json['type'] ?? 'info').toString(),
      title: (json['title'] ?? 'EduSense Notification').toString(),
      message: (json['message'] ?? '').toString(),
      read: json['read'] == true,
      timestamp: ts,
      link: json['link']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type,
      'title': title,
      'message': message,
      'read': read,
      'timestamp': timestamp.toIso8601String(),
      'link': link,
    };
  }

  NotificationModel copyWith({
    String? id,
    String? userId,
    String? type,
    String? title,
    String? message,
    bool? read,
    DateTime? timestamp,
    String? link,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      read: read ?? this.read,
      timestamp: timestamp ?? this.timestamp,
      link: link ?? this.link,
    );
  }
}
