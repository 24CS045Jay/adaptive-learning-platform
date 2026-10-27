/// Model representing a student's conversation session with the AI Tutor.
class ConversationModel {
  final String id;
  final String title;
  final String? subjectId;
  final String subjectName;
  final String subjectCode;
  final DateTime updatedAt;
  final int messagesCount;

  const ConversationModel({
    required this.id,
    required this.title,
    this.subjectId,
    this.subjectName = 'General',
    this.subjectCode = 'GENERAL',
    required this.updatedAt,
    this.messagesCount = 0,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      id: json['id'] ?? json['_id'] ?? '',
      title: json['title'] ?? 'Study Session',
      subjectId: json['subjectId']?.toString(),
      subjectName: json['subjectName'] ?? 'General',
      subjectCode: json['subjectCode'] ?? 'GENERAL',
      updatedAt:
          json['updatedAt'] != null
              ? DateTime.tryParse(json['updatedAt'].toString()) ??
                  DateTime.now()
              : DateTime.now(),
      messagesCount:
          json['messagesCount'] is int
              ? json['messagesCount'] as int
              : (json['messages'] is List
                  ? (json['messages'] as List).length
                  : 0),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subjectId': subjectId,
      'subjectName': subjectName,
      'subjectCode': subjectCode,
      'updatedAt': updatedAt.toIso8601String(),
      'messagesCount': messagesCount,
    };
  }
}
