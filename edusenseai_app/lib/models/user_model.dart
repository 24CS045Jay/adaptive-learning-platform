/// User roles supported by the EduSense AI backend.
enum UserRole {
  student,
  faculty,
  admin,
  superAdmin,
  unknown;

  static UserRole fromString(String? role) {
    if (role == null) return UserRole.unknown;
    switch (role.trim().toLowerCase()) {
      case 'student':
        return UserRole.student;
      case 'faculty':
        return UserRole.faculty;
      case 'admin':
        return UserRole.admin;
      case 'super_admin':
      case 'superadmin':
        return UserRole.superAdmin;
      default:
        return UserRole.unknown;
    }
  }

  String toBackendString() {
    switch (this) {
      case UserRole.student:
        return 'student';
      case UserRole.faculty:
        return 'faculty';
      case UserRole.admin:
        return 'admin';
      case UserRole.superAdmin:
        return 'super_admin';
      case UserRole.unknown:
        return 'unknown';
    }
  }

  String get displayName {
    switch (this) {
      case UserRole.student:
        return 'Student';
      case UserRole.faculty:
        return 'Faculty Member';
      case UserRole.admin:
        return 'Administrator';
      case UserRole.superAdmin:
        return 'Super Administrator';
      case UserRole.unknown:
        return 'User';
    }
  }
}

/// Strongly typed user profile returned by EduSense AI backend.
class UserModel {
  final String id;
  final String name;
  final String email;
  final String role;
  final String departmentId;
  final bool mustChangePassword;
  final String? studentId;
  final String? facultyId;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.departmentId = 'CE',
    this.mustChangePassword = false,
    this.studentId,
    this.facultyId,
  });

  UserRole get parsedRole => UserRole.fromString(role);

  bool get isStudent => parsedRole == UserRole.student;
  bool get isFaculty => parsedRole == UserRole.faculty;
  bool get isAdmin =>
      parsedRole == UserRole.admin || parsedRole == UserRole.superAdmin;
  bool get isSuperAdmin => parsedRole == UserRole.superAdmin;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'User',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString().toLowerCase() ?? 'student',
      departmentId:
          json['departmentId']?.toString() ??
          json['department_id']?.toString() ??
          'CE',
      mustChangePassword:
          json['mustChangePassword'] == true ||
          json['must_change_password'] == true,
      studentId:
          json['studentId']?.toString() ?? json['student_id']?.toString(),
      facultyId:
          json['facultyId']?.toString() ?? json['faculty_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'departmentId': departmentId,
      'mustChangePassword': mustChangePassword,
      'studentId': studentId,
      'facultyId': facultyId,
    };
  }

  UserModel copyWith({
    String? id,
    String? name,
    String? email,
    String? role,
    String? departmentId,
    bool? mustChangePassword,
    String? studentId,
    String? facultyId,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      role: role ?? this.role,
      departmentId: departmentId ?? this.departmentId,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      studentId: studentId ?? this.studentId,
      facultyId: facultyId ?? this.facultyId,
    );
  }
}
