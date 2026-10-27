/// Student risk profile model matching backend /api/analytics/risk-profiles response.
class StudentRiskProfileModel {
  final String studentId;
  final String studentName;
  final String email;
  final String subject;
  final String trend; // 'Improving' | 'Declining' | 'Stable' | 'New'
  final String risk; // 'High' | 'Medium' | 'Low' | 'Unassessed'
  final int scorePct;
  final bool hasAttempts;
  final int weakTopicCount;

  const StudentRiskProfileModel({
    required this.studentId,
    required this.studentName,
    this.email = '',
    this.subject = 'General Curriculum',
    this.trend = 'Stable',
    this.risk = 'Low',
    this.scorePct = 0,
    this.hasAttempts = false,
    this.weakTopicCount = 0,
  });

  bool get isHighRisk => risk.toLowerCase() == 'high';
  bool get isMediumRisk => risk.toLowerCase() == 'medium';
  bool get isLowRisk => risk.toLowerCase() == 'low';

  factory StudentRiskProfileModel.fromJson(Map<String, dynamic> json) {
    return StudentRiskProfileModel(
      studentId: (json['studentId'] ?? '').toString(),
      studentName: (json['studentName'] ?? 'Student').toString(),
      email: (json['email'] ?? '').toString(),
      subject: (json['subject'] ?? 'General Curriculum').toString(),
      trend: (json['trend'] ?? 'Stable').toString(),
      risk: (json['risk'] ?? 'Low').toString(),
      scorePct:
          (json['scorePct'] is num)
              ? (json['scorePct'] as num).toInt()
              : int.tryParse(json['scorePct']?.toString() ?? '0') ?? 0,
      hasAttempts: json['hasAttempts'] == true,
      weakTopicCount:
          (json['weakTopicCount'] is num)
              ? (json['weakTopicCount'] as num).toInt()
              : int.tryParse(json['weakTopicCount']?.toString() ?? '0') ?? 0,
    );
  }
}
