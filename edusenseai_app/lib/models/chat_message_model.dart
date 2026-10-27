import 'chat_source_model.dart';

enum MessageRole { student, tutor }

/// Model representing a single turn in a RAG tutoring conversation.
class ChatMessageModel {
  final String id;
  final MessageRole role;
  final String text;
  final DateTime timestamp;
  final List<ChatSourceModel> sources;
  final bool escalated;
  final double confidence;
  final List<String> followUp;
  final String? recommendedNextStep;
  final bool isLoading;
  final bool hasError;
  final String? errorMessage;

  const ChatMessageModel({
    required this.id,
    required this.role,
    required this.text,
    required this.timestamp,
    this.sources = const [],
    this.escalated = false,
    this.confidence = 1.0,
    this.followUp = const [],
    this.recommendedNextStep,
    this.isLoading = false,
    this.hasError = false,
    this.errorMessage,
  });

  bool get isStudent => role == MessageRole.student;
  bool get isTutor => role == MessageRole.tutor;

  factory ChatMessageModel.student({required String text, String? id}) {
    return ChatMessageModel(
      id: id ?? DateTime.now().microsecondsSinceEpoch.toString(),
      role: MessageRole.student,
      text: text,
      timestamp: DateTime.now(),
    );
  }

  factory ChatMessageModel.loading() {
    return ChatMessageModel(
      id: 'loading-${DateTime.now().microsecondsSinceEpoch}',
      role: MessageRole.tutor,
      text: '',
      timestamp: DateTime.now(),
      isLoading: true,
    );
  }

  factory ChatMessageModel.error(String message) {
    return ChatMessageModel(
      id: 'err-${DateTime.now().microsecondsSinceEpoch}',
      role: MessageRole.tutor,
      text: '',
      timestamp: DateTime.now(),
      hasError: true,
      errorMessage: message,
    );
  }

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    final rawRole = (json['role'] ?? 'tutor').toString().toLowerCase();
    final role =
        (rawRole == 'student' || rawRole == 'user')
            ? MessageRole.student
            : MessageRole.tutor;

    final rawSources = json['sources'];
    final List<ChatSourceModel> sources = [];
    if (rawSources is List) {
      for (final s in rawSources) {
        if (s is Map<String, dynamic>) {
          sources.add(ChatSourceModel.fromJson(s));
        }
      }
    }

    final rawFollowUp = json['follow_up'] ?? json['followUp'];
    final List<String> followUp = [];
    if (rawFollowUp is List) {
      for (final f in rawFollowUp) {
        if (f != null && f.toString().isNotEmpty) {
          followUp.add(f.toString());
        }
      }
    }

    return ChatMessageModel(
      id:
          json['id'] ??
          json['_id'] ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      role: role,
      text: json['text'] ?? json['answer'] ?? json['content'] ?? '',
      timestamp:
          json['timestamp'] != null
              ? DateTime.tryParse(json['timestamp'].toString()) ??
                  DateTime.now()
              : DateTime.now(),
      sources: sources,
      escalated: json['escalated'] == true,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 1.0,
      followUp: followUp,
      recommendedNextStep: json['recommended_next_step']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': isStudent ? 'student' : 'tutor',
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'sources': sources.map((s) => s.toJson()).toList(),
      'escalated': escalated,
      'confidence': confidence,
      'follow_up': followUp,
      if (recommendedNextStep != null)
        'recommended_next_step': recommendedNextStep,
    };
  }

  ChatMessageModel copyWith({
    String? id,
    MessageRole? role,
    String? text,
    DateTime? timestamp,
    List<ChatSourceModel>? sources,
    bool? escalated,
    double? confidence,
    List<String>? followUp,
    String? recommendedNextStep,
    bool? isLoading,
    bool? hasError,
    String? errorMessage,
  }) {
    return ChatMessageModel(
      id: id ?? this.id,
      role: role ?? this.role,
      text: text ?? this.text,
      timestamp: timestamp ?? this.timestamp,
      sources: sources ?? this.sources,
      escalated: escalated ?? this.escalated,
      confidence: confidence ?? this.confidence,
      followUp: followUp ?? this.followUp,
      recommendedNextStep: recommendedNextStep ?? this.recommendedNextStep,
      isLoading: isLoading ?? this.isLoading,
      hasError: hasError ?? this.hasError,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
