/// Institutional RAG telemetry and platform analytics model matching backend /api/analytics/telemetry response.
class TelemetryModel {
  final int totalQueries;
  final double groundingAccuracyPct;
  final int helpfulnessRatePct;
  final int totalRatings;
  final int totalUsers;
  final int studentCount;
  final int facultyCount;
  final int adminCount;

  const TelemetryModel({
    this.totalQueries = 0,
    this.groundingAccuracyPct = 0.0,
    this.helpfulnessRatePct = 0,
    this.totalRatings = 0,
    this.totalUsers = 0,
    this.studentCount = 0,
    this.facultyCount = 0,
    this.adminCount = 0,
  });

  factory TelemetryModel.fromJson(Map<String, dynamic> json) {
    final regUsers =
        json['registeredUsers'] is Map ? json['registeredUsers'] as Map : {};

    return TelemetryModel(
      totalQueries:
          (json['totalQueries'] is num)
              ? (json['totalQueries'] as num).toInt()
              : int.tryParse(json['totalQueries']?.toString() ?? '0') ?? 0,
      groundingAccuracyPct:
          (json['groundingAccuracyPct'] is num)
              ? (json['groundingAccuracyPct'] as num).toDouble()
              : double.tryParse(
                    json['groundingAccuracyPct']?.toString() ?? '0.0',
                  ) ??
                  0.0,
      helpfulnessRatePct:
          (json['helpfulnessRatePct'] is num)
              ? (json['helpfulnessRatePct'] as num).toInt()
              : int.tryParse(json['helpfulnessRatePct']?.toString() ?? '0') ??
                  0,
      totalRatings:
          (json['totalRatings'] is num)
              ? (json['totalRatings'] as num).toInt()
              : int.tryParse(json['totalRatings']?.toString() ?? '0') ?? 0,
      totalUsers:
          (regUsers['total'] is num)
              ? (regUsers['total'] as num).toInt()
              : int.tryParse(regUsers['total']?.toString() ?? '0') ?? 0,
      studentCount:
          (regUsers['students'] is num)
              ? (regUsers['students'] as num).toInt()
              : int.tryParse(regUsers['students']?.toString() ?? '0') ?? 0,
      facultyCount:
          (regUsers['faculty'] is num)
              ? (regUsers['faculty'] as num).toInt()
              : int.tryParse(regUsers['faculty']?.toString() ?? '0') ?? 0,
      adminCount:
          (regUsers['admins'] is num)
              ? (regUsers['admins'] as num).toInt()
              : int.tryParse(regUsers['admins']?.toString() ?? '0') ?? 0,
    );
  }
}
