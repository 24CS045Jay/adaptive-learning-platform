// Models for AI-generated practice quizzes and assessment evaluations.

class PracticeQuestion {
  final String id;
  final String question;
  final List<String> options;
  final int correctIndex;
  final String difficulty;
  final String topicTag;
  final String? explanation;

  const PracticeQuestion({
    required this.id,
    required this.question,
    required this.options,
    this.correctIndex = 0,
    this.difficulty = 'medium',
    this.topicTag = 'General',
    this.explanation,
  });

  factory PracticeQuestion.fromJson(Map<String, dynamic> json) {
    List<String> opts = [];
    if (json['options'] is List) {
      opts = (json['options'] as List).map((o) => o.toString()).toList();
    }

    int cIndex = 0;
    if (json['correctIndex'] is num) {
      cIndex = (json['correctIndex'] as num).toInt();
    } else if (json['correctOption'] is num) {
      cIndex = (json['correctOption'] as num).toInt();
    }

    return PracticeQuestion(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      question: (json['question'] ?? json['text'] ?? '').toString(),
      options: opts,
      correctIndex: cIndex,
      difficulty: (json['difficulty'] ?? 'medium').toString(),
      topicTag: (json['topicTag'] ?? json['topic'] ?? 'General').toString(),
      explanation: json['explanation']?.toString(),
    );
  }
}

class PracticeQuizModel {
  final bool success;
  final String topic;
  final String difficulty;
  final String? message;
  final List<PracticeQuestion> questions;

  const PracticeQuizModel({
    this.success = true,
    this.topic = 'General Practice',
    this.difficulty = 'medium',
    this.message,
    this.questions = const [],
  });

  factory PracticeQuizModel.fromJson(Map<String, dynamic> json) {
    List<PracticeQuestion> qList = [];
    if (json['questions'] is List) {
      qList =
          (json['questions'] as List)
              .whereType<Map<String, dynamic>>()
              .map((q) => PracticeQuestion.fromJson(q))
              .toList();
    }

    return PracticeQuizModel(
      success: json['success'] != false,
      topic: (json['topic'] ?? 'General Practice').toString(),
      difficulty: (json['difficulty'] ?? 'medium').toString(),
      message: json['message']?.toString(),
      questions: qList,
    );
  }
}

class QuestionEvaluationResult {
  final String questionId;
  final String questionText;
  final String selectedAnswer;
  final String correctAnswer;
  final bool isCorrect;
  final String topicTag;
  final String? explanation;

  const QuestionEvaluationResult({
    required this.questionId,
    required this.questionText,
    required this.selectedAnswer,
    required this.correctAnswer,
    required this.isCorrect,
    required this.topicTag,
    this.explanation,
  });
}

class PracticeSubmissionResult {
  final String attemptId;
  final int score;
  final int correctCount;
  final int totalQuestions;
  final Map<String, dynamic> topicPerformance;
  final List<QuestionEvaluationResult> reviews;

  const PracticeSubmissionResult({
    required this.attemptId,
    required this.score,
    required this.correctCount,
    required this.totalQuestions,
    this.topicPerformance = const {},
    this.reviews = const [],
  });

  factory PracticeSubmissionResult.fromJson(
    Map<String, dynamic> json, {
    List<PracticeQuestion> questions = const [],
    Map<String, dynamic> studentAnswers = const {},
  }) {
    final rawScore = json['score'];
    final score =
        rawScore is num
            ? rawScore.toInt()
            : int.tryParse(rawScore?.toString() ?? '0') ?? 0;

    final correct =
        (json['correctCount'] is num)
            ? (json['correctCount'] as num).toInt()
            : 0;

    final total =
        (json['totalQuestions'] is num)
            ? (json['totalQuestions'] as num).toInt()
            : questions.length;

    final topicPerf =
        json['topicPerformance'] is Map<String, dynamic>
            ? json['topicPerformance'] as Map<String, dynamic>
            : <String, dynamic>{};

    // Synthesize question reviews from questions + answers
    final reviews = <QuestionEvaluationResult>[];
    for (int i = 0; i < questions.length; i++) {
      final q = questions[i];
      final sel = studentAnswers[q.id]?.toString() ?? '';
      final correctOpt =
          q.correctIndex < q.options.length ? q.options[q.correctIndex] : '';
      final isCorr =
          sel.isNotEmpty && (sel == correctOpt || sel == '${q.correctIndex}');

      reviews.add(
        QuestionEvaluationResult(
          questionId: q.id,
          questionText: q.question,
          selectedAnswer: sel.isEmpty ? 'Skipped' : sel,
          correctAnswer: correctOpt,
          isCorrect: isCorr,
          topicTag: q.topicTag,
          explanation: q.explanation,
        ),
      );
    }

    return PracticeSubmissionResult(
      attemptId: (json['attemptId'] ?? json['id'] ?? '').toString(),
      score: score,
      correctCount: correct,
      totalQuestions: total,
      topicPerformance: topicPerf,
      reviews: reviews,
    );
  }
}
