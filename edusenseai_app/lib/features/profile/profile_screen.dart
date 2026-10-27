import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../auth/change_password_screen.dart';

/// Screen providing 1:1 parity with the web portal's ProfilePage (/student/profile, /faculty/profile, /admin/profile):
/// - User Identity (Avatar with initials, Name, Email, Role badge, Department)
/// - Student & Faculty Identifiers (Roll Number / Student ID / Faculty ID)
/// - Learning Style Preference for adaptive tutoring
/// - Edit Profile metadata
/// - Change Password navigation
/// - Session termination
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _identifierController;
  String _selectedDepartment = 'CSE';
  String _selectedLearningStyle = 'visual';
  bool _isEditing = false;
  bool _isSaving = false;

  static const _departments = [
    {'code': 'CSE', 'label': 'Computer Science & Engineering'},
    {'code': 'CE', 'label': 'Computer Engineering'},
    {'code': 'IT', 'label': 'Information Technology'},
    {'code': 'EC', 'label': 'Electronics & Communication'},
    {'code': 'AIML', 'label': 'AI & Machine Learning'},
  ];

  static const _learningStyles = [
    {
      'value': 'visual',
      'label': 'Visual Learner',
      'desc': 'Diagrams, charts, and structured mind-maps',
    },
    {
      'value': 'textual',
      'label': 'Textual Learner',
      'desc': 'In-depth explanations, proofs, and reading',
    },
    {
      'value': 'example-driven',
      'label': 'Example-Driven',
      'desc': 'Hands-on code snippets and real-world examples',
    },
  ];

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameController = TextEditingController(text: user?.name ?? '');
    _identifierController = TextEditingController(
      text: user?.studentId ?? user?.facultyId ?? '',
    );
    _selectedDepartment = user?.departmentId.isNotEmpty == true ? user!.departmentId : 'CSE';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _identifierController.dispose();
    super.dispose();
  }

  String _getInitials(String name) {
    if (name.trim().isEmpty) return 'U';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  Future<void> _handleSaveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    setState(() => _isSaving = true);
    final authProvider = context.read<AuthProvider>();
    final user = authProvider.user;

    if (user != null) {
      final updatedUser = user.copyWith(
        name: _nameController.text.trim(),
        departmentId: _selectedDepartment,
        studentId: user.isStudent ? _identifierController.text.trim() : null,
        facultyId: user.isFaculty ? _identifierController.text.trim() : null,
      );

      authProvider.updateUser(updatedUser);
      await Future.delayed(const Duration(milliseconds: 300));
    }

    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _isEditing = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Profile updated successfully!'),
        backgroundColor: AppColors.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('No active profile session.')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'My Profile',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit Profile',
              onPressed: () => setState(() => _isEditing = true),
            )
          else
            IconButton(
              icon: const Icon(Icons.close_rounded),
              tooltip: 'Cancel Edit',
              onPressed: () => setState(() => _isEditing = false),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Profile Header Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.divider),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withAlpha(10),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Avatar circle with initials
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: AppColors.brandGradient,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withAlpha(50),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          _getInitials(user.name),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.name,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            user.email,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              _buildRoleBadge(user),
                              const SizedBox(width: 8),
                              _buildDepartmentBadge(user.departmentId),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Edit or View Profile Details
              if (_isEditing)
                _buildEditForm()
              else ...[
                _buildInfoCard(user),
                if (user.isStudent) ...[
                  const SizedBox(height: 20),
                  _buildLearningStyleCard(),
                ],
              ],

              const SizedBox(height: 24),

              // Security & Settings Section
              const Text(
                'SECURITY & PREFERENCES',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),

              // Change Password Card
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.divider),
                ),
                child: ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(20),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.key_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  title: const Text(
                    'Change Password',
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                  ),
                  subtitle: const Text(
                    'Update your account login password',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 14,
                    color: AppColors.textTertiary,
                  ),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ChangePasswordScreen(isMandatory: false),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Sign Out Button
              OutlinedButton.icon(
                onPressed: () => _confirmSignOut(context),
                icon: const Icon(Icons.logout_rounded, size: 18, color: AppColors.error),
                label: const Text(
                  'Sign Out',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoleBadge(UserModel user) {
    Color bg = AppColors.primary.withAlpha(20);
    Color fg = AppColors.primary;
    String label = 'Student';

    if (user.isFaculty) {
      bg = AppColors.secondary.withAlpha(25);
      fg = AppColors.secondary;
      label = 'Faculty';
    } else if (user.isAdmin) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFD97706);
      label = user.isSuperAdmin ? 'Super Admin' : 'Admin';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }

  Widget _buildDepartmentBadge(String dept) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.divider),
      ),
      child: Text(
        dept,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }

  Widget _buildInfoCard(UserModel user) {
    final identifierLabel = user.isStudent
        ? 'Roll Number / Student ID'
        : user.isFaculty
            ? 'Faculty ID / Employee Code'
            : 'Admin Identity';

    final identifierValue = user.studentId ?? user.facultyId ?? 'Assigned by Institute';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        children: [
          _buildInfoRow(
            Icons.badge_outlined,
            identifierLabel,
            identifierValue.isNotEmpty ? identifierValue : 'Not specified',
          ),
          const Divider(height: 24),
          _buildInfoRow(
            Icons.apartment_rounded,
            'Department',
            user.departmentId.isNotEmpty ? user.departmentId : 'CE',
          ),
          const Divider(height: 24),
          _buildInfoRow(
            Icons.verified_user_outlined,
            'Account Status',
            user.mustChangePassword ? 'Pending Password Change' : 'Active & Verified',
            color: user.mustChangePassword ? AppColors.warning : AppColors.success,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value, {Color? color}) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: color ?? AppColors.navy,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLearningStyleCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.psychology_outlined, color: AppColors.primary, size: 20),
              SizedBox(width: 8),
              Text(
                'Adaptive Learning Style',
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Informs how the AI Tutor formats explanations and study examples for you.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          ..._learningStyles.map((style) {
            final isSelected = _selectedLearningStyle == style['value'];
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary.withAlpha(12) : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.divider,
                ),
              ),
              child: ListTile(
                dense: true,
                title: Text(
                  style['label']!,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                    color: isSelected ? AppColors.primary : AppColors.navy,
                  ),
                ),
                subtitle: Text(
                  style['desc']!,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
                trailing: isSelected
                    ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 18)
                    : null,
                onTap: () {
                  setState(() => _selectedLearningStyle = style['value']!);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Learning style updated to ${style['label']}'),
                      duration: const Duration(seconds: 1),
                    ),
                  );
                },
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildEditForm() {
    return Form(
      key: _formKey,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withAlpha(80)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Edit Profile Information',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 14),

            // Full Name
            TextFormField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Full Name',
                prefixIcon: const Icon(Icons.person_outline_rounded),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              validator: (val) => val == null || val.trim().isEmpty ? 'Name cannot be empty' : null,
            ),
            const SizedBox(height: 14),

            // Identifier
            TextFormField(
              controller: _identifierController,
              decoration: InputDecoration(
                labelText: 'ID / Roll Number',
                prefixIcon: const Icon(Icons.badge_outlined),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 14),

            // Department
            DropdownButtonFormField<String>(
              value: _selectedDepartment,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Department',
                prefixIcon: const Icon(Icons.apartment_rounded),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              items: _departments.map((d) {
                return DropdownMenuItem<String>(
                  value: d['code'],
                  child: Text(
                    '${d['code']} · ${d['label']}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedDepartment = val);
              },
            ),
            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: _isSaving ? null : _handleSaveProfile,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSaving
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                    )
                  : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmSignOut(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Are you sure you want to sign out of EduSense AI?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<AuthProvider>().logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}
