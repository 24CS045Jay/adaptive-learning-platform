import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/ai_faculty_model.dart';
import 'package:edusenseai/providers/ai_faculty_provider.dart';
import 'package:edusenseai/services/ai_faculty_service.dart';

class MockAiFacultyServiceForProvider implements AiFacultyService {
  bool shouldThrow = false;
  int interactCallCount = 0;
  String? lastInteractQuestion;
  int? lastTurnId;

  @override
  Future<Map<String, dynamic>> getConfig() async => {
    'status': 'ok',
    'providers': {'sarvam': {'active': true}},
  };

  @override
  Future<List<Map<String, dynamic>>> getSubjects() async => [
    {'code': 'CSUC501', 'name': 'Operating Systems'},
  ];

  @override
  Future<AiFacultySessionModel> createSession({
    String? subjectId,
    required String subjectCode,
    String languageCode = 'en-IN',
    String speaker = 'anushka',
  }) async {
    if (shouldThrow) throw Exception('Session initiation failed');
    return AiFacultySessionModel(
      sessionId: 'sess-test-1',
      conversationId: 'conv-test-1',
      subjectCode: subjectCode,
      subjectName: 'Operating Systems',
      languageCode: languageCode,
      speaker: speaker,
      greeting: 'Hello student! How can I guide you today?',
      teacherProfile: const TeacherProfileModel(
        name: 'Prof. Anushka Sharma',
        title: 'Senior AI Faculty',
        department: 'CSPIT CSE',
        avatar: '/assets/ui/av1.png',
        speakerId: 'anushka',
      ),
      timestamp: DateTime.now(),
    );
  }

  @override
  Future<AiFacultyInteractionResult> interact({
    required String question,
    required String subjectCode,
    String? subjectId,
    String? conversationId,
    String languageCode = 'en-IN',
    String learnerLevel = 'intermediate',
    int turnId = 1,
    String speaker = 'anushka',
    double pace = 1.0,
    bool audioRequested = true,
    CancelToken? cancelToken,
  }) async {
    interactCallCount++;
    lastInteractQuestion = question;
    lastTurnId = turnId;

    if (shouldThrow) throw Exception('RAG microservice error');

    return AiFacultyInteractionResult(
      turnId: turnId,
      spokenAnswer: 'Virtual memory separates user logical memory from physical memory.',
      fullAnswer: 'Virtual memory separates user logical memory from physical memory [1]. It allows execution of partially loaded processes.',
      audioBase64: 'UklGRiQAAABXQVZF',
      sources: const [
        AiFacultySource(fileName: 'Operating_Systems_Ch9.pdf', page: 12),
      ],
      followUp: const ['What is paging?'],
      confidence: 0.96,
      grounded: true,
      languageCode: languageCode,
    );
  }

  @override
  Future<Map<String, dynamic>> transcribeAudio({
    required List<int> audioBytes,
    String filename = 'utterance.wav',
    String languageCode = 'en-IN',
    String fallbackTranscript = '',
  }) async => {'transcript': 'What is virtual memory?', 'provider': 'sarvam'};

  @override
  Future<Map<String, dynamic>> synthesizeSpeech({
    required String text,
    String languageCode = 'en-IN',
    String speaker = 'anushka',
    double pace = 1.0,
  }) async => {'audio_base64': 'UklGRiQ=', 'spoken_text': text};

  @override
  Future<TavusSessionModel> startTavusSession({
    required String subjectName,
    required String subjectCode,
    String? subjectId,
    String languageCode = 'en-IN',
  }) async => const TavusSessionModel(
    conversationId: 'tavus-conv-123',
    conversationUrl: 'https://daily.co/test-tavus',
  );

  @override
  Future<void> endTavusSession(String conversationId) async {}
}

void main() {
  group('Phase 7 AiFacultyProvider State & Workflow Tests', () {
    late MockAiFacultyServiceForProvider mockService;
    late AiFacultyProvider provider;

    setUp(() {
      mockService = MockAiFacultyServiceForProvider();
      provider = AiFacultyProvider(service: mockService);
    });

    test('startSession initializes session and greeting message', () async {
      expect(provider.state, AiFacultyState.idle);

      final success = await provider.startSession(
        subjectCode: 'CSUC501',
        subjectName: 'Operating Systems',
        languageCode: 'en-IN',
      );

      expect(success, isTrue);
      expect(provider.session, isNotNull);
      expect(provider.session!.subjectCode, 'CSUC501');
      expect(provider.messages.length, 1);
      expect(provider.messages.first.role, 'faculty');
      expect(provider.messages.first.text, contains('Hello student!'));
      expect(provider.state, AiFacultyState.speaking);
      expect(provider.currentSpokenText, contains('Hello student!'));
    });

    test('askQuestion sends query to RAG and enters speaking state', () async {
      await provider.startSession(subjectCode: 'CSUC501');

      await provider.askQuestion('What is virtual memory?');

      expect(mockService.interactCallCount, 1);
      expect(mockService.lastInteractQuestion, 'What is virtual memory?');
      expect(provider.messages.length, 3); // greeting + student + faculty

      final stdMsg = provider.messages[1];
      expect(stdMsg.isStudent, isTrue);
      expect(stdMsg.text, 'What is virtual memory?');

      final facMsg = provider.messages[2];
      expect(facMsg.isFaculty, isTrue);
      expect(facMsg.sources.length, 1);
      expect(facMsg.sources.first.fileName, 'Operating_Systems_Ch9.pdf');
      expect(provider.state, AiFacultyState.speaking);
    });

    test('interruptTeacher performs instantaneous Barge-In', () async {
      await provider.startSession(subjectCode: 'CSUC501');
      await provider.askQuestion('What is paging?');

      expect(provider.state, AiFacultyState.speaking);
      final prevTurn = provider.currentTurnId;

      // Student interrupts teacher
      provider.interruptTeacher();

      expect(provider.currentTurnId, greaterThan(prevTurn));
      expect(provider.currentSpokenText, isNull);
      expect(provider.state, isIn([AiFacultyState.interrupting, AiFacultyState.listening]));
    });

    test('settings updates: language, speaker, learnerLevel, pace and mute', () {
      provider.setLanguage('gu-IN');
      expect(provider.selectedLanguage, 'gu-IN');

      provider.setSpeaker('shubh');
      expect(provider.selectedSpeaker, 'shubh');

      provider.setLearnerLevel('advanced');
      expect(provider.learnerLevel, 'advanced');

      provider.setSpeechPace(1.2);
      expect(provider.speechPace, 1.2);

      expect(provider.isAudioMuted, isFalse);
      provider.toggleAudioMute();
      expect(provider.isAudioMuted, isTrue);
    });

    test('launchTavusVideoCall requests Tavus conversation URL', () async {
      await provider.startSession(subjectCode: 'CSUC501');

      final url = await provider.launchTavusVideoCall();
      expect(url, 'https://daily.co/test-tavus');
      expect(provider.isTavusActive, isTrue);
      expect(provider.tavusSession?.conversationId, 'tavus-conv-123');
    });

    test('endSession terminates active session gracefully', () async {
      await provider.startSession(subjectCode: 'CSUC501');
      await provider.endSession();

      expect(provider.state, AiFacultyState.ended);
      expect(provider.messages.last.isSystem, isTrue);
      expect(provider.messages.last.text, contains('Live Session Concluded'));
    });
  });
}
