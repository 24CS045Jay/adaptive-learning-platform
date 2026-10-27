import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/quiz/quiz_runner_screen.dart';
import 'package:edusenseai/models/practice_quiz_model.dart';
import 'package:edusenseai/providers/adaptive_learning_provider.dart';
import 'adaptive_learning_provider_test.dart';

Widget createQuizRunnerTestHarness({
  required Widget child,
  AdaptiveLearningProvider? provider,
}) {
  final prov =
      provider ??
      AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AdaptiveLearningProvider>.value(value: prov),
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  group('Phase 6 QuizRunnerScreen UI & Assessment Tests', () {
    testWidgets('QuizRunnerScreen loads questions and renders options', (
      tester,
    ) async {
      final prov = AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createQuizRunnerTestHarness(
          child: const QuizRunnerScreen(
            initialTopic: 'Dynamic Programming',
            difficulty: 'medium',
          ),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      // Verify Header and Topic Badge
      expect(find.text('Dynamic Programming'), findsNWidgets(2));
      expect(find.text('MEDIUM'), findsOneWidget);
      expect(find.text('Question 1 of 1'), findsOneWidget);

      // Verify Question Content
      expect(find.text('What is memoization?'), findsOneWidget);
      expect(find.text('Caching results'), findsOneWidget);
      expect(find.text('Recomputing every time'), findsOneWidget);
      expect(find.text('Submit Assessment'), findsOneWidget);
    });

    testWidgets('QuizRunnerScreen allows selecting an option and submitting', (
      tester,
    ) async {
      final prov = AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createQuizRunnerTestHarness(
          child: const QuizRunnerScreen(
            initialTopic: 'Dynamic Programming',
            difficulty: 'medium',
          ),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      // Tap option 'Caching results'
      await tester.tap(find.text('Caching results'));
      await tester.pumpAndSettle();

      // Submit assessment
      await tester.tap(find.text('Submit Assessment'));
      await tester.pumpAndSettle();

      // Verify Review Screen loaded
      expect(find.text('100%'), findsOneWidget);
      expect(find.text('1 of 1 Questions Correct'), findsOneWidget);
      expect(find.text('Question-by-Question Review'), findsOneWidget);
      expect(find.text('Your Answer: Caching results'), findsOneWidget);
      expect(find.text('Done & Return to Analytics'), findsOneWidget);
    });

    testWidgets('QuizRunnerScreen renders empty state when no questions returned', (
      tester,
    ) async {
      final mockAdaptive = EmptyPracticeAdaptiveService();
      final prov = AdaptiveLearningProvider(
        adaptiveService: mockAdaptive,
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createQuizRunnerTestHarness(
          child: const QuizRunnerScreen(
            initialTopic: 'Empty Topic',
          ),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No Questions Available'), findsOneWidget);
      expect(find.text('Back to Analytics'), findsOneWidget);
    });
  });
}

class EmptyPracticeAdaptiveService extends MockAdaptiveServiceForProvider {
  @override
  Future<PracticeQuizModel> getPracticeQuiz({
    String? topic,
    String? subjectId,
    String difficulty = 'medium',
  }) async {
    return PracticeQuizModel(
      topic: topic ?? 'Empty Topic',
      difficulty: difficulty,
      questions: const [],
    );
  }
}
