/// Model representing an eligible student for targeted faculty meeting invites.
class EligibleStudentModel {
  final String id;
  final String name;
  final String email;
  final String departmentId;
  final String enrollmentNumber;
  final int semester;

  const EligibleStudentModel({
    required this.id,
    required this.name,
    required this.email,
    this.departmentId = 'CE',
    this.enrollmentNumber = 'STU-001',
    this.semester = 5,
  });

  String get department => departmentId;

  factory EligibleStudentModel.fromJson(Map<String, dynamic> json) {
    return EligibleStudentModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      name: (json['name'] ?? 'Student').toString(),
      email: (json['email'] ?? '').toString(),
      departmentId:
          (json['departmentId'] ?? json['department'] ?? 'CE').toString(),
      enrollmentNumber:
          (json['enrollmentNumber'] ??
                  json['enrollment'] ??
                  json['studentId'] ??
                  'STU-001')
              .toString(),
      semester:
          (json['semester'] is num) ? (json['semester'] as num).toInt() : 5,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'departmentId': departmentId,
      'enrollmentNumber': enrollmentNumber,
      'semester': semester,
    };
  }
}
