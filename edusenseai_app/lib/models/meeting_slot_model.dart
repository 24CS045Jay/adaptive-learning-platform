/// Model representing a scheduled faculty office hour slot or direct Teams session.
class MeetingSlotModel {
  final String id;
  final String facultyId;
  final String facultyName;
  final String facultyEmail;
  final String departmentId;
  final String subjectCode;
  final String subjectName;
  final String? subjectId;
  final String topic;
  final String description;
  final String date;
  final DateTime startTime;
  final DateTime endTime;
  final int durationMinutes;
  final int capacity;
  final int bookedCount;
  final String locationType;
  final String audienceType;
  final List<String> invitedStudentIds;
  final String? teamsMeetingId;
  final String? teamsJoinUrl;
  final String status; // 'active' | 'cancelled'
  final String notes;

  const MeetingSlotModel({
    required this.id,
    required this.facultyId,
    required this.facultyName,
    this.facultyEmail = '',
    this.departmentId = 'CE',
    this.subjectCode = 'GENERAL',
    this.subjectName = 'Course Subject',
    this.subjectId,
    required this.topic,
    this.description = '',
    required this.date,
    required this.startTime,
    required this.endTime,
    this.durationMinutes = 30,
    this.capacity = 1,
    this.bookedCount = 0,
    this.locationType = 'teams',
    this.audienceType = 'department',
    this.invitedStudentIds = const [],
    this.teamsMeetingId,
    this.teamsJoinUrl,
    this.status = 'active',
    this.notes = '',
  });

  bool get isCancelled => status.toLowerCase() == 'cancelled';
  bool get isActive => status.toLowerCase() == 'active';
  bool get isFull => bookedCount >= capacity;
  bool get hasTeamsMeeting => teamsJoinUrl != null && teamsJoinUrl!.isNotEmpty;

  factory MeetingSlotModel.fromJson(Map<String, dynamic> json) {
    DateTime start = DateTime.now();
    if (json['startTime'] != null) {
      start = DateTime.tryParse(json['startTime'].toString()) ?? DateTime.now();
    }

    DateTime end = start.add(const Duration(minutes: 30));
    if (json['endTime'] != null) {
      end = DateTime.tryParse(json['endTime'].toString()) ?? end;
    }

    final rawInvited = json['invitedStudentIds'];
    final List<String> invited = [];
    if (rawInvited is List) {
      for (final id in rawInvited) {
        if (id != null) invited.add(id.toString());
      }
    }

    return MeetingSlotModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      facultyId: (json['facultyId'] ?? '').toString(),
      facultyName: (json['facultyName'] ?? 'Faculty Member').toString(),
      facultyEmail: (json['facultyEmail'] ?? '').toString(),
      departmentId: (json['departmentId'] ?? 'CE').toString(),
      subjectCode: (json['subjectCode'] ?? 'GENERAL').toString(),
      subjectName: (json['subjectName'] ?? 'Course Subject').toString(),
      subjectId: json['subjectId']?.toString(),
      topic: (json['topic'] ?? 'Office Hours').toString(),
      description: (json['description'] ?? '').toString(),
      date: (json['date'] ?? start.toIso8601String().split('T')[0]).toString(),
      startTime: start,
      endTime: end,
      durationMinutes:
          (json['durationMinutes'] is num)
              ? (json['durationMinutes'] as num).toInt()
              : 30,
      capacity:
          (json['capacity'] is num) ? (json['capacity'] as num).toInt() : 1,
      bookedCount:
          (json['bookedCount'] is num)
              ? (json['bookedCount'] as num).toInt()
              : 0,
      locationType: (json['locationType'] ?? 'teams').toString(),
      audienceType: (json['audienceType'] ?? 'department').toString(),
      invitedStudentIds: invited,
      teamsMeetingId: json['teamsMeetingId']?.toString(),
      teamsJoinUrl: json['teamsJoinUrl']?.toString(),
      status: (json['status'] ?? 'active').toString().toLowerCase(),
      notes: (json['notes'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'facultyId': facultyId,
      'facultyName': facultyName,
      'facultyEmail': facultyEmail,
      'departmentId': departmentId,
      'subjectCode': subjectCode,
      'subjectName': subjectName,
      'subjectId': subjectId,
      'topic': topic,
      'description': description,
      'date': date,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'durationMinutes': durationMinutes,
      'capacity': capacity,
      'bookedCount': bookedCount,
      'locationType': locationType,
      'audienceType': audienceType,
      'invitedStudentIds': invitedStudentIds,
      'teamsMeetingId': teamsMeetingId,
      'teamsJoinUrl': teamsJoinUrl,
      'status': status,
      'notes': notes,
    };
  }
}
