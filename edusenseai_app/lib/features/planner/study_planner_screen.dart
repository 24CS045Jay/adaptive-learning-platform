import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/subject_model.dart';
import '../chat/chat_screen.dart';
import '../meetings/meetings_screen.dart';

/// Represents an AI-generated topic remediation task for addressing weak areas.
class RemediationTask {
  final String id;
  final String topic;
  final String subject;
  final String reason;
  final String priority; // 'high', 'medium', 'low'
  final int estMinutes;
  final String keyConcept;
  final String formulaOrCode;
  final String commonPitfall;
  bool isCompleted;

  RemediationTask({
    required this.id,
    required this.topic,
    required this.subject,
    required this.reason,
    required this.priority,
    required this.estMinutes,
    required this.keyConcept,
    required this.formulaOrCode,
    required this.commonPitfall,
    this.isCompleted = false,
  });
}

/// Screen providing 1:1 parity with the web portal's Study Planner (/student/planner):
/// - Adaptive topic remediation tasks identified from quiz and learning metrics
/// - Key Concept, formulas, and common pitfalls for weak topics
/// - Direct "Ask AI Tutor" grounding launch
/// - Microsoft Teams faculty doubt consultation shortcut
class StudyPlannerScreen extends StatefulWidget {
  const StudyPlannerScreen({super.key});

  @override
  State<StudyPlannerScreen> createState() => _StudyPlannerScreenState();
}

class _StudyPlannerScreenState extends State<StudyPlannerScreen> {
  String _filter = 'All'; // 'All', 'Pending', 'Completed'

  final List<RemediationTask> _tasks = [
    RemediationTask(
      id: 'rem-1',
      topic: 'MapReduce Shuffle & Sort',
      subject: 'Big Data Analytics',
      reason: 'Low accuracy on Unit 1 practice quiz assessment',
      priority: 'high',
      estMinutes: 20,
      keyConcept:
          'Shuffle phase transfers intermediate map outputs over the network to reducers. Map output is partitioned by key hash modulo reducer count.',
      formulaOrCode:
          'partition = hash(key) % numReducers\nSort: Key-Value pairs sorted in memory buffer before disk spill.',
      commonPitfall:
          'Forgetting that Combiners run locally on Mappers, not on Reducers. Combiners must be commutative and associative.',
      isCompleted: false,
    ),
    RemediationTask(
      id: 'rem-2',
      topic: 'L1 vs L2 Regularization',
      subject: 'Machine Learning',
      reason: 'Struggled on question 2 in Supervised Learning assessment',
      priority: 'high',
      estMinutes: 15,
      keyConcept:
          'L1 (Lasso) adds absolute weight penalty |w| inducing sparsity. L2 (Ridge) adds squared weight penalty w^2 shrinking weights smoothly.',
      formulaOrCode:
          'Loss_L1 = MSE + λ ∑ |w_i|\nLoss_L2 = MSE + λ ∑ (w_i)^2',
      commonPitfall:
          'Confusing L1 (feature selection) with L2 (prevents large weights without zeroing them out).',
      isCompleted: false,
    ),
    RemediationTask(
      id: 'rem-3',
      topic: 'Speculative Execution',
      subject: 'Big Data Analytics',
      reason: 'Missed speculative execution trigger condition in Unit 2',
      priority: 'medium',
      estMinutes: 10,
      keyConcept:
          'Hadoop launches duplicate tasks for slow worker nodes ("stragglers"). The first copy to complete is accepted; the redundant one is killed.',
      formulaOrCode:
          'Trigger: Task execution progress < 0.2 * cluster average progress rate.',
      commonPitfall:
          'Assuming speculative execution handles node crashes. It handles stragglers; Heartbeat timeouts handle crashes.',
      isCompleted: true,
    ),
  ];

  List<RemediationTask> get _filteredTasks {
    if (_filter == 'Pending') {
      return _tasks.where((t) => !t.isCompleted).toList();
    } else if (_filter == 'Completed') {
      return _tasks.where((t) => t.isCompleted).toList();
    }
    return _tasks;
  }

  int get _pendingCount => _tasks.where((t) => !t.isCompleted).length;
  int get _completedCount => _tasks.where((t) => t.isCompleted).length;

  @override
  Widget build(BuildContext context) {
    final tasks = _filteredTasks;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Study Planner & Remediation',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Header stats banner
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      '$_pendingCount Pending',
                      'Topics to remediate',
                      AppColors.warning,
                      Icons.pending_actions_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricCard(
                      '$_completedCount Mastered',
                      'Completed reviews',
                      AppColors.success,
                      Icons.task_alt_rounded,
                    ),
                  ),
                ],
              ),
            ),

            // Segment filter tabs
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.white,
              child: Row(
                children: [
                  _buildFilterTab('All'),
                  const SizedBox(width: 8),
                  _buildFilterTab('Pending'),
                  const SizedBox(width: 8),
                  _buildFilterTab('Completed'),
                  const Spacer(),
                  // Schedule Faculty Doubt shortcut
                  TextButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const MeetingsScreen(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.video_call_rounded, size: 18),
                    label: const Text(
                      'Faculty Doubt',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Task list
            Expanded(
              child: tasks.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.check_circle_outline_rounded, size: 48, color: AppColors.success),
                          SizedBox(height: 12),
                          Text(
                            'All assigned topics are reviewed!',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.navy),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Great job! Continue taking quizzes to keep mastery sharp.',
                            style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: tasks.length,
                      itemBuilder: (ctx, i) {
                        return _buildTaskCard(tasks[i]);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String subtitle, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withAlpha(15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label) {
    final isSelected = _filter == label;
    return InkWell(
      onTap: () => setState(() => _filter = label),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : AppColors.navy,
          ),
        ),
      ),
    );
  }

  Widget _buildTaskCard(RemediationTask task) {
    final priorityColor = task.priority == 'high'
        ? AppColors.error
        : task.priority == 'medium'
            ? AppColors.warning
            : AppColors.success;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: task.isCompleted ? AppColors.success.withAlpha(60) : AppColors.divider,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(4),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ExpansionTile(
        initiallyExpanded: !task.isCompleted,
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: priorityColor.withAlpha(20),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${task.priority.toUpperCase()} PRIORITY',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: priorityColor,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${task.estMinutes} mins',
              style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              task.topic,
              style: TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: task.isCompleted ? AppColors.textSecondary : AppColors.navy,
                decoration: task.isCompleted ? TextDecoration.lineThrough : null,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${task.subject} · ${task.reason}',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
        children: [
          const Divider(height: 16),

          // Key Concept section
          _buildDetailSection(
            'KEY CONCEPT',
            task.keyConcept,
            Icons.lightbulb_outline_rounded,
            AppColors.primary,
          ),
          const SizedBox(height: 12),

          // Formula or Code section
          _buildDetailSection(
            'FORMULAS / CODE SNIPPET',
            task.formulaOrCode,
            Icons.code_rounded,
            AppColors.secondary,
            isCode: true,
          ),
          const SizedBox(height: 12),

          // Common Pitfall section
          _buildDetailSection(
            'COMMON PITFALL',
            task.commonPitfall,
            Icons.warning_amber_rounded,
            AppColors.warning,
          ),
          const SizedBox(height: 16),

          // Action row
          Row(
            children: [
              // Ask AI Tutor button
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ChatScreen(
                        initialSubject: SubjectModel(
                          id: task.subject,
                          name: task.subject,
                          code: task.subject,
                          semester: 1,
                          departmentId: 'CE',
                        ),
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.auto_awesome, size: 16),
                label: const Text('Ask AI Tutor', style: TextStyle(fontSize: 12.5)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
              ),
              const Spacer(),

              // Mark Complete Toggle
              ElevatedButton.icon(
                onPressed: () {
                  setState(() => task.isCompleted = !task.isCompleted);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        task.isCompleted
                            ? 'Marked as reviewed! Mastery score updated.'
                            : 'Task re-opened.',
                      ),
                      backgroundColor: task.isCompleted ? AppColors.success : AppColors.primary,
                      duration: const Duration(seconds: 1),
                    ),
                  );
                },
                icon: Icon(
                  task.isCompleted ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                  size: 16,
                ),
                label: Text(
                  task.isCompleted ? 'Completed' : 'Mark Reviewed',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: task.isCompleted ? AppColors.success : AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailSection(String title, String content, IconData icon, Color color, {bool isCode = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isCode ? const Color(0xFF1E293B) : color.withAlpha(10),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isCode ? Colors.transparent : color.withAlpha(30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: isCode ? Colors.amberAccent : color),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                  color: isCode ? Colors.amberAccent : color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            content,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.4,
              fontFamily: isCode ? 'monospace' : null,
              color: isCode ? Colors.white : AppColors.navy,
            ),
          ),
        ],
      ),
    );
  }
}
