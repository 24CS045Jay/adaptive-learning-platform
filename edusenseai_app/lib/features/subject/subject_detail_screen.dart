import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../models/document_model.dart';
import '../../models/quiz_model.dart';
import '../../models/subject_model.dart';
import '../../providers/subject_learning_provider.dart';
import '../chat/chat_screen.dart';

/// Detailed view for subject-specific learning content, materials, and quizzes.
class SubjectDetailScreen extends StatefulWidget {
  final SubjectModel subject;

  const SubjectDetailScreen({super.key, required this.subject});

  @override
  State<SubjectDetailScreen> createState() => _SubjectDetailScreenState();
}

class _SubjectDetailScreenState extends State<SubjectDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SubjectLearningProvider>().loadSubjectContent(
        widget.subject,
      );
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _launchFileUrl(String url) async {
    // Resolve relative localhost urls to Android emulator gateway if needed
    String resolved = url;
    if (resolved.startsWith('http://localhost:5000')) {
      resolved = resolved.replaceFirst(
        'http://localhost:5000',
        AppConfig.apiBaseUrl,
      );
    }

    final uri = Uri.tryParse(resolved);
    if (uri != null) {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open file URL: $resolved')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final learningProv = context.watch<SubjectLearningProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: AppColors.primaryNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.subject.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              '${widget.subject.code} · Semester ${widget.subject.semester}',
              style: const TextStyle(fontSize: 11, color: AppColors.slate300),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accentCyan,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.slate400,
          labelStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          tabs: [
            Tab(
              icon: const Icon(Icons.menu_book_rounded, size: 18),
              text: 'Materials (${learningProv.materials.length})',
            ),
            Tab(
              icon: const Icon(Icons.quiz_outlined, size: 18),
              text: 'Quizzes (${learningProv.quizzes.length})',
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.accentCyan,
        foregroundColor: AppColors.primaryNavy,
        elevation: 4,
        icon: const Icon(Icons.auto_awesome),
        label: const Text(
          'Ask AI Tutor',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ChatScreen(initialSubject: widget.subject),
            ),
          );
        },
      ),
      body:
          learningProv.isLoading
              ? const Center(child: CircularProgressIndicator())
              : learningProv.errorMessage != null
              ? _buildErrorView(learningProv)
              : TabBarView(
                controller: _tabController,
                children: [
                  _buildMaterialsTab(learningProv),
                  _buildQuizzesTab(learningProv),
                ],
              ),
    );
  }

  Widget _buildErrorView(SubjectLearningProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 48,
              color: AppColors.slate400,
            ),
            const SizedBox(height: 12),
            Text(
              provider.errorMessage ?? 'Failed to load content.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.deepSlate),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => provider.loadSubjectContent(widget.subject),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMaterialsTab(SubjectLearningProvider provider) {
    if (provider.materials.isEmpty) {
      return RefreshIndicator(
        onRefresh: provider.refresh,
        child: ListView(
          padding: const EdgeInsets.all(32),
          children: const [
            SizedBox(height: 60),
            Center(
              child: Icon(
                Icons.folder_open_rounded,
                size: 54,
                color: AppColors.slate300,
              ),
            ),
            SizedBox(height: 14),
            Center(
              child: Text(
                'No faculty materials uploaded yet.',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.deepSlate,
                ),
              ),
            ),
            SizedBox(height: 6),
            Center(
              child: Text(
                'Approved lecture slides and readings will appear here.',
                style: TextStyle(fontSize: 12, color: AppColors.slate500),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: provider.refresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        itemCount: provider.materials.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (ctx, index) {
          final doc = provider.materials[index];
          return _buildMaterialCard(doc);
        },
      ),
    );
  }

  Widget _buildMaterialCard(DocumentModel doc) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.slate200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.picture_as_pdf_rounded,
            color: Color(0xFF1D4ED8),
            size: 24,
          ),
        ),
        title: Text(
          doc.displayName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: AppColors.deepSlate,
          ),
        ),
        subtitle: Text(
          'Indexed in RAG Vector Store · ${doc.chunkCount} Chunks',
          style: const TextStyle(fontSize: 11, color: AppColors.slate500),
        ),
        trailing:
            doc.fileUrl.isNotEmpty
                ? IconButton(
                  icon: const Icon(
                    Icons.open_in_new_rounded,
                    color: AppColors.primaryNavy,
                    size: 20,
                  ),
                  tooltip: 'Open Material',
                  onPressed: () => _launchFileUrl(doc.fileUrl),
                )
                : const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF16A34A),
                  size: 20,
                ),
      ),
    );
  }

  Widget _buildQuizzesTab(SubjectLearningProvider provider) {
    if (provider.quizzes.isEmpty) {
      return RefreshIndicator(
        onRefresh: provider.refresh,
        child: ListView(
          padding: const EdgeInsets.all(32),
          children: const [
            SizedBox(height: 60),
            Center(
              child: Icon(
                Icons.assignment_outlined,
                size: 54,
                color: AppColors.slate300,
              ),
            ),
            SizedBox(height: 14),
            Center(
              child: Text(
                'No quizzes published for this course yet.',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.deepSlate,
                ),
              ),
            ),
            SizedBox(height: 6),
            Center(
              child: Text(
                'Faculty assessments and AI adaptive practice will appear here.',
                style: TextStyle(fontSize: 12, color: AppColors.slate500),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: provider.refresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        itemCount: provider.quizzes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (ctx, index) {
          final quiz = provider.quizzes[index];
          return _buildQuizCard(quiz);
        },
      ),
    );
  }

  Widget _buildQuizCard(QuizModel quiz) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.slate200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    quiz.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.deepSlate,
                    ),
                  ),
                ),
                if (quiz.isAiGenerated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'AI Generated',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryNavy,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${quiz.questions.length} Questions · Evaluated via Adaptive Pipeline',
              style: const TextStyle(fontSize: 11, color: AppColors.slate500),
            ),
          ],
        ),
      ),
    );
  }
}
