// Adaptive learner profile model matching backend /api/adaptive/profile response.

class LearnerPreferences {
  final String studentId;
  final String explanationLevel; // 'beginner' | 'intermediate' | 'developing' | 'proficient' | 'advanced'
  final String preferredLanguage; // 'en' | 'hi' | 'gu'
  final String preferredTeachingMode; // 'ask_tutor' | 'socratic' | 'quiz'
  final int dailyGoalMinutes;
  final bool enableSpacedRepetition;

  const LearnerPreferences({
    this.studentId = '',
    this.explanationLevel = 'intermediate',
    this.preferredLanguage = 'en',
    this.preferredTeachingMode = 'ask_tutor',
    this.dailyGoalMinutes = 30,
    this.enableSpacedRepetition = true,
  });

  factory LearnerPreferences.fromJson(Map<String, dynamic> json) {
    return LearnerPreferences(
      studentId: (json['studentId'] ?? '').toString(),
      explanationLevel: (json['explanationLevel'] ?? 'intermediate').toString(),
      preferredLanguage: (json['preferredLanguage'] ?? 'en').toString(),
      preferredTeachingMode:
          (json['preferredTeachingMode'] ?? 'ask_tutor').toString(),
      dailyGoalMinutes:
          (json['dailyGoalMinutes'] is num)
              ? (json['dailyGoalMinutes'] as num).toInt()
              : int.tryParse(json['dailyGoalMinutes']?.toString() ?? '30') ??
                  30,
      enableSpacedRepetition: json['enableSpacedRepetition'] != false,
    );
  }

  Map<String, dynamic> toJson() => {
    'explanationLevel': explanationLevel,
    'preferredLanguage': preferredLanguage,
    'preferredTeachingMode': preferredTeachingMode,
    'dailyGoalMinutes': dailyGoalMinutes,
    'enableSpacedRepetition': enableSpacedRepetition,
  };
}

class LearnerKnowledgeProfile {
  final String studentId;
  final String estimatedMasteryLevel; // 'beginner' | 'developing' | 'proficient' | 'advanced'
  final List<String> conceptsDemonstrated;
  final List<String> conceptsNeedingPractice;
  final List<int> recentQuizScores;
  final double confidence;

  const LearnerKnowledgeProfile({
    this.studentId = '',
    this.estimatedMasteryLevel = 'developing',
    this.conceptsDemonstrated = const [],
    this.conceptsNeedingPractice = const [],
    this.recentQuizScores = const [],
    this.confidence = 0.5,
  });

  factory LearnerKnowledgeProfile.fromJson(Map<String, dynamic> json) {
    List<String> demonstrated = [];
    if (json['concepts_demonstrated'] is List) {
      demonstrated =
          (json['concepts_demonstrated'] as List)
              .map((e) => e.toString())
              .toList();
    }

    List<String> needing = [];
    if (json['concepts_needing_practice'] is List) {
      needing =
          (json['concepts_needing_practice'] as List)
              .map((e) => e.toString())
              .toList();
    }

    List<int> scores = [];
    if (json['recent_quiz_scores'] is List) {
      scores =
          (json['recent_quiz_scores'] as List)
              .whereType<num>()
              .map((e) => e.toInt())
              .toList();
    }

    return LearnerKnowledgeProfile(
      studentId: (json['student_id'] ?? '').toString(),
      estimatedMasteryLevel:
          (json['estimated_mastery_level'] ?? 'developing').toString(),
      conceptsDemonstrated: demonstrated,
      conceptsNeedingPractice: needing,
      recentQuizScores: scores,
      confidence:
          (json['confidence_in_mastery_estimate'] is num)
              ? (json['confidence_in_mastery_estimate'] as num).toDouble()
              : 0.5,
    );
  }
}

class TopicMasteryItem {
  final String id;
  final String? subjectId;
  final String topic;
  final int score;
  final int totalAttempts;
  final String
  status; // 'strong' | 'developing' | 'needs_practice' | 'insufficient_data'
  final String masteryLabel;
  final DateTime? lastEvaluated;

  const TopicMasteryItem({
    this.id = '',
    this.subjectId,
    required this.topic,
    required this.score,
    this.totalAttempts = 0,
    this.status = 'insufficient_data',
    this.masteryLabel = 'proficient',
    this.lastEvaluated,
  });

  bool get isWeak => status == 'needs_practice' || (totalAttempts >= 2 && score < 60);
  bool get isMastered => status == 'strong' || (totalAttempts >= 2 && score >= 80);
  bool get isDeveloping => status == 'developing';
  bool get isInsufficientData => totalAttempts < 2;

  factory TopicMasteryItem.fromJson(Map<String, dynamic> json) {
    DateTime? lastEval;
    if (json['lastEvaluated'] != null) {
      lastEval = DateTime.tryParse(json['lastEvaluated'].toString());
    }

    return TopicMasteryItem(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      subjectId: json['subjectId']?.toString(),
      topic: (json['topic'] ?? '').toString(),
      score:
          (json['score'] is num)
              ? (json['score'] as num).toInt()
              : int.tryParse(json['score']?.toString() ?? '0') ?? 0,
      totalAttempts:
          (json['totalAttempts'] is num)
              ? (json['totalAttempts'] as num).toInt()
              : int.tryParse(json['totalAttempts']?.toString() ?? '0') ?? 0,
      status: (json['status'] ?? 'insufficient_data').toString(),
      masteryLabel: (json['masteryLabel'] ?? 'proficient').toString(),
      lastEvaluated: lastEval,
    );
  }
}

class AdaptiveProfileModel {
  final bool hasData;
  final int? overallMasteryPct;
  final int totalTopicsTracked;
  final int evaluatedTopicsCount;
  final int weakCount;
  final int masteredCount;
  final int reviewDueCount;
  final String explanationLevel;
  final LearnerPreferences preferences;
  final LearnerKnowledgeProfile? knowledgeProfile;
  final List<TopicMasteryItem> topicMasteries;
  final List<TopicMasteryItem> weakTopics;
  final List<TopicMasteryItem> spacedRepetitionQueue;

  const AdaptiveProfileModel({
    this.hasData = false,
    this.overallMasteryPct,
    this.totalTopicsTracked = 0,
    this.evaluatedTopicsCount = 0,
    this.weakCount = 0,
    this.masteredCount = 0,
    this.reviewDueCount = 0,
    this.explanationLevel = 'intermediate',
    this.preferences = const LearnerPreferences(),
    this.knowledgeProfile,
    this.topicMasteries = const [],
    this.weakTopics = const [],
    this.spacedRepetitionQueue = const [],
  });

  factory AdaptiveProfileModel.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] is Map ? json['stats'] as Map : {};
    final prefsMap =
        json['preferences'] is Map
            ? json['preferences'] as Map<String, dynamic>
            : <String, dynamic>{};
    final profileMap =
        json['learnerKnowledgeProfile'] is Map
            ? json['learnerKnowledgeProfile'] as Map<String, dynamic>
            : null;

    final preferences = LearnerPreferences.fromJson(prefsMap);
    final knowledgeProfile =
        profileMap != null
            ? LearnerKnowledgeProfile.fromJson(profileMap)
            : null;

    List<TopicMasteryItem> masteries = [];
    if (json['topicMasteries'] is List) {
      masteries =
          (json['topicMasteries'] as List)
              .whereType<Map<String, dynamic>>()
              .map((m) => TopicMasteryItem.fromJson(m))
              .toList();
    }

    List<TopicMasteryItem> weak = [];
    if (json['weakTopics'] is List) {
      weak =
          (json['weakTopics'] as List)
              .whereType<Map<String, dynamic>>()
              .map((m) => TopicMasteryItem.fromJson(m))
              .toList();
    } else {
      weak = masteries.where((m) => m.isWeak).toList();
    }

    List<TopicMasteryItem> reviewQueue = [];
    if (json['spacedRepetitionQueue'] is List) {
      reviewQueue =
          (json['spacedRepetitionQueue'] as List)
              .whereType<Map<String, dynamic>>()
              .map((m) => TopicMasteryItem.fromJson(m))
              .toList();
    }

    final rawScore = stats['overallMasteryPct'];
    final int? score =
        rawScore is num
            ? rawScore.toInt()
            : int.tryParse(rawScore?.toString() ?? '');

    return AdaptiveProfileModel(
      hasData: json['hasData'] == true,
      overallMasteryPct: score,
      totalTopicsTracked:
          (stats['totalTopicsTracked'] is num)
              ? (stats['totalTopicsTracked'] as num).toInt()
              : masteries.length,
      evaluatedTopicsCount:
          (stats['evaluatedTopicsCount'] is num)
              ? (stats['evaluatedTopicsCount'] as num).toInt()
              : masteries.where((m) => m.totalAttempts >= 2).length,
      weakCount:
          (stats['weakCount'] is num)
              ? (stats['weakCount'] as num).toInt()
              : weak.length,
      masteredCount:
          (stats['masteredCount'] is num)
              ? (stats['masteredCount'] as num).toInt()
              : masteries.where((m) => m.isMastered).length,
      reviewDueCount:
          (stats['reviewDueCount'] is num)
              ? (stats['reviewDueCount'] as num).toInt()
              : reviewQueue.length,
      explanationLevel: preferences.explanationLevel,
      preferences: preferences,
      knowledgeProfile: knowledgeProfile,
      topicMasteries: masteries,
      weakTopics: weak,
      spacedRepetitionQueue: reviewQueue,
    );
  }
}
