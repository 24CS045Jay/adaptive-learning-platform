/// Phase 7: AI Faculty Models
///
/// Encapsulates state machines, teacher profiles, session metadata,
/// speech recognition transcripts, and RAG-grounded responses for the
/// conversational AI Faculty avatar and real-time voice experience.
library;

/// Conversational state machine for the AI Faculty interface.
enum AiFacultyState {
  idle,
  connecting,
  listening,
  processing,
  speaking,
  interrupting,
  error,
  ended,
}

extension AiFacultyStateX on AiFacultyState {
  String get displayName {
    switch (this) {
      case AiFacultyState.idle:
        return 'Ready to Connect';
      case AiFacultyState.connecting:
        return 'Connecting...';
      case AiFacultyState.listening:
        return 'Listening...';
      case AiFacultyState.processing:
        return 'Thinking...';
      case AiFacultyState.speaking:
        return 'Speaking';
      case AiFacultyState.interrupting:
        return 'Interrupted';
      case AiFacultyState.error:
        return 'Connection Error';
      case AiFacultyState.ended:
        return 'Session Ended';
    }
  }

  bool get isSpeaking => this == AiFacultyState.speaking;
  bool get isListening => this == AiFacultyState.listening;
  bool get isProcessing => this == AiFacultyState.processing;
}

/// Represents an academic teacher persona.
class TeacherProfileModel {
  final String name;
  final String title;
  final String department;
  final String avatar;
  final String speakerId;
  final String gender;

  const TeacherProfileModel({
    required this.name,
    required this.title,
    required this.department,
    required this.avatar,
    required this.speakerId,
    this.gender = 'female',
  });

  factory TeacherProfileModel.fromJson(Map<String, dynamic> json) {
    return TeacherProfileModel(
      name: json['name'] as String? ?? 'Prof. Anushka Sharma',
      title: json['title'] as String? ?? 'Senior AI Faculty & Academic Mentor',
      department: json['department'] as String? ?? 'CSPIT CSE, CHARUSAT',
      avatar: json['avatar'] as String? ?? '/assets/ui/av1.png',
      speakerId: json['speakerId'] as String? ?? 'anushka',
      gender: json['gender'] as String? ?? 'female',
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'title': title,
    'department': department,
    'avatar': avatar,
    'speakerId': speakerId,
    'gender': gender,
  };
}

/// Supported language configuration.
class FacultyLanguageModel {
  final String code;
  final String name;
  final String nativeName;
  final String sample;

  const FacultyLanguageModel({
    required this.code,
    required this.name,
    required this.nativeName,
    this.sample = '',
  });

  factory FacultyLanguageModel.fromJson(Map<String, dynamic> json) {
    return FacultyLanguageModel(
      code: json['code'] as String? ?? 'en-IN',
      name: json['name'] as String? ?? 'English (India)',
      nativeName:
          json['native'] as String? ??
          json['nativeName'] as String? ??
          'English',
      sample: json['sample'] as String? ?? '',
    );
  }

  static const List<FacultyLanguageModel> defaultLanguages = [
    FacultyLanguageModel(
      code: 'en-IN',
      name: 'English (India)',
      nativeName: 'English',
      sample: "Hello, let's explore this topic together.",
    ),
    FacultyLanguageModel(
      code: 'hi-IN',
      name: 'Hindi',
      nativeName: 'हिंदी',
      sample: 'नमस्ते, आइए इस विषय को विस्तार से समझें।',
    ),
    FacultyLanguageModel(
      code: 'gu-IN',
      name: 'Gujarati',
      nativeName: 'ગુજરાતી',
      sample: 'નમસ્તે, ચાલો આપણે આ કોન્સેપ્ટ સરળતાથી સમજીએ.',
    ),
  ];
}

/// Active AI Faculty session metadata.
class AiFacultySessionModel {
  final String sessionId;
  final String conversationId;
  final String subjectCode;
  final String subjectName;
  final String? subjectId;
  final String languageCode;
  final String speaker;
  final String greeting;
  final TeacherProfileModel teacherProfile;
  final DateTime timestamp;

  const AiFacultySessionModel({
    required this.sessionId,
    required this.conversationId,
    required this.subjectCode,
    required this.subjectName,
    this.subjectId,
    required this.languageCode,
    required this.speaker,
    required this.greeting,
    required this.teacherProfile,
    required this.timestamp,
  });

  factory AiFacultySessionModel.fromJson(Map<String, dynamic> json) {
    final sub = json['subject'] as Map<String, dynamic>? ?? {};
    return AiFacultySessionModel(
      sessionId:
          json['sessionId'] as String? ?? 'sess-${DateTime.now().millisecondsSinceEpoch}',
      conversationId:
          json['conversationId'] as String? ??
          json['sessionId'] as String? ??
          '',
      subjectCode: sub['code'] as String? ?? 'CSUC501',
      subjectName: sub['name'] as String? ?? 'Computer Science Core',
      subjectId: sub['id'] as String?,
      languageCode: json['language_code'] as String? ?? 'en-IN',
      speaker: json['speaker'] as String? ?? 'anushka',
      greeting: json['greeting'] as String? ?? '',
      teacherProfile:
          json['teacherProfile'] != null
              ? TeacherProfileModel.fromJson(
                json['teacherProfile'] as Map<String, dynamic>,
              )
              : TeacherProfileModel(
                name:
                    json['speaker'] == 'shubh' || json['speaker'] == 'aditya'
                        ? 'Prof. Shubh Patel'
                        : 'Prof. Anushka Sharma',
                title: 'Senior AI Faculty & Academic Mentor',
                department: 'CSPIT CSE, CHARUSAT',
                avatar: '/assets/ui/av1.png',
                speakerId: json['speaker'] as String? ?? 'anushka',
              ),
      timestamp:
          json['timestamp'] != null
              ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
              : DateTime.now(),
    );
  }
}

/// Syllabus document source citation.
class AiFacultySource {
  final String fileName;
  final String? snippet;
  final int page;

  const AiFacultySource({
    required this.fileName,
    this.snippet,
    this.page = 0,
  });

  factory AiFacultySource.fromJson(Map<String, dynamic> json) {
    return AiFacultySource(
      fileName:
          json['fileName'] as String? ??
          json['file_name'] as String? ??
          'Syllabus_Guide.pdf',
      snippet: json['snippet'] as String?,
      page:
          json['page'] is int
              ? json['page'] as int
              : int.tryParse('${json['page']}') ?? 0,
    );
  }
}

/// RAG-grounded response received from `POST /api/ai-faculty/interact`.
class AiFacultyInteractionResult {
  final int turnId;
  final String spokenAnswer;
  final String fullAnswer;
  final String? audioBase64;
  final String audioMime;
  final List<AiFacultySource> sources;
  final List<String> followUp;
  final dynamic visual;
  final dynamic workedExample;
  final double confidence;
  final bool grounded;
  final String languageCode;
  final bool fallbackToBrowser;

  const AiFacultyInteractionResult({
    required this.turnId,
    required this.spokenAnswer,
    required this.fullAnswer,
    this.audioBase64,
    this.audioMime = 'audio/wav',
    this.sources = const [],
    this.followUp = const [],
    this.visual,
    this.workedExample,
    this.confidence = 0.88,
    this.grounded = true,
    this.languageCode = 'en-IN',
    this.fallbackToBrowser = false,
  });

  factory AiFacultyInteractionResult.fromJson(Map<String, dynamic> json) {
    final rawSources = json['sources'] as List<dynamic>? ?? [];
    final rawFollowUps = json['follow_up'] as List<dynamic>? ?? [];

    return AiFacultyInteractionResult(
      turnId:
          json['turnId'] is int
              ? json['turnId'] as int
              : int.tryParse('${json['turnId']}') ?? 1,
      spokenAnswer:
          json['spoken_answer'] as String? ??
          json['spokenAnswer'] as String? ??
          '',
      fullAnswer:
          json['full_answer'] as String? ??
          json['agenticAnswer'] as String? ??
          json['answer'] as String? ??
          '',
      audioBase64: json['audio_base64'] as String?,
      audioMime: json['audio_mime'] as String? ?? 'audio/wav',
      sources:
          rawSources
              .whereType<Map<String, dynamic>>()
              .map(AiFacultySource.fromJson)
              .toList(),
      followUp: rawFollowUps.map((e) => '$e').toList(),
      visual: json['visual'],
      workedExample: json['worked_example'],
      confidence:
          json['confidence'] is num
              ? (json['confidence'] as num).toDouble()
              : 0.88,
      grounded: json['grounded'] as bool? ?? true,
      languageCode: json['language_code'] as String? ?? 'en-IN',
      fallbackToBrowser: json['fallback_to_browser'] as bool? ?? false,
    );
  }
}

/// Individual conversation turn in the AI Faculty transcript.
class AiFacultyMessage {
  final String id;
  final String role; // 'student' | 'faculty' | 'system'
  final String text;
  final DateTime timestamp;
  final String type; // 'voice' | 'typed' | 'system'
  final List<AiFacultySource> sources;
  final String? audioBase64;
  final int turnId;

  const AiFacultyMessage({
    required this.id,
    required this.role,
    required this.text,
    required this.timestamp,
    this.type = 'typed',
    this.sources = const [],
    this.audioBase64,
    this.turnId = 0,
  });

  bool get isStudent => role == 'student';
  bool get isFaculty => role == 'faculty';
  bool get isSystem => role == 'system';
}

/// Tavus CVI WebRTC session response.
class TavusSessionModel {
  final String conversationId;
  final String conversationUrl;
  final String status;
  final bool configured;
  final String personaName;

  const TavusSessionModel({
    required this.conversationId,
    required this.conversationUrl,
    this.status = 'active',
    this.configured = true,
    this.personaName = 'JARVIS',
  });

  factory TavusSessionModel.fromJson(Map<String, dynamic> json) {
    return TavusSessionModel(
      conversationId: json['conversation_id'] as String? ?? '',
      conversationUrl: json['conversation_url'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      configured: json['configured'] as bool? ?? false,
      personaName: json['persona_name'] as String? ?? 'JARVIS',
    );
  }
}
