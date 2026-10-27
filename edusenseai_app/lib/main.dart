import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'features/navigation/role_router.dart';
import 'providers/adaptive_learning_provider.dart';
import 'providers/admin_dashboard_provider.dart';
import 'providers/ai_faculty_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/connectivity_provider.dart';
import 'providers/faculty_dashboard_provider.dart';
import 'providers/meeting_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/student_dashboard_provider.dart';
import 'providers/subject_learning_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EduSenseAiApp());
}

/// Root application widget for EduSense AI.
class EduSenseAiApp extends StatelessWidget {
  final ConnectivityProvider? connectivityProvider;
  final AuthProvider? authProvider;
  final StudentDashboardProvider? studentDashboardProvider;
  final FacultyDashboardProvider? facultyDashboardProvider;
  final AdminDashboardProvider? adminDashboardProvider;
  final ChatProvider? chatProvider;
  final SubjectLearningProvider? subjectLearningProvider;
  final NotificationProvider? notificationProvider;
  final MeetingProvider? meetingProvider;
  final AdaptiveLearningProvider? adaptiveLearningProvider;
  final AiFacultyProvider? aiFacultyProvider;
  final Widget? home;
  final bool autoCheck;

  const EduSenseAiApp({
    super.key,
    this.connectivityProvider,
    this.authProvider,
    this.studentDashboardProvider,
    this.facultyDashboardProvider,
    this.adminDashboardProvider,
    this.chatProvider,
    this.subjectLearningProvider,
    this.notificationProvider,
    this.meetingProvider,
    this.adaptiveLearningProvider,
    this.aiFacultyProvider,
    this.home,
    this.autoCheck = true,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ConnectivityProvider>(
          create: (_) => connectivityProvider ?? ConnectivityProvider(),
        ),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => authProvider ?? AuthProvider(),
        ),
        ChangeNotifierProvider<StudentDashboardProvider>(
          create: (_) => studentDashboardProvider ?? StudentDashboardProvider(),
        ),
        ChangeNotifierProvider<FacultyDashboardProvider>(
          create: (_) => facultyDashboardProvider ?? FacultyDashboardProvider(),
        ),
        ChangeNotifierProvider<AdminDashboardProvider>(
          create: (_) => adminDashboardProvider ?? AdminDashboardProvider(),
        ),
        ChangeNotifierProvider<ChatProvider>(
          create: (_) => chatProvider ?? ChatProvider(),
        ),
        ChangeNotifierProvider<SubjectLearningProvider>(
          create: (_) => subjectLearningProvider ?? SubjectLearningProvider(),
        ),
        ChangeNotifierProvider<NotificationProvider>(
          create: (_) => notificationProvider ?? NotificationProvider(),
        ),
        ChangeNotifierProvider<MeetingProvider>(
          create: (_) => meetingProvider ?? MeetingProvider(),
        ),
        ChangeNotifierProvider<AdaptiveLearningProvider>(
          create: (_) => adaptiveLearningProvider ?? AdaptiveLearningProvider(),
        ),
        ChangeNotifierProvider<AiFacultyProvider>(
          create: (_) => aiFacultyProvider ?? AiFacultyProvider(),
        ),
      ],
      child: MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: home ?? RoleRouter(autoRestore: autoCheck),
      ),
    );
  }
}
