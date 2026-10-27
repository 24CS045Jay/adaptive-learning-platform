/// Meeting booking and office hour session model matching backend /api/meetings schema.
class MeetingBookingModel {
  final String id;
  final String slotId;
  final String facultyId;
  final String facultyName;
  final String studentId;
  final String studentName;
  final String studentEmail;
  final String subjectCode;
  final String subjectName;
  final String topic;
  final String doubtDescription;
  final DateTime? startTime;
  final DateTime? endTime;
  final int durationMinutes;
  final String
  status; // 'requested' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  final String? teamsJoinUrl;
  final String? rejectionReason;
  final String? facultyNotes;

  const MeetingBookingModel({
    required this.id,
    required this.slotId,
    required this.facultyId,
    required this.facultyName,
    required this.studentId,
    required this.studentName,
    this.studentEmail = '',
    this.subjectCode = 'GENERAL',
    this.subjectName = 'Course Subject',
    required this.topic,
    this.doubtDescription = '',
    this.startTime,
    this.endTime,
    this.durationMinutes = 30,
    this.status = 'requested',
    this.teamsJoinUrl,
    this.rejectionReason,
    this.facultyNotes,
  });

  bool get isApproved => status.toLowerCase() == 'approved';
  bool get isRequested => status.toLowerCase() == 'requested';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isCancelled => status.toLowerCase() == 'cancelled';
  bool get isCompleted => status.toLowerCase() == 'completed';

  factory MeetingBookingModel.fromJson(Map<String, dynamic> json) {
    DateTime? start;
    if (json['startTime'] != null) {
      start = DateTime.tryParse(json['startTime'].toString());
    }

    DateTime? end;
    if (json['endTime'] != null) {
      end = DateTime.tryParse(json['endTime'].toString());
    }

    return MeetingBookingModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      slotId: (json['slotId'] ?? '').toString(),
      facultyId: (json['facultyId'] ?? '').toString(),
      facultyName: (json['facultyName'] ?? 'Faculty Member').toString(),
      studentId: (json['studentId'] ?? '').toString(),
      studentName: (json['studentName'] ?? 'Student').toString(),
      studentEmail: (json['studentEmail'] ?? '').toString(),
      subjectCode: (json['subjectCode'] ?? 'GENERAL').toString(),
      subjectName: (json['subjectName'] ?? 'Course Subject').toString(),
      topic: (json['topic'] ?? 'Doubt Consultation').toString(),
      doubtDescription: (json['doubtDescription'] ?? '').toString(),
      startTime: start,
      endTime: end,
      durationMinutes:
          (json['durationMinutes'] is num)
              ? (json['durationMinutes'] as num).toInt()
              : 30,
      status: (json['status'] ?? 'requested').toString().toLowerCase(),
      teamsJoinUrl: json['teamsJoinUrl']?.toString(),
      rejectionReason: json['rejectionReason']?.toString(),
      facultyNotes: json['facultyNotes']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'slotId': slotId,
      'facultyId': facultyId,
      'facultyName': facultyName,
      'studentId': studentId,
      'studentName': studentName,
      'studentEmail': studentEmail,
      'subjectCode': subjectCode,
      'subjectName': subjectName,
      'topic': topic,
      'doubtDescription': doubtDescription,
      'startTime': startTime?.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'durationMinutes': durationMinutes,
      'status': status,
      'teamsJoinUrl': teamsJoinUrl,
      'rejectionReason': rejectionReason,
      'facultyNotes': facultyNotes,
    };
  }
}
