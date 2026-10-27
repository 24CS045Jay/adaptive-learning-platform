import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/practice_quiz_model.dart';
import '../../providers/adaptive_learning_provider.dart';

/// Interactive AI-Generated Practice Assessment & Quiz Runner.
class QuizRunnerScreen extends StatefulWidget {
  final String? initialTopic;
  final String? subjectId;
  final String? quizId;
  final String difficulty;

  const QuizRunnerScreen({
    super.key,
    this.initialTopic,
    this.subjectId,
    this.quizId,
    this.difficulty = 'medium',
  });

  @override
  State<QuizRunnerScreen> createState() => _QuizRunnerScreenState();
}

class _QuizRunnerScreenState extends State<QuizRunnerScreen> {
  int _currentIndex = 0;
  final Map<String, dynamic> _selectedAnswers = {};
  bool _isSubmitted = false;
  PracticeSubmissionResult? _result;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQuiz();
    });
  }

  void _loadQuiz() {
    final prov = context.read<AdaptiveLearningProvider>();
    prov.loadPracticeQuiz(
      topic: widget.initialTopic,
      subjectId: widget.subjectId,
      difficulty: widget.difficulty,
    );
  }

  Future<void> _submitQuiz(PracticeQuizModel quiz) async {
    final prov = context.read<AdaptiveLearningProvider>();
    final res = await prov.submitAssessment(
      quiz: quiz,
      answers: _selectedAnswers,
      quizId: widget.quizId,
    );

    if (mounted && res != null) {
      setState(() {
        _isSubmitted = true;
        _result = res;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AdaptiveLearningProvider>();
    final quiz = prov.currentPracticeQuiz;

    return PopScope(
      canPop: _isSubmitted || (quiz == null || quiz.questions.isEmpty),
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder:
              (ctx) => AlertDialog(
                title: const Text('Exit Assessment?'),
                content: const Text(
                  'Your current progress on this practice assessment will be lost.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Stay'),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Exit'),
                  ),
                ],
              ),
        );
        if (shouldExit == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: AppColors.primaryNavy,
          foregroundColor: Colors.white,
          elevation: 0,
          title: Text(
            widget.initialTopic ?? quiz?.topic ?? 'Practice Assessment',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          actions: [
            Container(
              margin: const EdgeInsets.only(right: 14),
              alignment: Alignment.center,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentCyan.withAlpha(30),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.difficulty.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.accentCyan,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
        body:
            prov.isPracticeLoading
                ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(color: AppColors.accentCyan),
                      SizedBox(height: 16),
                      Text(
                        'Generating practice questions from syllabus...',
                        style: TextStyle(
                          color: AppColors.slate500,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                )
                : quiz == null || quiz.questions.isEmpty
                ? _buildEmptyQuestionsState()
                : _isSubmitted
                ? _buildReviewScreen(quiz)
                : _buildQuestionRunner(quiz, prov),
      ),
    );
  }

  Widget _buildEmptyQuestionsState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.quiz_outlined,
              size: 54,
              color: AppColors.slate400,
            ),
            const SizedBox(height: 16),
            const Text(
              'No Questions Available',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.primaryNavy,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'No faculty assessment questions have been tagged for this topic yet. You can ask the AI Tutor to explain this concept in the meantime.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.slate500),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryNavy,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back, size: 16),
              label: const Text('Back to Analytics'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionRunner(
    PracticeQuizModel quiz,
    AdaptiveLearningProvider prov,
  ) {
    final questions = quiz.questions;
    final q = questions[_currentIndex];
    final selectedOption = _selectedAnswers[q.id];

    return Column(
      children: [
        // Progress header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.white,
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Question ${_currentIndex + 1} of ${questions.length}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryNavy,
                    ),
                  ),
                  Text(
                    '${_selectedAnswers.length}/${questions.length} Answered',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (_currentIndex + 1) / questions.length,
                  minHeight: 6,
                  backgroundColor: AppColors.slate100,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.accentCyan,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Question Content
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.slate200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.slate100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          q.topicTag,
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.deepSlate,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        q.question,
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryNavy,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Options List
                ...q.options.asMap().entries.map((entry) {
                  final optIndex = entry.key;
                  final optText = entry.value;
                  final isSelected =
                      selectedOption == optText ||
                      selectedOption == '$optIndex';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () {
                        setState(() {
                          _selectedAnswers[q.id] = optText;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color:
                              isSelected
                                  ? AppColors.primaryNavy.withAlpha(8)
                                  : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color:
                                isSelected
                                    ? AppColors.primaryNavy
                                    : AppColors.slate200,
                            width: isSelected ? 1.5 : 1.0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    isSelected
                                        ? AppColors.primaryNavy
                                        : Colors.white,
                                border: Border.all(
                                  color:
                                      isSelected
                                          ? AppColors.primaryNavy
                                          : AppColors.slate400,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                String.fromCharCode(65 + optIndex),
                                style: TextStyle(
                                  color:
                                      isSelected
                                          ? Colors.white
                                          : AppColors.deepSlate,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                optText,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight:
                                      isSelected
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                  color:
                                      isSelected
                                          ? AppColors.primaryNavy
                                          : const Color(0xFF1E293B),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),

        // Bottom Navigation Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: AppColors.slate200)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primaryNavy,
                  side: const BorderSide(color: AppColors.slate300),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                ),
                onPressed:
                    _currentIndex > 0
                        ? () => setState(() => _currentIndex--)
                        : null,
                icon: const Icon(Icons.arrow_back, size: 14),
                label: const Text('Previous'),
              ),
              if (_currentIndex < questions.length - 1)
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 10,
                    ),
                  ),
                  onPressed: () => setState(() => _currentIndex++),
                  label: const Text('Next'),
                  icon: const Icon(Icons.arrow_forward, size: 14),
                )
              else
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 10,
                    ),
                  ),
                  onPressed:
                      prov.isLoading ? null : () => _submitQuiz(quiz),
                  icon:
                      prov.isLoading
                          ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.check_circle, size: 16),
                  label: Text(
                    prov.isLoading ? 'Grading...' : 'Submit Assessment',
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Review Screen ────────────────────────────────────────────────────────
  Widget _buildReviewScreen(PracticeQuizModel quiz) {
    final result = _result;
    final score = result?.score ?? 0;
    final correct = result?.correctCount ?? 0;
    final total = result?.totalQuestions ?? quiz.questions.length;
    final reviews = result?.reviews ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Score Header Card
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.slate200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(8),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color:
                      score >= 70
                          ? AppColors.success.withAlpha(20)
                          : AppColors.error.withAlpha(20),
                ),
                child: Icon(
                  score >= 70
                      ? Icons.emoji_events_rounded
                      : Icons.fitness_center_rounded,
                  size: 38,
                  color: score >= 70 ? AppColors.success : AppColors.error,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                '$score%',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: score >= 70 ? AppColors.success : AppColors.error,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$correct of $total Questions Correct',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Assessment evaluated on backend • Topic Mastery recalibrated',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.slate600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),
        const Text(
          'Question-by-Question Review',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppColors.primaryNavy,
          ),
        ),
        const SizedBox(height: 10),

        ...reviews.asMap().entries.map((entry) {
          final idx = entry.key;
          final r = entry.value;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color:
                    r.isCorrect
                        ? const Color(0xFFBBF7D0)
                        : const Color(0xFFFECACA),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      r.isCorrect
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded,
                      color: r.isCorrect ? AppColors.success : AppColors.error,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Question ${idx + 1}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color:
                            r.isCorrect ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  r.questionText,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Your Answer: ${r.selectedAnswer}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: r.isCorrect ? AppColors.success : AppColors.error,
                  ),
                ),
                if (!r.isCorrect && r.correctAnswer.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Correct Answer: ${r.correctAnswer}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ],
            ),
          );
        }),

        const SizedBox(height: 16),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryNavy,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          onPressed: () => Navigator.of(context).pop(),
          child: const Text(
            'Done & Return to Analytics',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}
