import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/chat_message_model.dart';
import '../../models/chat_source_model.dart';
import '../../models/subject_model.dart';
import '../../providers/chat_provider.dart';
import '../../providers/student_dashboard_provider.dart';

/// Interactive EduSense AI RAG Chatbot screen for students.
class ChatScreen extends StatefulWidget {
  final SubjectModel? initialSubject;

  const ChatScreen({super.key, this.initialSubject});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chatProvider = context.read<ChatProvider>();
      if (widget.initialSubject != null) {
        chatProvider.setSubject(widget.initialSubject);
      }
      chatProvider.loadConversations();
    });
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients &&
        _scrollController.position.maxScrollExtent > 0) {
      final chatProvider = context.read<ChatProvider>();
      if (chatProvider.messages.length > 2) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    }
  }

  void _handleSend([String? customText]) {
    final text = customText ?? _inputController.text;
    if (text.trim().isEmpty) return;

    final chatProvider = context.read<ChatProvider>();
    _inputController.clear();
    chatProvider.sendMessage(text);

    Future.delayed(const Duration(milliseconds: 150), _scrollToBottom);
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    final studentProv = context.watch<StudentDashboardProvider>();
    final subjects =
        studentProv.enrolledSubjects.isNotEmpty
            ? studentProv.enrolledSubjects
            : studentProv.allSubjects;

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: AppColors.primaryNavy,
          foregroundColor: Colors.white,
          elevation: 0,
          titleSpacing: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: AppColors.accentCyan.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  color: AppColors.accentCyan,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'EduSense AI Tutor',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      chatProvider.selectedSubject != null
                          ? chatProvider.selectedSubject!.name
                          : 'All Subjects (Universal)',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.slate300,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            // Language Selector Menu (Phase 6 Learner-Aware RAG)
            PopupMenuButton<String>(
              icon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.translate_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    chatProvider.selectedLanguage.toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.accentCyan,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              tooltip: 'Response Language',
              onSelected: (lang) => chatProvider.setLanguage(lang),
              itemBuilder:
                  (ctx) => const [
                    PopupMenuItem(value: 'en', child: Text('English (EN)')),
                    PopupMenuItem(value: 'hi', child: Text('हिंदी (Hindi)')),
                    PopupMenuItem(
                      value: 'gu',
                      child: Text('ગુજરાતી (Gujarati)'),
                    ),
                  ],
            ),
            // Subject Filter Menu
            PopupMenuButton<SubjectModel?>(
              icon: const Icon(Icons.filter_list, color: Colors.white),
              tooltip: 'Filter by Subject',
              onSelected: (sub) => chatProvider.setSubject(sub),
              itemBuilder:
                  (ctx) => [
                    const PopupMenuItem<SubjectModel?>(
                      value: null,
                      child: Text('All Enrolled Subjects'),
                    ),
                    ...subjects.map(
                      (s) => PopupMenuItem<SubjectModel?>(
                        value: s,
                        child: Text('${s.code}: ${s.name}'),
                      ),
                    ),
                  ],
            ),
            // Conversations History Drawer Trigger
            IconButton(
              icon: const Icon(Icons.history_rounded, color: Colors.white),
              tooltip: 'Conversation Sessions',
              onPressed: () => _openHistorySheet(context),
            ),
            // New Session Button
            IconButton(
              icon: const Icon(Icons.add_comment_outlined, color: Colors.white),
              tooltip: 'New Chat Session',
              onPressed: () => chatProvider.startNewChat(),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              // Subject Selection Indicator Bar
              _buildSubjectBar(chatProvider, subjects),

              // Chat Messages List
              Expanded(
                child:
                    chatProvider.messages.isEmpty
                        ? _buildEmptyState(chatProvider)
                        : _buildMessageList(chatProvider),
              ),

              // Bottom Input Bar
              _buildInputBar(chatProvider),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubjectBar(
    ChatProvider chatProvider,
    List<SubjectModel> subjects,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: Colors.white,
      child: Row(
        children: [
          const Icon(
            Icons.menu_book_rounded,
            size: 15,
            color: AppColors.slate500,
          ),
          const SizedBox(width: 6),
          const Text(
            'Subject Context:',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.deepSlate,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('All', style: TextStyle(fontSize: 11)),
                    selected: chatProvider.selectedSubject == null,
                    onSelected: (_) => chatProvider.setSubject(null),
                    selectedColor: AppColors.primaryNavy,
                    labelStyle: TextStyle(
                      color:
                          chatProvider.selectedSubject == null
                              ? Colors.white
                              : AppColors.deepSlate,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 6),
                  ...subjects.map((sub) {
                    final isSel = chatProvider.selectedSubject?.id == sub.id;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(
                          sub.code,
                          style: const TextStyle(fontSize: 11),
                        ),
                        selected: isSel,
                        onSelected: (_) => chatProvider.setSubject(sub),
                        selectedColor: AppColors.primaryNavy,
                        labelStyle: TextStyle(
                          color: isSel ? Colors.white : AppColors.deepSlate,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(ChatProvider chatProvider) {
    final subName = chatProvider.selectedSubject?.name;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accentCyan.withValues(alpha: 0.12),
            ),
            child: const Icon(
              Icons.psychology_outlined,
              size: 40,
              color: AppColors.accentCyan,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            subName != null
                ? 'Ask about $subName'
                : 'Welcome to EduSense AI Tutor',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryNavy,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your intelligent study companion grounded in verified university syllabus, lecture notes, and faculty materials.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: AppColors.slate500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Sample questions:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.deepSlate,
              ),
            ),
          ),
          const SizedBox(height: 10),
          _buildStarterQuestion(
            'Explain the core concept and real-world application.',
          ),
          _buildStarterQuestion(
            'Summarize the key takeaways from Unit 1 lecture slides.',
          ),
          _buildStarterQuestion(
            'Give me a step-by-step worked example with solution.',
          ),
          _buildStarterQuestion(
            'What are the most common exam questions on this topic?',
          ),
        ],
      ),
    );
  }

  Widget _buildStarterQuestion(String text) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          side: BorderSide(color: AppColors.slate300.withValues(alpha: 0.8)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: Colors.white,
        ),
        onPressed: () => _handleSend(text),
        child: Row(
          children: [
            const Icon(
              Icons.chat_bubble_outline_rounded,
              size: 15,
              color: AppColors.accentCyan,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.deepSlate,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageList(ChatProvider chatProvider) {
    return ListView.builder(
      controller: _scrollController,
      cacheExtent: 1500,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      itemCount: chatProvider.messages.length,
      itemBuilder: (context, index) {
        final message = chatProvider.messages[index];
        return _buildMessageTurn(message, chatProvider);
      },
    );
  }

  Widget _buildMessageTurn(ChatMessageModel msg, ChatProvider chatProvider) {
    if (msg.isStudent) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 14, left: 48),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primaryNavy, AppColors.deepSlate],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(4),
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryNavy.withValues(alpha: 0.12),
                blurRadius: 6,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Text(
            msg.text,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ),
      );
    }

    // Tutor Turn
    if (msg.isLoading) {
      return Align(
        alignment: Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.only(bottom: 14, right: 64),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.slate200),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.accentCyan,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Searching knowledge base...',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.slate500,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (msg.hasError) {
      return Align(
        alignment: Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.only(bottom: 14, right: 32),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Color(0xFFDC2626),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Query Failed',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                msg.errorMessage ??
                    'Unable to retrieve answer. Please try again.',
                style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFDC2626)),
                ),
                onPressed: () => chatProvider.retryLastMessage(),
                icon: const Icon(Icons.refresh, size: 14),
                label: const Text('Retry Question'),
              ),
            ],
          ),
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16, right: 32),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(4),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: AppColors.slate200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tutor Header Badge
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.accentCyan.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    size: 12,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'EduSense RAG Tutor',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryNavy,
                  ),
                ),
                const Spacer(),
                if (msg.escalated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Text(
                      'Escalated to Faculty',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),

            // Formatted Markdown Content
            MarkdownBody(
              data: msg.text,
              selectable: true,
              styleSheet: MarkdownStyleSheet.fromTheme(
                Theme.of(context),
              ).copyWith(
                p: const TextStyle(
                  fontSize: 13.5,
                  height: 1.5,
                  color: Color(0xFF1E293B),
                ),
                h1: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primaryNavy,
                ),
                h2: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryNavy,
                ),
                h3: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.deepSlate,
                ),
                code: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  backgroundColor: Color(0xFFF1F5F9),
                  color: Color(0xFF0F172A),
                ),
                codeblockDecoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                ),
                blockquoteDecoration: BoxDecoration(
                  border: const Border(
                    left: BorderSide(color: AppColors.accentCyan, width: 4),
                  ),
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),

            // Grounding & Citations section
            if (msg.sources.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.slate200),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.library_books_outlined,
                    size: 13,
                    color: AppColors.slate500,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Sources & Citations (${msg.sources.length}):',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.slate600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: msg.sources.map(_buildSourceChip).toList(),
              ),
            ],

            // Follow-up Suggestions
            if (msg.followUp.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                'Suggested follow-up:',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate500,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children:
                    msg.followUp.map((fu) {
                      return ActionChip(
                        label: Text(fu, style: const TextStyle(fontSize: 11)),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: const Color(0xFFF1F5F9),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        onPressed: () => _handleSend(fu),
                      );
                    }).toList(),
              ),
            ],

            // Phase 6: Quick Explanation Adaptation Actions
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.slate200),
            const SizedBox(height: 8),
            const Text(
              'Adapt explanation:',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ActionChip(
                  avatar: const Icon(
                    Icons.wb_sunny_outlined,
                    size: 13,
                    color: AppColors.primary,
                  ),
                  label: const Text(
                    'Explain Simpler',
                    style: TextStyle(fontSize: 11),
                  ),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: const Color(0xFFEFF6FF),
                  side: const BorderSide(color: Color(0xFFBFDBFE)),
                  onPressed:
                      () => _handleSend(
                        'Please explain that more simply with a clear analogy or real-world concept.',
                      ),
                ),
                ActionChip(
                  avatar: const Icon(
                    Icons.lightbulb_outline,
                    size: 13,
                    color: AppColors.warning,
                  ),
                  label: const Text(
                    'Give Example',
                    style: TextStyle(fontSize: 11),
                  ),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: const Color(0xFFFFFBEB),
                  side: const BorderSide(color: Color(0xFFFDE68A)),
                  onPressed:
                      () => _handleSend(
                        'Can you give a concrete, step-by-step worked example with numbers or code?',
                      ),
                ),
                ActionChip(
                  avatar: const Icon(
                    Icons.menu_book_outlined,
                    size: 13,
                    color: AppColors.deepSlate,
                  ),
                  label: const Text(
                    'Deeper Detail',
                    style: TextStyle(fontSize: 11),
                  ),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: const Color(0xFFF1F5F9),
                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                  onPressed:
                      () => _handleSend(
                        'Please explain this in more technical depth and rigorous mathematical detail.',
                      ),
                ),
                ActionChip(
                  avatar: const Icon(
                    Icons.quiz_outlined,
                    size: 13,
                    color: AppColors.success,
                  ),
                  label: const Text(
                    'Practice Quiz',
                    style: TextStyle(fontSize: 11),
                  ),
                  visualDensity: VisualDensity.compact,
                  backgroundColor: const Color(0xFFF0FDF4),
                  side: const BorderSide(color: Color(0xFFBBF7D0)),
                  onPressed:
                      () => _handleSend(
                        'Give me a quick multiple choice question to test my understanding of this topic.',
                      ),
                ),
              ],
            ),

            // Phase 6: Thumbs Up / Thumbs Down Feedback
            const SizedBox(height: 10),
            _buildFeedbackRow(msg, chatProvider),
          ],
        ),
      ),
    );
  }

  Widget _buildFeedbackRow(ChatMessageModel msg, ChatProvider chatProvider) {
    final status = chatProvider.feedbackStatus[msg.id];

    return Container(
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Row(
        children: [
          Text(
            status != null
                ? 'Feedback recorded'
                : 'Was this explanation helpful?',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.slate500,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: Icon(
              status == 'helpful'
                  ? Icons.thumb_up_alt
                  : Icons.thumb_up_alt_outlined,
              size: 16,
              color:
                  status == 'helpful' ? AppColors.success : AppColors.slate400,
            ),
            visualDensity: VisualDensity.compact,
            tooltip: 'Helpful',
            onPressed:
                status != null
                    ? null
                    : () async {
                      final ok = await chatProvider.submitFeedback(
                        message: msg,
                        isThumbsUp: true,
                      );
                      if (ok && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Thank you! Helpful rating saved.'),
                            duration: Duration(seconds: 2),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
          ),
          IconButton(
            icon: Icon(
              status == 'unhelpful'
                  ? Icons.thumb_down_alt
                  : Icons.thumb_down_alt_outlined,
              size: 16,
              color:
                  status == 'unhelpful' ? AppColors.error : AppColors.slate400,
            ),
            visualDensity: VisualDensity.compact,
            tooltip: 'Needs Improvement',
            onPressed:
                status != null
                    ? null
                    : () async {
                      final ok = await chatProvider.submitFeedback(
                        message: msg,
                        isThumbsUp: false,
                      );
                      if (ok && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Thank you! Feedback recorded to improve responses.',
                            ),
                            duration: Duration(seconds: 2),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      }
                    },
          ),
        ],
      ),
    );
  }

  Widget _buildSourceChip(ChatSourceModel source) {
    return InkWell(
      onTap: () => _showSourceSnippetDialog(source),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFBFDBFE)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.description_outlined,
              size: 11,
              color: Color(0xFF1D4ED8),
            ),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 160),
              child: Text(
                '${source.displayName} (p. ${source.page})',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1D4ED8),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSourceSnippetDialog(ChatSourceModel source) {
    showDialog(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Row(
              children: [
                const Icon(
                  Icons.menu_book_rounded,
                  color: AppColors.primaryNavy,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    source.displayName,
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Page / Slide Number: ${source.page}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.slate500,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.slate200),
                  ),
                  child: Text(
                    source.snippet ??
                        'Source passage verified in institutional vector index.',
                    style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.4,
                      color: AppColors.deepSlate,
                    ),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Close'),
              ),
            ],
          ),
    );
  }

  Widget _buildInputBar(ChatProvider chatProvider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.slate200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: TextField(
                controller: _inputController,
                focusNode: _focusNode,
                minLines: 1,
                maxLines: 4,
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.deepSlate,
                ),
                decoration: const InputDecoration(
                  hintText: 'Ask AI Tutor about syllabus, notes...',
                  hintStyle: TextStyle(fontSize: 13, color: AppColors.slate400),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 11),
                ),
                onEditingComplete: () => _handleSend(),
                onSubmitted: (val) => _handleSend(val),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primaryNavy, AppColors.accentCyan],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon:
                  chatProvider.isLoading
                      ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                      : const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
              onPressed: chatProvider.isLoading ? null : () => _handleSend(),
            ),
          ),
        ],
      ),
    );
  }

  void _openHistorySheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return Consumer<ChatProvider>(
          builder: (ctx, provider, _) {
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.6,
              minChildSize: 0.4,
              maxChildSize: 0.9,
              builder: (ctx, scrollCtrl) {
                return Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Study Sessions History',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryNavy,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.of(sheetCtx).pop(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (provider.isHistoryLoading)
                        const Center(child: CircularProgressIndicator())
                      else if (provider.conversations.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 30),
                          child: Center(
                            child: Text(
                              'No past conversations found. Ask a question to start one!',
                              style: TextStyle(color: AppColors.slate500),
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            controller: scrollCtrl,
                            itemCount: provider.conversations.length,
                            separatorBuilder:
                                (_, __) => const Divider(height: 1),
                            itemBuilder: (ctx, index) {
                              final conv = provider.conversations[index];
                              final isCurrent =
                                  conv.id == provider.currentConversationId;
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundColor:
                                      isCurrent
                                          ? AppColors.primaryNavy
                                          : const Color(0xFFE2E8F0),
                                  foregroundColor:
                                      isCurrent
                                          ? Colors.white
                                          : AppColors.deepSlate,
                                  child: const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                    size: 18,
                                  ),
                                ),
                                title: Text(
                                  conv.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight:
                                        isCurrent
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                    color: AppColors.deepSlate,
                                  ),
                                ),
                                subtitle: Text(
                                  '${conv.subjectName} · ${conv.messagesCount} turns',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.slate500,
                                  ),
                                ),
                                trailing: IconButton(
                                  icon: const Icon(
                                    Icons.delete_outline,
                                    size: 18,
                                    color: Color(0xFFEF4444),
                                  ),
                                  onPressed:
                                      () =>
                                          provider.deleteConversation(conv.id),
                                ),
                                onTap: () {
                                  provider.selectConversation(conv);
                                  Navigator.of(sheetCtx).pop();
                                },
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}
