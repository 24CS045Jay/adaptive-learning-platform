/// Model for a single assessment question.
class QuizQuestionModel {
  final String id;
  final String questionText;
  final List<String> options;
  final String correctOption;
  final String topicTag;
  final String difficulty;

  const QuizQuestionModel({
    required this.id,
    required this.questionText,
    required this.options,
    required this.correctOption,
    this.topicTag = 'General',
    this.difficulty = 'medium',
  });

  factory QuizQuestionModel.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final List<String> options = [];
    if (rawOptions is List) {
      for (final opt in rawOptions) {
        if (opt != null) options.add(opt.toString());
      }
    }

    return QuizQuestionModel(
      id: json['id'] ?? json['_id'] ?? '',
      questionText: json['questionText'] ?? json['question'] ?? '',
      options: options,
      correctOption: json['correctOption'] ?? '',
      topicTag: json['topicTag'] ?? json['topic'] ?? 'General',
      difficulty: json['difficulty'] ?? 'medium',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'questionText': questionText,
      'options': options,
      'correctOption': correctOption,
      'topicTag': topicTag,
      'difficulty': difficulty,
    };
  }
}

/// Model for subject quizzes and assessments.
class QuizModel {
  final String id;
  final String title;
  final String? subjectId;
  final String? subjectName;
  final String? subjectCode;
  final bool isAiGenerated;
  final List<QuizQuestionModel> questions;

  const QuizModel({
    required this.id,
    required this.title,
    this.subjectId,
    this.subjectName,
    this.subjectCode,
    this.isAiGenerated = false,
    this.questions = const [],
  });

  factory QuizModel.fromJson(Map<String, dynamic> json) {
    final rawQuestions = json['questions'];
    final List<QuizQuestionModel> questions = [];
    if (rawQuestions is List) {
      for (final q in rawQuestions) {
        if (q is Map<String, dynamic>) {
          questions.add(QuizQuestionModel.fromJson(q));
        }
      }
    }

    String? subName;
    String? subCode;
    String? subId;
    if (json['subjectId'] is Map) {
      final s = json['subjectId'] as Map<String, dynamic>;
      subId = s['_id']?.toString() ?? s['id']?.toString();
      subName = s['name']?.toString();
      subCode = s['code']?.toString();
    } else if (json['subjectId'] != null) {
      subId = json['subjectId'].toString();
    }

    return QuizModel(
      id: json['id'] ?? json['_id'] ?? '',
      title: json['title'] ?? 'Subject Assessment',
      subjectId: subId,
      subjectName: subName ?? json['subjectName']?.toString(),
      subjectCode: subCode ?? json['subjectCode']?.toString(),
      isAiGenerated: json['isAiGenerated'] == true,
      questions: questions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'subjectId': subjectId,
      'isAiGenerated': isAiGenerated,
      'questions': questions.map((q) => q.toJson()).toList(),
    };
  }
}
