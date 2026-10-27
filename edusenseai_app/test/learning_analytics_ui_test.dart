import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/analytics/learning_analytics_screen.dart';
import 'package:edusenseai/providers/adaptive_learning_provider.dart';
import 'adaptive_learning_provider_test.dart';

Widget createAnalyticsTestHarness({
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
  group('Phase 6 LearningAnalyticsScreen UI & Interaction Tests', () {
    testWidgets('LearningAnalyticsScreen renders mastery overview and metrics', (
      tester,
    ) async {
      final prov = AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createAnalyticsTestHarness(
          child: const LearningAnalyticsScreen(),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Personalized AI Learning'), findsOneWidget);
      expect(find.text('Overview & Mastery'), findsOneWidget);
      expect(find.text('Weak Topics & Queue'), findsOneWidget);
      expect(find.text('AI Preferences'), findsOneWidget);

      // Verify Hero Card & Stats
      expect(find.text('85%'), findsOneWidget);
      expect(find.text('Overall Mastery'), findsOneWidget);
      expect(find.text('Tracked Topics'), findsOneWidget);
      expect(find.text('Topic Mastery Breakdown'), findsOneWidget);
      expect(find.text('Sorting'), findsOneWidget);
    });

    testWidgets('LearningAnalyticsScreen renders Weak Topics tab with practice button', (
      tester,
    ) async {
      final prov = AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createAnalyticsTestHarness(
          child: const LearningAnalyticsScreen(),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'Weak Topics & Queue' tab
      await tester.tap(find.text('Weak Topics & Queue'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Topics Needing Practice'), findsOneWidget);
      expect(find.text('Dynamic Programming'), findsOneWidget);
      expect(find.text('Practice'), findsOneWidget);

      // Verify Spaced Repetition Queue
      expect(find.textContaining('Spaced Repetition Queue'), findsOneWidget);
      expect(find.text('Binary Search'), findsOneWidget);
      expect(find.text('Review Now'), findsOneWidget);
    });

    testWidgets('LearningAnalyticsScreen allows updating AI preferences', (
      tester,
    ) async {
      final prov = AdaptiveLearningProvider(
        adaptiveService: MockAdaptiveServiceForProvider(),
        quizService: MockQuizServiceForProvider(),
      );

      await tester.pumpWidget(
        createAnalyticsTestHarness(
          child: const LearningAnalyticsScreen(),
          provider: prov,
        ),
      );
      await tester.pumpAndSettle();

      // Tap 'AI Preferences' tab
      await tester.tap(find.text('AI Preferences'));
      await tester.pumpAndSettle();

      expect(find.text('Learner AI Preferences'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
      expect(find.text('हिंदी (Hindi)'), findsOneWidget);
      expect(find.text('ગુજરાતી (Gujarati)'), findsOneWidget);

      // Select Hindi
      await tester.tap(find.text('हिंदी (Hindi)'));
      await tester.pumpAndSettle();

      // Tap Save Preferences
      await tester.tap(find.text('Save Preferences'));
      await tester.pumpAndSettle();

      expect(find.text('Learning preferences updated successfully.'), findsOneWidget);
    });
  });
}
