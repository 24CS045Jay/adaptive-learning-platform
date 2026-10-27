import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

/// Modal bottom sheet providing Google Sign-In and Instant Demo selection,
/// matching the web portal's GoogleSignInModal workflow.
class GoogleSignInModal extends StatefulWidget {
  final String activeRole;

  const GoogleSignInModal({super.key, required this.activeRole});

  static Future<void> show(BuildContext context, {required String activeRole}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GoogleSignInModal(activeRole: activeRole),
    );
  }

  @override
  State<GoogleSignInModal> createState() => _GoogleSignInModalState();
}

class _GoogleSignInModalState extends State<GoogleSignInModal> {
  final _customEmailController = TextEditingController();
  final _customNameController = TextEditingController();
  bool _showCustom = false;
  String? _loadingEmail;

  @override
  void dispose() {
    _customEmailController.dispose();
    _customNameController.dispose();
    super.dispose();
  }

  List<Map<String, String>> _getDemoAccounts() {
    switch (widget.activeRole.toLowerCase()) {
      case 'student':
        return [
          {
            'name': 'Aarav Patel',
            'email': 'student@charusat.edu.in',
            'avatar': 'AP',
            'password': 'student123',
          },
          {
            'name': 'Meera Joshi',
            'email': 'meera@charusat.edu.in',
            'avatar': 'MJ',
            'password': 'student123',
          },
        ];
      case 'faculty':
        return [
          {
            'name': 'Dr. Nisha Shah',
            'email': 'faculty@charusat.edu.in',
            'avatar': 'NS',
            'password': 'faculty123',
          },
          {
            'name': 'Prof. Anil Kumar',
            'email': 'anil@charusat.edu.in',
            'avatar': 'AK',
            'password': 'faculty123',
          },
        ];
      case 'admin':
      default:
        return [
          {
            'name': 'Rahul Mehta',
            'email': 'admin@charusat.edu.in',
            'avatar': 'RM',
            'password': 'admin123',
          },
        ];
    }
  }

  Future<void> _handleAccountSelect(String email, String password) async {
    setState(() => _loadingEmail = email);
    final authProvider = context.read<AuthProvider>();

    final success = await authProvider.login(
      email: email,
      password: password,
      role: widget.activeRole,
    );

    if (!mounted) return;
    setState(() => _loadingEmail = null);

    if (success) {
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            authProvider.errorMessage ?? 'Failed to authenticate with demo user.',
          ),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final accounts = _getDemoAccounts();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header title & close
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  _buildGoogleIcon(size: 22),
                  const SizedBox(width: 10),
                  const Text(
                    'Sign in with Google',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20),
                onPressed: () => Navigator.of(context).pop(),
                color: AppColors.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: 8),

          Text(
            'Select an institution account to sign in as ${widget.activeRole.toUpperCase()}:',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),

          // Demo accounts list
          ...accounts.map((acc) {
            final isCurrentLoading = _loadingEmail == acc['email'];
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap:
                    _loadingEmail != null
                        ? null
                        : () => _handleAccountSelect(
                          acc['email']!,
                          acc['password']!,
                        ),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.divider),
                    color: AppColors.surface,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(25),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            acc['avatar']!,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              acc['name']!,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              acc['email']!,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isCurrentLoading)
                        const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      else
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 14,
                          color: AppColors.textTertiary,
                        ),
                    ],
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 8),

          // Custom Account Expansion
          if (!_showCustom)
            TextButton.icon(
              onPressed: () => setState(() => _showCustom = true),
              icon: const Icon(Icons.person_add_outlined, size: 16),
              label: const Text(
                'Use another account',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            )
          else ...[
            const Divider(),
            const SizedBox(height: 8),
            TextField(
              controller: _customEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Account Email',
                hintText: 'e.g. user@charusat.edu.in',
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.divider),
                ),
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed:
                  _loadingEmail != null
                      ? null
                      : () {
                        final email = _customEmailController.text.trim();
                        if (email.isNotEmpty) {
                          _handleAccountSelect(email, 'password123');
                        }
                      },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text('Sign In with Account'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildGoogleIcon({double size = 20}) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      child: Image.network(
        'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
        width: size,
        height: size,
        errorBuilder:
            (_, __, ___) => Icon(
              Icons.g_mobiledata_rounded,
              size: size + 6,
              color: AppColors.primary,
            ),
      ),
    );
  }
}
