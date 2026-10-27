/// Subject/course model matching backend /api/subjects schema.
class SubjectModel {
  final String id;
  final String name;
  final String code;
  final int semester;
  final String departmentId;
  final String faculty;
  final String facultyEmail;
  final String? facultyId;
  final String syllabus;
  final List<String> enrolledStudentIds;

  const SubjectModel({
    required this.id,
    required this.name,
    required this.code,
    required this.semester,
    required this.departmentId,
    this.faculty = '',
    this.facultyEmail = '',
    this.facultyId,
    this.syllabus = '',
    this.enrolledStudentIds = const [],
  });

  /// Factory parser for backend JSON representation.
  factory SubjectModel.fromJson(Map<String, dynamic> json) {
    // Parse enrolled students which can be list of IDs/emails or serialized JSON
    List<String> enrolled = [];
    final rawEnrolled = json['enrolledStudentIds'];
    if (rawEnrolled is List) {
      enrolled = rawEnrolled.map((e) => e.toString().trim()).toList();
    }

    return SubjectModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      code: (json['code'] ?? '').toString().toUpperCase(),
      semester:
          (json['semester'] is num)
              ? (json['semester'] as num).toInt()
              : int.tryParse(json['semester']?.toString() ?? '1') ?? 1,
      departmentId: (json['departmentId'] ?? 'CE').toString(),
      faculty: (json['faculty'] ?? '').toString(),
      facultyEmail: (json['facultyEmail'] ?? '').toString(),
      facultyId: json['facultyId']?.toString(),
      syllabus: (json['syllabus'] ?? '').toString(),
      enrolledStudentIds: enrolled,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'semester': semester,
      'departmentId': departmentId,
      'faculty': faculty,
      'facultyEmail': facultyEmail,
      'facultyId': facultyId,
      'syllabus': syllabus,
      'enrolledStudentIds': enrolledStudentIds,
    };
  }

  /// Checks if a student is enrolled via their ID, email, or roll number.
  bool isEnrolled({String? userId, String? email, String? studentId}) {
    if (enrolledStudentIds.isEmpty) return false;
    final lowerEnrolled =
        enrolledStudentIds.map((e) => e.toLowerCase()).toSet();

    if (userId != null && lowerEnrolled.contains(userId.toLowerCase())) {
      return true;
    }
    if (email != null && lowerEnrolled.contains(email.toLowerCase())) {
      return true;
    }
    if (studentId != null && lowerEnrolled.contains(studentId.toLowerCase())) {
      return true;
    }

    return false;
  }

  SubjectModel copyWith({
    String? id,
    String? name,
    String? code,
    int? semester,
    String? departmentId,
    String? faculty,
    String? facultyEmail,
    String? facultyId,
    String? syllabus,
    List<String>? enrolledStudentIds,
  }) {
    return SubjectModel(
      id: id ?? this.id,
      name: name ?? this.name,
      code: code ?? this.code,
      semester: semester ?? this.semester,
      departmentId: departmentId ?? this.departmentId,
      faculty: faculty ?? this.faculty,
      facultyEmail: facultyEmail ?? this.facultyEmail,
      facultyId: facultyId ?? this.facultyId,
      syllabus: syllabus ?? this.syllabus,
      enrolledStudentIds: enrolledStudentIds ?? this.enrolledStudentIds,
    );
  }
}
