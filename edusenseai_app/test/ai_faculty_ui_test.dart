import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:edusenseai/features/faculty/ai_faculty_screen.dart';
import 'package:edusenseai/providers/ai_faculty_provider.dart';
import 'ai_faculty_provider_test.dart';

Widget createAiFacultyTestHarness({
  required Widget child,
  AiFacultyProvider? provider,
}) {
  final prov =
      provider ??
      AiFacultyProvider(service: MockAiFacultyServiceForProvider());

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AiFacultyProvider>.value(value: prov),
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  group('Phase 7 AiFacultyScreen UI & Interaction Tests', () {
    testWidgets('AiFacultyScreen renders avatar stage, title, and controls', (
      tester,
    ) async {
      final prov = AiFacultyProvider(service: MockAiFacultyServiceForProvider());

      await tester.pumpWidget(
        createAiFacultyTestHarness(
          child: const AiFacultyScreen(
            initialSubjectCode: 'CSUC501',
            initialSubjectName: 'Operating Systems',
          ),
          provider: prov,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Top Bar Elements
      expect(find.text('Prof. Anushka Sharma'), findsOneWidget);
      expect(find.textContaining('CSUC501 • Operating Systems'), findsOneWidget);
      expect(find.text('EN (English)'), findsOneWidget);
      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
      expect(find.byIcon(Icons.call_end_rounded), findsOneWidget);

      // Avatar Stage Elements
      expect(find.text('Tavus Call'), findsOneWidget);
      expect(find.text('Senior AI Faculty'), findsOneWidget);

      // Quick Chips
      expect(find.text('Explain Simpler'), findsOneWidget);
      expect(find.text('Give Example'), findsOneWidget);
      expect(find.text('Step-by-Step'), findsOneWidget);
      expect(find.text('Quiz Me'), findsOneWidget);

      await prov.endSession();
      await tester.pump();
    });

    testWidgets('Submitting a question adds student turn and receives faculty answer', (
      tester,
    ) async {
      final prov = AiFacultyProvider(service: MockAiFacultyServiceForProvider());

      await tester.pumpWidget(
        createAiFacultyTestHarness(
          child: const AiFacultyScreen(
            initialSubjectCode: 'CSUC501',
            initialSubjectName: 'Operating Systems',
          ),
          provider: prov,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Enter question in text field
      final textField = find.byType(TextField);
      expect(textField, findsOneWidget);
      await tester.enterText(textField, 'Explain page fault handling');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      // Tap send button
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify student message appears in transcript
      expect(find.text('Explain page fault handling'), findsOneWidget);

      // Verify faculty response appears in live caption and transcript
      expect(find.textContaining('Virtual memory separates user logical memory'), findsNWidgets(2));
      expect(find.textContaining('Operating_Systems_Ch9.pdf'), findsOneWidget);

      await prov.endSession();
      await tester.pump();
    });

    testWidgets('Barge-in: Interrupt button halts teacher speech', (
      tester,
    ) async {
      final prov = AiFacultyProvider(service: MockAiFacultyServiceForProvider());

      await tester.pumpWidget(
        createAiFacultyTestHarness(
          child: const AiFacultyScreen(
            initialSubjectCode: 'CSUC501',
          ),
          provider: prov,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // When session loads, greeting makes teacher speak
      expect(find.text('Interrupt'), findsOneWidget);

      // Tap Interrupt button
      await tester.tap(find.text('Interrupt'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // SnackBar shows interrupted feedback
      expect(find.text('Interrupted! Teacher paused speaking.'), findsOneWidget);

      await prov.endSession();
      await tester.pump();
    });

    testWidgets('Mute audio toggle updates audio icon', (
      tester,
    ) async {
      final prov = AiFacultyProvider(service: MockAiFacultyServiceForProvider());

      await tester.pumpWidget(
        createAiFacultyTestHarness(
          child: const AiFacultyScreen(
            initialSubjectCode: 'CSUC501',
          ),
          provider: prov,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);

      // Tap Mute
      await tester.tap(find.byIcon(Icons.volume_up_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);

      await prov.endSession();
      await tester.pump();
    });
  });
}
