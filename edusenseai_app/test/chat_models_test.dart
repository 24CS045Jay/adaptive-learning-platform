import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/models/chat_message_model.dart';
import 'package:edusenseai/models/chat_source_model.dart';
import 'package:edusenseai/models/conversation_model.dart';
import 'package:edusenseai/models/quiz_model.dart';

void main() {
  group('Phase 4 RAG Chat & Learning Models Tests', () {
    test('ChatSourceModel fromJson and toJson serialization', () {
      final json = {
        'document_id': 'doc-123',
        'file_name': 'CS304_Unit1_Lecture.pdf',
        'page': 14,
        'snippet': 'Flutter uses a reactive framework to build widgets.',
      };

      final source = ChatSourceModel.fromJson(json);
      expect(source.documentId, 'doc-123');
      expect(source.fileName, 'CS304_Unit1_Lecture.pdf');
      expect(source.page, 14);
      expect(source.snippet, contains('reactive framework'));
      expect(source.displayName, 'CS304_Unit1_Lecture.pdf');

      final serialized = source.toJson();
      expect(serialized['document_id'], 'doc-123');
      expect(serialized['page'], 14);
    });

    test('ChatSourceModel displayName fallback', () {
      const source = ChatSourceModel(title: 'Unit Overview');
      expect(source.displayName, 'Unit Overview');

      const blank = ChatSourceModel();
      expect(blank.displayName, 'Course Material');
    });

    test('ChatMessageModel student factory and JSON serialization', () {
      final msg = ChatMessageModel.student(text: 'What is State in Flutter?');
      expect(msg.isStudent, isTrue);
      expect(msg.isTutor, isFalse);
      expect(msg.text, 'What is State in Flutter?');

      final json = msg.toJson();
      expect(json['role'], 'student');
      expect(json['text'], 'What is State in Flutter?');
    });

    test(
      'ChatMessageModel tutor response parsing with citations and follow-up',
      () {
        final json = {
          'id': 'turn-1',
          'role': 'tutor',
          'answer':
              'State is information that can be read synchronously when the widget is built.',
          'confidence': 0.94,
          'escalated': false,
          'sources': [
            {
              'document_id': 'doc-1',
              'file_name': 'Flutter_Core.pdf',
              'page': 5,
              'snippet': 'StatefulWidget holds mutable state.',
            },
          ],
          'follow_up': [
            'What is the difference between StatefulWidget and StatelessWidget?',
            'How does setState() work?',
          ],
        };

        final msg = ChatMessageModel.fromJson(json);
        expect(msg.isTutor, isTrue);
        expect(msg.text, contains('State is information'));
        expect(msg.confidence, 0.94);
        expect(msg.escalated, isFalse);
        expect(msg.sources.length, 1);
        expect(msg.sources.first.fileName, 'Flutter_Core.pdf');
        expect(msg.followUp.length, 2);
      },
    );

    test('ChatMessageModel loading and error factories', () {
      final loading = ChatMessageModel.loading();
      expect(loading.isLoading, isTrue);
      expect(loading.hasError, isFalse);

      final error = ChatMessageModel.error('Network timeout connecting to RAG');
      expect(error.hasError, isTrue);
      expect(error.errorMessage, contains('timeout'));
    });

    test('ConversationModel parsing and serialization', () {
      final json = {
        '_id': 'conv-101',
        'title': 'Flutter Architecture Questions',
        'subjectId': 'subj-1',
        'subjectName': 'Mobile Development',
        'subjectCode': 'CS304',
        'updatedAt': '2026-10-21T18:00:00.000Z',
        'messages': [
          {'role': 'student', 'text': 'Hello'},
          {'role': 'tutor', 'text': 'Hi Alice!'},
        ],
      };

      final conv = ConversationModel.fromJson(json);
      expect(conv.id, 'conv-101');
      expect(conv.title, 'Flutter Architecture Questions');
      expect(conv.subjectCode, 'CS304');
      expect(conv.messagesCount, 2);

      final serialized = conv.toJson();
      expect(serialized['id'], 'conv-101');
      expect(serialized['messagesCount'], 2);
    });

    test('QuizModel and QuizQuestionModel parsing', () {
      final json = {
        '_id': 'quiz-1',
        'title': 'State Management Diagnostic',
        'isAiGenerated': true,
        'questions': [
          {
            '_id': 'q-1',
            'question': 'Which widget is immutable in Flutter?',
            'options': [
              'StatelessWidget',
              'StatefulWidget',
              'State',
              'InheritedModel',
            ],
            'correctOption': 'StatelessWidget',
            'topicTag': 'Widgets',
            'difficulty': 'easy',
          },
        ],
      };

      final quiz = QuizModel.fromJson(json);
      expect(quiz.id, 'quiz-1');
      expect(quiz.title, 'State Management Diagnostic');
      expect(quiz.isAiGenerated, isTrue);
      expect(quiz.questions.length, 1);
      expect(
        quiz.questions.first.questionText,
        'Which widget is immutable in Flutter?',
      );
      expect(quiz.questions.first.correctOption, 'StatelessWidget');
    });
  });
}
