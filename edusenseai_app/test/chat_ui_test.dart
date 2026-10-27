import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/chat/chat_screen.dart';
import 'package:edusenseai/features/subject/subject_detail_screen.dart';
import 'package:edusenseai/models/subject_model.dart';
import 'package:edusenseai/models/user_model.dart';
import 'package:edusenseai/providers/chat_provider.dart';
import 'package:edusenseai/providers/student_dashboard_provider.dart';
import 'package:edusenseai/providers/subject_learning_provider.dart';
import 'chat_providers_test.dart';
import 'dashboard_providers_test.dart';

void main() {
  const testStudent = UserModel(
    id: 'stu-1',
    name: 'Alice Student',
    email: 'alice@institution.edu',
    role: 'student',
    studentId: 'STU1001',
    departmentId: 'CE',
  );

  const testSubject = SubjectModel(
    id: 'subj-1',
    name: 'Mobile App Development',
    code: 'CS304',
    semester: 5,
    departmentId: 'CE',
    faculty: 'Dr. Smith',
    enrolledStudentIds: ['stu-1'],
  );

  Widget createChatTestHarness({
    required Widget child,
    ChatProvider? chatProv,
    StudentDashboardProvider? studentProv,
    SubjectLearningProvider? learningProv,
  }) {
    final cp = chatProv ?? ChatProvider(tutorService: FakeTutorService());
    final sp =
        studentProv ??
        StudentDashboardProvider(
          subjectService: FakeSubjectService(),
          documentService: FakeDocumentService(),
          adaptiveService: FakeAdaptiveService(),
          meetingService: FakeMeetingService(),
        );
    final lp =
        learningProv ??
        SubjectLearningProvider(
          documentService: FakeDocumentServiceForLearning(),
          quizService: FakeQuizService(),
        );

    // Pre-populate studentProv enrolled subjects
    sp.loadDashboard(currentUser: testStudent);

    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ChatProvider>.value(value: cp),
        ChangeNotifierProvider<StudentDashboardProvider>.value(value: sp),
        ChangeNotifierProvider<SubjectLearningProvider>.value(value: lp),
      ],
      child: MaterialApp(home: child),
    );
  }

  group('Phase 4 AI Tutor & Learning UI Tests', () {
    testWidgets('ChatScreen renders empty state with starter questions', (
      tester,
    ) async {
      await tester.pumpWidget(createChatTestHarness(child: const ChatScreen()));
      await tester.pumpAndSettle();

      expect(find.text('EduSense AI Tutor'), findsOneWidget);
      expect(find.text('Welcome to EduSense AI Tutor'), findsOneWidget);
      expect(find.text('Sample questions:'), findsOneWidget);
      expect(
        find.text('Explain the core concept and real-world application.'),
        findsOneWidget,
      );
    });

    testWidgets(
      'ChatScreen sends question and renders RAG response with citations',
      (tester) async {
        final chatProv = ChatProvider(tutorService: FakeTutorService());

        await tester.pumpWidget(
          createChatTestHarness(child: const ChatScreen(), chatProv: chatProv),
        );
        await tester.pumpAndSettle();

        // Enter query in input field
        final textField = find.byType(TextField);
        expect(textField, findsOneWidget);
        await tester.enterText(
          textField,
          'How does navigation work in Flutter?',
        );
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();

        // Verify student message and tutor markdown response
        expect(
          find.text('How does navigation work in Flutter?'),
          findsOneWidget,
        );
        expect(find.text('EduSense RAG Tutor'), findsOneWidget);
        expect(find.textContaining('Navigation in Flutter'), findsOneWidget);

        // Verify citation source chip
        expect(
          find.textContaining('Lecture_Navigation.pdf (p. 8)'),
          findsOneWidget,
        );

        // Verify follow-up suggestion pill
        expect(find.text('What is named routes?'), findsOneWidget);
      },
    );

    testWidgets('Tapping citation chip displays source snippet dialog', (
      tester,
    ) async {
      final chatProv = ChatProvider(tutorService: FakeTutorService());

      await tester.pumpWidget(
        createChatTestHarness(child: const ChatScreen(), chatProv: chatProv),
      );
      await tester.pumpAndSettle();

      // Send message
      await chatProv.sendMessage('Tell me about navigation.');
      await tester.pumpAndSettle();

      // Tap citation chip
      final citationFinder = find.textContaining('Lecture_Navigation.pdf');
      expect(citationFinder, findsOneWidget);
      await tester.tap(citationFinder);
      await tester.pumpAndSettle();

      // Verify snippet dialog
      expect(find.text('Page / Slide Number: 8'), findsOneWidget);
      expect(
        find.textContaining('Navigator.push pushes a new route'),
        findsOneWidget,
      );

      // Close dialog
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(find.text('Page / Slide Number: 8'), findsNothing);
    });

    testWidgets(
      'SubjectDetailScreen renders materials, quizzes, and Ask AI Tutor FAB',
      (tester) async {
        await tester.pumpWidget(
          createChatTestHarness(
            child: const SubjectDetailScreen(subject: testSubject),
          ),
        );
        await tester.pumpAndSettle();

        // Verify subject title and code
        expect(find.text('Mobile App Development'), findsOneWidget);
        expect(find.text('CS304 · Semester 5'), findsOneWidget);

        // Verify tabs
        expect(find.textContaining('Materials'), findsOneWidget);
        expect(find.textContaining('Quizzes'), findsOneWidget);

        // Verify material card
        expect(find.text('CS304_Syllabus.pdf'), findsOneWidget);
        expect(find.textContaining('12 Chunks'), findsOneWidget);

        // Verify FloatingActionButton
        expect(find.text('Ask AI Tutor'), findsOneWidget);
      },
    );
  });
}
