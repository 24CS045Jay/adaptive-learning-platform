import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../admin/admin_home_screen.dart';
import '../auth/access_denied_screen.dart';
import '../auth/change_password_screen.dart';
import '../auth/login_screen.dart';
import '../faculty/faculty_home_screen.dart';
import '../splash/splash_screen.dart';
import '../student/student_home_screen.dart';

/// Central navigation dispatcher that routes users to the appropriate
/// screen based on backend-verified authentication state and role.
class RoleRouter extends StatefulWidget {
  final bool autoRestore;

  const RoleRouter({super.key, this.autoRestore = true});

  @override
  State<RoleRouter> createState() => _RoleRouterState();
}

class _RoleRouterState extends State<RoleRouter> {
  @override
  void initState() {
    super.initState();
    if (widget.autoRestore) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final authProvider = context.read<AuthProvider>();
        if (authProvider.status == AuthStatus.initial) {
          authProvider.restoreSession();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    switch (authProvider.status) {
      case AuthStatus.initial:
      case AuthStatus.checkingSession:
        return const SplashScreen(autoRestore: false);

      case AuthStatus.authenticated:
        final user = authProvider.user;
        if (user == null) {
          return const LoginScreen();
        }

        // If user must change temporary default password, enforce change screen
        if (user.mustChangePassword) {
          return const ChangePasswordScreen(isMandatory: true);
        }

        // Backend is the single source of truth for authorization
        if (user.isStudent) {
          return const StudentHomeScreen();
        } else if (user.isFaculty) {
          return const FacultyHomeScreen();
        } else if (user.isAdmin) {
          // Supports both 'admin' and 'super_admin' roles
          return const AdminHomeScreen();
        } else {
          // Role is unknown, unassigned, or unauthorized
          return AccessDeniedScreen(unrecognizedRole: user.role);
        }

      case AuthStatus.unauthenticated:
      case AuthStatus.error:
        return const LoginScreen();
    }
  }
}
