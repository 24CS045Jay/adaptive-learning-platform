import 'package:flutter_test/flutter_test.dart';
import 'package:edusenseai/main.dart';
import 'package:edusenseai/core/config/app_config.dart';
import 'package:edusenseai/features/welcome/welcome_screen.dart';
import 'package:edusenseai/models/health_response.dart';

void main() {
  group('Phase 1 Foundation & Architecture Tests', () {
    testWidgets(
      'EduSense AI Welcome screen renders brand, tagline, and roles',
      (WidgetTester tester) async {
        // Build EduSenseAiApp widget with autoCheck=false for pure UI testing
        await tester.pumpWidget(
          const EduSenseAiApp(
            home: WelcomeScreen(autoCheck: false),
            autoCheck: false,
          ),
        );
        await tester.pump();

        // Verify brand title and tagline
        expect(find.text(AppConfig.appName), findsOneWidget);
        expect(find.text(AppConfig.appTagline), findsOneWidget);

        // Verify status card header is displayed
        expect(find.text('Backend Gateway Status'), findsOneWidget);

        // Verify platform roles section
        expect(find.text('Unified Portal Architecture'), findsOneWidget);
        expect(find.text('Student'), findsOneWidget);
        expect(find.text('Faculty'), findsOneWidget);
        expect(find.text('Admin'), findsOneWidget);

        // Verify Phase 1 completion tag
        expect(
          find.text('Phase 1: Foundation & Networking Ready'),
          findsOneWidget,
        );
      },
    );

    test('AppConfig provides verified backend health route and timeouts', () {
      expect(AppConfig.healthEndpoint, equals('/api/health'));
      expect(AppConfig.readinessEndpoint, equals('/api/ready'));
      expect(AppConfig.appName, equals('EduSense AI'));
      expect(AppConfig.appTagline, contains('Learn Smarter'));
      expect(AppConfig.connectTimeout.inSeconds, equals(15));
      expect(AppConfig.receiveTimeout.inSeconds, equals(25));
    });

    test('HealthResponse correctly parses verified backend JSON schema', () {
      final json = {
        'status': 'ok',
        'service': 'EduSense AI Platform Backend',
        'rag_service': 'http://localhost:8001',
        'timestamp': '2026-10-21T12:00:00.000Z',
      };

      final response = HealthResponse.fromJson(json, responseTimeMs: 42);

      expect(response.isHealthy, isTrue);
      expect(response.status, equals('ok'));
      expect(response.service, equals('EduSense AI Platform Backend'));
      expect(response.ragService, equals('http://localhost:8001'));
      expect(response.responseTimeMs, equals(42));
      expect(response.timestamp, isNotNull);
    });
  });
}
