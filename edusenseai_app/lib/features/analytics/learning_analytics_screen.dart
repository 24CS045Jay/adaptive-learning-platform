import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/adaptive_profile_model.dart';
import '../../providers/adaptive_learning_provider.dart';
import '../quiz/quiz_runner_screen.dart';

/// Comprehensive Personalized Learning, Analytics & Weak-Topic Detection Screen.
class LearningAnalyticsScreen extends StatefulWidget {
  final String? initialSubjectId;

  const LearningAnalyticsScreen({super.key, this.initialSubjectId});

  @override
  State<LearningAnalyticsScreen> createState() =>
      _LearningAnalyticsScreenState();
}

class _LearningAnalyticsScreenState extends State<LearningAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedLanguage = 'en';
  String _selectedLevel = 'intermediate';
  int _selectedDailyGoal = 30;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadData({bool refresh = false}) {
    final prov = context.read<AdaptiveLearningProvider>();
    prov.loadProfile(refresh: refresh, subjectId: widget.initialSubjectId).then((
      _,
    ) {
      if (mounted) {
        final prefs = prov.preferences;
        setState(() {
          _selectedLanguage = prefs.preferredLanguage;
          _selectedLevel = prefs.explanationLevel;
          _selectedDailyGoal = prefs.dailyGoalMinutes;
        });
      }
    });
  }

  Future<void> _savePreferences() async {
    final prov = context.read<AdaptiveLearningProvider>();
    final success = await prov.updatePreferences(
      explanationLevel: _selectedLevel,
      preferredLanguage: _selectedLanguage,
      dailyGoalMinutes: _selectedDailyGoal,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Learning preferences updated successfully.'
                : 'Failed to update preferences.',
          ),
          backgroundColor: success ? AppColors.success : AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _confirmReset() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: AppColors.error),
                SizedBox(width: 8),
                Text('Reset Learning Data?'),
              ],
            ),
            content: const Text(
              'This will clear your evaluated topic masteries and reset your personalization preferences to default values. This action cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Reset Data'),
              ),
            ],
          ),
    );

    if (confirmed == true && mounted) {
      await context.read<AdaptiveLearningProvider>().resetProfile();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Learning history reset successfully.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AdaptiveLearningProvider>();
    final profile = prov.profile;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppColors.primaryNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Personalized AI Learning',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Analytics',
            onPressed: () => _loadData(refresh: true),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (val) {
              if (val == 'reset') _confirmReset();
            },
            itemBuilder:
                (ctx) => [
                  const PopupMenuItem(
                    value: 'reset',
                    child: Row(
                      children: [
                        Icon(
                          Icons.restart_alt_rounded,
                          size: 18,
                          color: AppColors.error,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Reset Learning Profile',
                          style: TextStyle(color: AppColors.error),
                        ),
                      ],
                    ),
                  ),
                ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accentCyan,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.slate300,
          labelStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          tabs: const [
            Tab(text: 'Overview & Mastery'),
            Tab(text: 'Weak Topics & Queue'),
            Tab(text: 'AI Preferences'),
          ],
        ),
      ),
      body:
          prov.isLoading && profile == null
              ? const Center(
                child: CircularProgressIndicator(color: AppColors.accentCyan),
              )
              : TabBarView(
                controller: _tabController,
                children: [
                  _buildOverviewTab(prov, profile),
                  _buildWeakTopicsTab(prov, profile),
                  _buildPreferencesTab(prov),
                ],
              ),
    );
  }

  // ── Tab 1: Overview & Mastery Breakdown ──────────────────────────────────
  Widget _buildOverviewTab(
    AdaptiveLearningProvider prov,
    AdaptiveProfileModel? profile,
  ) {
    return RefreshIndicator(
      onRefresh: () async => _loadData(refresh: true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildMasteryHeroCard(profile),
          const SizedBox(height: 16),
          _buildStatRow(profile),
          const SizedBox(height: 20),
          _buildMasteryBreakdownCard(profile),
          const SizedBox(height: 20),
          _buildRecommendationsSection(prov),
        ],
      ),
    );
  }

  Widget _buildMasteryHeroCard(AdaptiveProfileModel? profile) {
    final hasData = profile?.hasData ?? false;
    final score = profile?.overallMasteryPct;
    final kp = profile?.knowledgeProfile;
    final level = kp?.estimatedMasteryLevel ?? profile?.explanationLevel ?? 'developing';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryNavy, Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryNavy.withAlpha(50),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withAlpha(40),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.auto_awesome,
                      color: AppColors.accentCyan,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'AI Learning Profile',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.accentCyan.withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.accentCyan.withAlpha(100),
                  ),
                ),
                child: Text(
                  level.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.accentCyan,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (hasData && score != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$score%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    height: 1.0,
                  ),
                ),
                const SizedBox(width: 10),
                const Padding(
                  padding: EdgeInsets.only(bottom: 6),
                  child: Text(
                    'Overall Mastery',
                    style: TextStyle(
                      color: AppColors.slate300,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: score / 100.0,
                minHeight: 8,
                backgroundColor: Colors.white.withAlpha(30),
                valueColor: AlwaysStoppedAnimation<Color>(
                  score >= 80
                      ? AppColors.success
                      : score >= 60
                      ? AppColors.accentCyan
                      : AppColors.warning,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Estimated based on ${profile?.evaluatedTopicsCount ?? 0} evaluated topics with verified multi-attempt assessment data.',
              style: const TextStyle(
                color: AppColors.slate300,
                fontSize: 11.5,
                height: 1.35,
              ),
            ),
          ] else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  color: AppColors.accentCyan,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Calibrating Learning Profile',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Complete at least 2 quizzes or self-assessments so the AI engine can compute verified mastery metrics and weak-topic detection without guessing.',
                        style: TextStyle(
                          color: Colors.white.withAlpha(210),
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatRow(AdaptiveProfileModel? profile) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricTile(
            'Tracked Topics',
            '${profile?.totalTopicsTracked ?? 0}',
            Icons.topic_outlined,
            AppColors.primaryNavy,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricTile(
            'Mastered',
            '${profile?.masteredCount ?? 0}',
            Icons.verified_rounded,
            AppColors.success,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricTile(
            'Needs Practice',
            '${profile?.weakCount ?? 0}',
            Icons.warning_amber_rounded,
            AppColors.error,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricTile(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.slate500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMasteryBreakdownCard(AdaptiveProfileModel? profile) {
    final masteries = profile?.topicMasteries ?? [];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.bar_chart_rounded,
                    color: AppColors.primaryNavy,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Topic Mastery Breakdown',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryNavy,
                    ),
                  ),
                ],
              ),
              Text(
                '${masteries.length} topics',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.slate500,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (masteries.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              alignment: Alignment.center,
              child: const Text(
                'No topic attempts recorded yet. Take a practice quiz below to begin mastery tracking.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: AppColors.slate500),
              ),
            )
          else
            ...masteries.map((item) => _buildTopicMasteryBar(item)),
        ],
      ),
    );
  }

  Widget _buildTopicMasteryBar(TopicMasteryItem item) {
    Color barColor;
    String statusLabel;

    if (item.totalAttempts < 2) {
      barColor = AppColors.slate400;
      statusLabel = 'Calibrating (${item.totalAttempts}/2 attempts)';
    } else if (item.score >= 80) {
      barColor = AppColors.success;
      statusLabel = 'Strong';
    } else if (item.score >= 60) {
      barColor = AppColors.primary;
      statusLabel = 'Developing';
    } else {
      barColor = AppColors.error;
      statusLabel = 'Needs Practice';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  item.topic,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${item.score}%',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: barColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (item.score.clamp(0, 100)) / 100.0,
              minHeight: 7,
              backgroundColor: AppColors.slate100,
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                statusLabel,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: barColor,
                ),
              ),
              Text(
                '${item.totalAttempts} ${item.totalAttempts == 1 ? "attempt" : "attempts"}',
                style: const TextStyle(
                  fontSize: 10.5,
                  color: AppColors.slate400,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendationsSection(AdaptiveLearningProvider prov) {
    final recs = prov.recommendations;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(
              Icons.lightbulb_outline_rounded,
              color: AppColors.warning,
              size: 20,
            ),
            SizedBox(width: 8),
            Text(
              'Recommended Next Steps',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.primaryNavy,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (recs.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.slate200),
            ),
            child: const Text(
              'No active recommendations right now. Practice more questions to trigger smart personalized revision suggestions.',
              style: TextStyle(fontSize: 12.5, color: AppColors.slate500),
            ),
          )
        else
          ...recs.map((rec) => _buildRecommendationCard(prov, rec)),
      ],
    );
  }

  Widget _buildRecommendationCard(
    AdaptiveLearningProvider prov,
    Map<String, dynamic> rec,
  ) {
    final title = rec['title'] ?? rec['topic'] ?? 'Recommended Activity';
    final reason =
        rec['reason'] ?? rec['rationale'] ?? 'Based on recent learning data.';
    final recId = (rec['id'] ?? rec['_id'] ?? '').toString();
    final topic = rec['topic']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.accentCyan.withAlpha(25),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.auto_stories_rounded,
              color: AppColors.primaryNavy,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  reason,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.slate500,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryNavy,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            onPressed: () {
              if (recId.isNotEmpty) {
                prov.recordRecommendationAction(
                  recId,
                  eventType: 'selected',
                  topic: topic,
                );
              }
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => QuizRunnerScreen(initialTopic: topic),
                ),
              );
            },
            child: const Text('Start'),
          ),
        ],
      ),
    );
  }

  // ── Tab 2: Weak Topics & Spaced Repetition Queue ─────────────────────────
  Widget _buildWeakTopicsTab(
    AdaptiveLearningProvider prov,
    AdaptiveProfileModel? profile,
  ) {
    final weak = profile?.weakTopics ?? [];
    final queue = profile?.spacedRepetitionQueue ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Weak Topics Section
        Row(
          children: [
            const Icon(
              Icons.warning_amber_rounded,
              color: AppColors.error,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              'Topics Needing Practice (${weak.length})',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.primaryNavy,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Flagged only after 2+ attempts with performance under 60%. Asking many questions in AI Tutor is never marked as a weakness.',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.slate500,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 14),
        if (weak.isEmpty)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.slate200),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.check_circle_outline_rounded,
                  color: AppColors.success,
                  size: 24,
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No weak topics detected. Keep practicing across subjects to maintain strong mastery.',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: AppColors.slate600,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          ...weak.map((w) => _buildWeakTopicCard(w)),

        const SizedBox(height: 24),

        // Spaced Repetition Queue
        Row(
          children: [
            const Icon(
              Icons.update_rounded,
              color: AppColors.primary,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              'Spaced Repetition Queue (${queue.length})',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.primaryNavy,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Concepts due for scheduled revision to counter memory decay and lock in long-term mastery.',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.slate500,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 14),
        if (queue.isEmpty)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.slate200),
            ),
            child: const Text(
              'Your spaced repetition queue is clear! Topics will reappear here when review is due.',
              style: TextStyle(fontSize: 12.5, color: AppColors.slate500),
            ),
          )
        else
          ...queue.map((q) => _buildReviewQueueCard(q)),
      ],
    );
  }

  Widget _buildWeakTopicCard(TopicMasteryItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.priority_high_rounded,
              color: AppColors.error,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.topic,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Score: ${item.score}% • ${item.totalAttempts} attempts',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            icon: const Icon(Icons.fitness_center_rounded, size: 14),
            label: const Text(
              'Practice',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => QuizRunnerScreen(initialTopic: item.topic),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildReviewQueueCard(TopicMasteryItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.schedule_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.topic,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const SizedBox(height: 3),
                const Text(
                  'Review Due: Re-test to prevent memory decay',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => QuizRunnerScreen(initialTopic: item.topic),
                ),
              );
            },
            child: const Text('Review Now'),
          ),
        ],
      ),
    );
  }

  // ── Tab 3: AI Preferences ────────────────────────────────────────────────
  Widget _buildPreferencesTab(AdaptiveLearningProvider prov) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.slate200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.tune_rounded,
                    color: AppColors.primaryNavy,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Learner AI Preferences',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryNavy,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Customize how the AI Tutor explains concepts and personalizes responses.',
                style: TextStyle(
                  fontSize: 12.5,
                  color: AppColors.slate500,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 20),

              // Preferred Language
              const Text(
                'Preferred Language for AI Tutor:',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  _buildLangChoice('English', 'en'),
                  _buildLangChoice('हिंदी (Hindi)', 'hi'),
                  _buildLangChoice('ગુજરાતી (Gujarati)', 'gu'),
                ],
              ),

              const SizedBox(height: 20),

              // Explanation Level
              const Text(
                'Preferred Explanation Depth:',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  _buildLevelChoice('Beginner (Step-by-step)', 'beginner'),
                  _buildLevelChoice('Intermediate (Balanced)', 'intermediate'),
                  _buildLevelChoice('Advanced (Rigorous)', 'advanced'),
                ],
              ),

              const SizedBox(height: 20),

              // Daily Study Goal
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Daily Goal:',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryNavy,
                    ),
                  ),
                  Text(
                    '$_selectedDailyGoal minutes / day',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              Slider(
                value: _selectedDailyGoal.toDouble(),
                min: 10,
                max: 120,
                divisions: 11,
                activeColor: AppColors.primary,
                label: '$_selectedDailyGoal mins',
                onChanged: (val) {
                  setState(() => _selectedDailyGoal = val.round());
                },
              ),

              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryNavy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: prov.isUpdatingPrefs ? null : _savePreferences,
                  icon:
                      prov.isUpdatingPrefs
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.check_rounded, size: 18),
                  label: Text(
                    prov.isUpdatingPrefs
                        ? 'Saving Preferences...'
                        : 'Save Preferences',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLangChoice(String label, String code) {
    final selected = _selectedLanguage == code;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppColors.primaryNavy,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: selected ? Colors.white : AppColors.deepSlate,
      ),
      side: BorderSide(
        color: selected ? AppColors.primaryNavy : AppColors.slate300,
      ),
      onSelected: (_) {
        setState(() => _selectedLanguage = code);
      },
    );
  }

  Widget _buildLevelChoice(String label, String level) {
    final selected = _selectedLevel == level;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: AppColors.primaryNavy,
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: selected ? Colors.white : AppColors.deepSlate,
      ),
      side: BorderSide(
        color: selected ? AppColors.primaryNavy : AppColors.slate300,
      ),
      onSelected: (_) {
        setState(() => _selectedLevel = level);
      },
    );
  }
}
