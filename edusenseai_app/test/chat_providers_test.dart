import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/core/errors/app_exception.dart';
import 'package:edusenseai/models/chat_message_model.dart';
import 'package:edusenseai/models/chat_source_model.dart';
import 'package:edusenseai/models/conversation_model.dart';
import 'package:edusenseai/models/document_model.dart';
import 'package:edusenseai/models/quiz_model.dart';
import 'package:edusenseai/models/subject_model.dart';
import 'package:edusenseai/providers/chat_provider.dart';
import 'package:edusenseai/providers/subject_learning_provider.dart';
import 'package:edusenseai/services/document_service.dart';
import 'package:edusenseai/services/quiz_service.dart';
import 'package:edusenseai/services/tutor_service.dart';

class FakeTutorService implements TutorService {
  bool shouldThrow = false;
  String? lastQuestionAsked;

  List<ConversationModel> fakeConversations = [
    ConversationModel(
      id: 'c-1',
      title: 'Navigation & Routing',
      subjectName: 'Mobile Dev',
      subjectCode: 'CS304',
      updatedAt: DateTime.now(),
      messagesCount: 2,
    ),
  ];

  @override
  Future<AskTutorResponse> askQuestion({
    required String question,
    String? subjectId,
    String? subjectCode,
    String? conversationId,
    String? learnerLevel,
    String? mode,
    String? responseLanguage,
    Map<String, dynamic>? learnerProfile,
  }) async {
    lastQuestionAsked = question;
    if (shouldThrow) {
      throw NetworkException('Connection to AI Tutor timed out.');
    }

    final msg = ChatMessageModel(
      id: 'tutor-response-1',
      role: MessageRole.tutor,
      text:
          'Navigation in Flutter is handled by the Navigator widget and route stacks.',
      timestamp: DateTime.now(),
      sources: const [
        ChatSourceModel(
          documentId: 'doc-1',
          fileName: 'Lecture_Navigation.pdf',
          page: 8,
          snippet: 'Navigator.push pushes a new route.',
        ),
      ],
      followUp: const ['What is named routes?'],
    );

    return AskTutorResponse(
      conversationId: conversationId ?? 'conv-session-99',
      message: msg,
    );
  }

  @override
  Future<List<ConversationModel>> getConversations() async {
    return fakeConversations;
  }

  @override
  Future<List<ChatMessageModel>> getConversation(String conversationId) async {
    return [
      ChatMessageModel.student(text: 'How does Navigator work?'),
      ChatMessageModel(
        id: 't-1',
        role: MessageRole.tutor,
        text: 'Navigator manages a stack of Route objects.',
        timestamp: DateTime.fromMillisecondsSinceEpoch(0),
      ),
    ];
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    fakeConversations.removeWhere((c) => c.id == conversationId);
  }

  @override
  Future<bool> submitFeedback({
    required String question,
    required String answer,
    required bool isThumbsUp,
    String? comment,
    String? subjectId,
  }) async {
    return true;
  }
}

class FakeQuizService implements QuizService {
  bool shouldThrow = false;

  @override
  Future<List<QuizModel>> getQuizzes({String? subjectId}) async {
    if (shouldThrow) throw NetworkException('Failed to load quizzes');
    return [
      const QuizModel(
        id: 'quiz-101',
        title: 'Midterm Practice Quiz',
        subjectCode: 'CS304',
        questions: [],
      ),
    ];
  }

  @override
  Future<QuizModel> getQuiz(String quizId) async {
    return const QuizModel(id: 'quiz-101', title: 'Midterm Practice Quiz');
  }

  @override
  Future<QuizAttemptResult> submitAttempt(
    String quizId,
    dynamic answers,
  ) async {
    return const QuizAttemptResult(
      attemptId: 'att-1',
      score: 100,
      correctCount: 5,
      totalQuestions: 5,
    );
  }
}

class FakeDocumentServiceForLearning implements DocumentService {
  @override
  Future<List<DocumentModel>> getDocuments({
    String? status,
    String? subjectId,
  }) async {
    return [
      const DocumentModel(
        id: 'doc-101',
        fileName: 'CS304_Syllabus.pdf',
        fileUrl: 'http://docs.com/syllabus.pdf',
        status: 'approved',
        chunkCount: 12,
        subjectCode: 'CS304',
      ),
    ];
  }

  @override
  Future<DocumentModel> approveDocument(String id) async =>
      throw UnimplementedError();

  @override
  Future<DocumentModel> rejectDocument(String id) async =>
      throw UnimplementedError();
}

void main() {
  group('Phase 4 ChatProvider & SubjectLearningProvider Tests', () {
    test(
      'ChatProvider.sendMessage adds student turn, calls RAG service, and sets answer',
      () async {
        final fakeTutor = FakeTutorService();
        final provider = ChatProvider(tutorService: fakeTutor);

        expect(provider.messages.isEmpty, isTrue);

        await provider.sendMessage('How does Flutter navigation work?');

        expect(
          fakeTutor.lastQuestionAsked,
          'How does Flutter navigation work?',
        );
        expect(provider.messages.length, 2);
        expect(provider.messages.first.isStudent, isTrue);
        expect(
          provider.messages.first.text,
          'How does Flutter navigation work?',
        );
        expect(provider.messages.last.isTutor, isTrue);
        expect(provider.messages.last.text, contains('Navigation in Flutter'));
        expect(provider.messages.last.sources.length, 1);
        expect(provider.currentConversationId, 'conv-session-99');
        expect(provider.isLoading, isFalse);
      },
    );

    test(
      'ChatProvider.sendMessage handles network failure and allows retry',
      () async {
        final fakeTutor = FakeTutorService()..shouldThrow = true;
        final provider = ChatProvider(tutorService: fakeTutor);

        await provider.sendMessage('Explain stateful widgets.');

        expect(provider.isLoading, isFalse);
        expect(provider.errorMessage, isNotNull);
        expect(provider.canRetry, isTrue);
        expect(provider.messages.last.hasError, isTrue);

        // Fix error and retry
        fakeTutor.shouldThrow = false;
        await provider.retryLastMessage();

        expect(provider.errorMessage, isNull);
        expect(provider.messages.last.isTutor, isTrue);
        expect(provider.messages.last.hasError, isFalse);
      },
    );

    test('ChatProvider conversation session management', () async {
      final fakeTutor = FakeTutorService();
      final provider = ChatProvider(tutorService: fakeTutor);

      await provider.loadConversations();
      expect(provider.conversations.length, 1);

      await provider.selectConversation(provider.conversations.first);
      expect(provider.currentConversationId, 'c-1');
      expect(provider.messages.length, 2);

      await provider.deleteConversation('c-1');
      expect(provider.conversations.isEmpty, isTrue);
      expect(provider.messages.isEmpty, isTrue);
    });

    test(
      'SubjectLearningProvider loads materials and quizzes concurrently',
      () async {
        const subject = SubjectModel(
          id: 'subj-1',
          name: 'Mobile App Development',
          code: 'CS304',
          semester: 5,
          departmentId: 'CE',
          faculty: 'Dr. Smith',
        );

        final provider = SubjectLearningProvider(
          documentService: FakeDocumentServiceForLearning(),
          quizService: FakeQuizService(),
        );

        await provider.loadSubjectContent(subject);

        expect(provider.isLoading, isFalse);
        expect(provider.errorMessage, isNull);
        expect(provider.materials.length, 1);
        expect(provider.materials.first.fileName, 'CS304_Syllabus.pdf');
        expect(provider.quizzes.length, 1);
        expect(provider.quizzes.first.title, 'Midterm Practice Quiz');
      },
    );
  });
}
