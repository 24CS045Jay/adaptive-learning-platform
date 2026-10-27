import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/connectivity_provider.dart';

/// Responsive mobile welcome and foundation status screen for EduSense AI.
class WelcomeScreen extends StatefulWidget {
  final bool autoCheck;
  const WelcomeScreen({super.key, this.autoCheck = true});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  @override
  void initState() {
    super.initState();
    // Auto-probe backend connectivity on launch if enabled
    if (widget.autoCheck) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.read<ConnectivityProvider>().checkConnectivity();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: 24.0,
              vertical: 20.0,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 12),
                  _buildBrandHero(),
                  const SizedBox(height: 28),
                  _buildConnectivityCard(connectivity),
                  const SizedBox(height: 24),
                  _buildPlatformRolesSection(),
                  const SizedBox(height: 24),
                  _buildFoundationFooter(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// App logo, title, and brand tagline hero
  Widget _buildBrandHero() {
    return Column(
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withAlpha(50),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Center(
            child: Icon(Icons.school_rounded, color: Colors.white, size: 44),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          AppConfig.appName,
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.navy,
            letterSpacing: -0.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          AppConfig.appTagline,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
            height: 1.35,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// Interactive connection status card with live backend probe
  Widget _buildConnectivityCard(ConnectivityProvider connectivity) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color:
              connectivity.isConnected
                  ? AppColors.success.withAlpha(80)
                  : (connectivity.hasError
                      ? AppColors.warning.withAlpha(80)
                      : AppColors.border),
          width: 1.2,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color:
                        connectivity.isConnected
                            ? AppColors.successLight
                            : (connectivity.hasError
                                ? AppColors.warningLight
                                : AppColors.softBlue),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    connectivity.isConnected
                        ? Icons.cloud_done_rounded
                        : (connectivity.hasError
                            ? Icons.cloud_off_rounded
                            : Icons.cloud_sync_rounded),
                    color:
                        connectivity.isConnected
                            ? AppColors.success
                            : (connectivity.hasError
                                ? AppColors.warning
                                : AppColors.primary),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Backend Gateway Status',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.navy,
                        ),
                      ),
                      Text(
                        connectivity.activeBaseUrl,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24, thickness: 1, color: AppColors.divider),

            // Checking State
            if (connectivity.isChecking) ...[
              const Row(
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        AppColors.primary,
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Pinging EduSense AI backend (GET /api/health)...',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ]
            // Connected State
            else if (connectivity.isConnected) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.successLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      color: AppColors.success,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Connected to Express Backend',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.success,
                            ),
                          ),
                          Text(
                            '${connectivity.health?.service ?? "EduSense AI Platform Backend"} (${connectivity.health?.responseTimeMs ?? 0}ms latency)',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.success.withAlpha(200),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: connectivity.checkConnectivity,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Re-check Connectivity'),
              ),
            ]
            // Offline / Error State
            else ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.warningLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          color: AppColors.warning,
                          size: 18,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Backend Not Reachable',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'To test live communication from the emulator, make sure your Express server is running on the host machine:\n'
                      '  cd v1\n'
                      '  npm run dev (or node server.express.js)',
                      style: TextStyle(
                        fontSize: 11.5,
                        height: 1.35,
                        color: Colors.brown.shade800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: connectivity.checkConnectivity,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry Connection'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Platform roles overview card
  Widget _buildPlatformRolesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.0),
          child: Text(
            'Unified Portal Architecture',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textTertiary,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _buildRolePill('Student', Icons.school_outlined, AppColors.primary),
            const SizedBox(width: 8),
            _buildRolePill(
              'Faculty',
              Icons.psychology_outlined,
              AppColors.navy,
            ),
            const SizedBox(width: 8),
            _buildRolePill(
              'Admin',
              Icons.admin_panel_settings_outlined,
              const Color(0xFF7C3AED),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRolePill(String title, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withAlpha(16),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(38), width: 1),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Version and Phase 1 completion tag
  Widget _buildFoundationFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.verified_outlined, color: AppColors.primary, size: 16),
          SizedBox(width: 8),
          Flexible(
            child: Text(
              'Phase 1: Foundation & Networking Ready',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.navy,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
