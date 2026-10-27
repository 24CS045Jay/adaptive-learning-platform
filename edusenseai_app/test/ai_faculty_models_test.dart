import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/ai_faculty_model.dart';

void main() {
  group('Phase 7 AI Faculty Models Tests', () {
    test('AiFacultyState display names and helper getters behave as expected', () {
      expect(AiFacultyState.idle.displayName, 'Ready to Connect');
      expect(AiFacultyState.connecting.displayName, 'Connecting...');
      expect(AiFacultyState.listening.displayName, 'Listening...');
      expect(AiFacultyState.processing.displayName, 'Thinking...');
      expect(AiFacultyState.speaking.displayName, 'Speaking');
      expect(AiFacultyState.interrupting.displayName, 'Interrupted');
      expect(AiFacultyState.ended.displayName, 'Session Ended');

      expect(AiFacultyState.speaking.isSpeaking, isTrue);
      expect(AiFacultyState.listening.isListening, isTrue);
      expect(AiFacultyState.processing.isProcessing, isTrue);
      expect(AiFacultyState.idle.isSpeaking, isFalse);
    });

    test('TeacherProfileModel parses JSON correctly', () {
      final json = {
        'name': 'Prof. Shubh Patel',
        'title': 'Assistant Professor',
        'department': 'CSPIT CSE',
        'avatar': '/assets/ui/shubh.png',
        'speakerId': 'shubh',
        'gender': 'male',
      };

      final profile = TeacherProfileModel.fromJson(json);
      expect(profile.name, 'Prof. Shubh Patel');
      expect(profile.title, 'Assistant Professor');
      expect(profile.department, 'CSPIT CSE');
      expect(profile.avatar, '/assets/ui/shubh.png');
      expect(profile.speakerId, 'shubh');
      expect(profile.gender, 'male');

      final serialized = profile.toJson();
      expect(serialized['speakerId'], 'shubh');
      expect(serialized['gender'], 'male');
    });

    test('FacultyLanguageModel default languages contains EN, HI, GU', () {
      final langs = FacultyLanguageModel.defaultLanguages;
      expect(langs.length, 3);

      final codes = langs.map((l) => l.code).toList();
      expect(codes, contains('en-IN'));
      expect(codes, contains('hi-IN'));
      expect(codes, contains('gu-IN'));

      final parsed = FacultyLanguageModel.fromJson({
        'code': 'gu-IN',
        'name': 'Gujarati',
        'native': 'ગુજરાતી',
        'sample': 'નમસ્તે',
      });
      expect(parsed.code, 'gu-IN');
      expect(parsed.nativeName, 'ગુજરાતી');
    });

    test('AiFacultySessionModel parses session payload with defaults', () {
      final json = {
        'sessionId': 'sess-12345',
        'conversationId': 'conv-98765',
        'subject': {
          'id': 'sub-1',
          'code': 'CSUC501',
          'name': 'Operating Systems',
        },
        'language_code': 'hi-IN',
        'speaker': 'anushka',
        'greeting': 'नमस्ते! मैं आपकी AI प्रोफेसर हूँ।',
        'teacherProfile': {
          'name': 'Prof. Anushka Sharma',
          'title': 'Senior AI Faculty',
          'department': 'CSPIT CSE',
          'avatar': '/assets/ui/av1.png',
          'speakerId': 'anushka',
        },
      };

      final session = AiFacultySessionModel.fromJson(json);
      expect(session.sessionId, 'sess-12345');
      expect(session.conversationId, 'conv-98765');
      expect(session.subjectCode, 'CSUC501');
      expect(session.subjectName, 'Operating Systems');
      expect(session.languageCode, 'hi-IN');
      expect(session.greeting, contains('नमस्ते!'));
      expect(session.teacherProfile.name, 'Prof. Anushka Sharma');
    });

    test('AiFacultyInteractionResult parses RAG sources and audio fields', () {
      final json = {
        'turnId': 3,
        'spoken_answer': 'Virtual memory creates the illusion of a large memory space.',
        'full_answer': 'Virtual memory creates the illusion of a large memory space using paging [1].',
        'audio_base64': 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        'audio_mime': 'audio/wav',
        'sources': [
          {
            'file_name': 'OS_Unit_3_Virtual_Memory.pdf',
            'snippet': 'Paging divides memory into fixed blocks.',
            'page': 14,
          },
        ],
        'follow_up': [
          'What is thrashing?',
          'How does page replacement work?',
        ],
        'confidence': 0.94,
        'grounded': true,
        'language_code': 'en-IN',
      };

      final result = AiFacultyInteractionResult.fromJson(json);
      expect(result.turnId, 3);
      expect(result.spokenAnswer, contains('illusion of a large memory space'));
      expect(result.fullAnswer, contains('using paging [1]'));
      expect(result.audioBase64, isNotNull);
      expect(result.sources.length, 1);
      expect(result.sources.first.fileName, 'OS_Unit_3_Virtual_Memory.pdf');
      expect(result.sources.first.page, 14);
      expect(result.followUp.length, 2);
      expect(result.confidence, 0.94);
      expect(result.grounded, isTrue);
    });

    test('AiFacultyMessage role and type properties evaluate accurately', () {
      final stdMsg = AiFacultyMessage(
        id: 'msg-1',
        role: 'student',
        text: 'What is a page fault?',
        timestamp: DateTime.now(),
        type: 'voice',
      );
      expect(stdMsg.isStudent, isTrue);
      expect(stdMsg.isFaculty, isFalse);
      expect(stdMsg.isSystem, isFalse);

      final facMsg = AiFacultyMessage(
        id: 'msg-2',
        role: 'faculty',
        text: 'A page fault is an interrupt raised by hardware.',
        timestamp: DateTime.now(),
        type: 'voice',
      );
      expect(facMsg.isFaculty, isTrue);

      final sysMsg = AiFacultyMessage(
        id: 'msg-3',
        role: 'system',
        text: 'Session ended.',
        timestamp: DateTime.now(),
        type: 'system',
      );
      expect(sysMsg.isSystem, isTrue);
    });

    test('TavusSessionModel parses WebRTC session response', () {
      final json = {
        'conversation_id': 'cvi-conv-888',
        'conversation_url': 'https://daily.co/tavus-session-888',
        'status': 'active',
        'configured': true,
        'persona_name': 'JARVIS',
      };

      final tavus = TavusSessionModel.fromJson(json);
      expect(tavus.conversationId, 'cvi-conv-888');
      expect(tavus.conversationUrl, 'https://daily.co/tavus-session-888');
      expect(tavus.status, 'active');
      expect(tavus.configured, isTrue);
      expect(tavus.personaName, 'JARVIS');
    });
  });
}
