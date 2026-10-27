import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

/// Represents an individual answer/reply to a discussion thread.
class DiscussionAnswer {
  final String id;
  final String author;
  final String authorRole;
  final String content;
  final String time;

  DiscussionAnswer({
    required this.id,
    required this.author,
    required this.authorRole,
    required this.content,
    required this.time,
  });
}

/// Represents a peer or faculty discussion thread.
class DiscussionPost {
  final String id;
  final String title;
  final String content;
  final String author;
  final String authorRole;
  final String subject;
  final List<String> tags;
  final String time;
  int upvotes;
  bool isUpvoted;
  final List<DiscussionAnswer> answers;

  DiscussionPost({
    required this.id,
    required this.title,
    required this.content,
    required this.author,
    required this.authorRole,
    required this.subject,
    required this.tags,
    required this.time,
    this.upvotes = 0,
    this.isUpvoted = false,
    List<DiscussionAnswer>? answers,
  }) : answers = answers ?? [];
}

/// Screen providing 1:1 parity with the web portal's Discussion Forum (/student/discussion, /faculty/discussion):
/// - Enrolled subject filtering and global thread search
/// - Creating new doubt/discussion threads with tagging
/// - Thread upvoting
/// - Multi-role responses (Faculty & Student replies)
class DiscussionForumScreen extends StatefulWidget {
  const DiscussionForumScreen({super.key});

  @override
  State<DiscussionForumScreen> createState() => _DiscussionForumScreenState();
}

class _DiscussionForumScreenState extends State<DiscussionForumScreen> {
  String _selectedSubject = 'All';
  String _searchQuery = '';

  final List<DiscussionPost> _posts = [
    DiscussionPost(
      id: 'disc-1',
      title: 'When should Combiners not be used in Hadoop MapReduce?',
      content:
          'I understand Combiners act as mini-reducers locally on the Mapper node, but in which mathematical operations would using a combiner produce incorrect results?',
      author: 'Aarav Patel',
      authorRole: 'Student',
      subject: 'Big Data Analytics',
      tags: ['MapReduce', 'Combiners', 'Unit 2'],
      time: '2 hours ago',
      upvotes: 4,
      isUpvoted: false,
      answers: [
        DiscussionAnswer(
          id: 'ans-1',
          author: 'Dr. Nisha Shah',
          authorRole: 'Faculty',
          content:
              'Great question Aarav! Combiners can ONLY be used when the reduce function is both commutative and associative. '
              'For example, calculating an Average (Mean) directly in a combiner is incorrect because Average(Average(A), Average(B)) != Average(A + B). '
              'Instead, emit (sum, count) pairs.',
          time: '1 hour ago',
        ),
      ],
    ),
    DiscussionPost(
      id: 'disc-2',
      title: 'Can someone explain the vanishing gradient problem in deep neural networks?',
      content:
          'Why does backpropagation cause gradients to shrink exponentially when using sigmoid activation functions in early layers?',
      author: 'Meera Joshi',
      authorRole: 'Student',
      subject: 'Machine Learning',
      tags: ['Neural Networks', 'Gradients', 'Backprop'],
      time: 'Yesterday',
      upvotes: 6,
      isUpvoted: true,
      answers: [
        DiscussionAnswer(
          id: 'ans-2',
          author: 'Prof. Anil Kumar',
          authorRole: 'Faculty',
          content:
              'The derivative of the sigmoid function has a maximum value of 0.25. When applying the chain rule across N layers, '
              'multiplying values < 0.25 causes gradients in initial layers to approach zero. Using ReLU or Leaky ReLU resolves this.',
          time: 'Yesterday',
        ),
      ],
    ),
  ];

  final List<String> _subjects = [
    'All',
    'Big Data Analytics',
    'Machine Learning',
    'Design & Analysis of Algorithms',
  ];

  List<DiscussionPost> get _filteredPosts {
    return _posts.where((p) {
      if (_selectedSubject != 'All' && p.subject != _selectedSubject) {
        return false;
      }
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        return p.title.toLowerCase().contains(q) ||
            p.content.toLowerCase().contains(q) ||
            p.tags.any((t) => t.toLowerCase().contains(q));
      }
      return true;
    }).toList();
  }

  void _showNewPostModal() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final tagsCtrl = TextEditingController(text: 'General, Doubts');
    String chosenSubj = _subjects.firstWhere((s) => s != 'All', orElse: () => 'General');

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Start Discussion / Ask Question',
                    style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: AppColors.navy),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  labelText: 'Discussion Title',
                  hintText: 'e.g. Question on topic or concept',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: contentCtrl,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Details / Context',
                  hintText: 'Explain what you are trying to understand...',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: tagsCtrl,
                decoration: InputDecoration(
                  labelText: 'Tags (comma separated)',
                  hintText: 'e.g. Unit 1, Exam, Concept',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  if (titleCtrl.text.trim().isEmpty || contentCtrl.text.trim().isEmpty) return;
                  final user = context.read<AuthProvider>().user;
                  final tags = tagsCtrl.text.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

                  setState(() {
                    _posts.insert(
                      0,
                      DiscussionPost(
                        id: 'disc-${DateTime.now().millisecondsSinceEpoch}',
                        title: titleCtrl.text.trim(),
                        content: contentCtrl.text.trim(),
                        author: user?.name ?? 'Student',
                        authorRole: user?.isFaculty == true ? 'Faculty' : 'Student',
                        subject: chosenSubj,
                        tags: tags.isNotEmpty ? tags : ['General'],
                        time: 'Just now',
                      ),
                    );
                  });
                  Navigator.of(ctx).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Post Discussion', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showReplyModal(DiscussionPost post) {
    final replyCtrl = TextEditingController();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Reply to "${post.title}"',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.navy),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: replyCtrl,
                maxLines: 4,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Your Answer or Explanation',
                  hintText: 'Type your explanation...',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: () {
                  if (replyCtrl.text.trim().isEmpty) return;
                  final user = context.read<AuthProvider>().user;
                  setState(() {
                    post.answers.add(
                      DiscussionAnswer(
                        id: 'ans-${DateTime.now().millisecondsSinceEpoch}',
                        author: user?.name ?? 'Active User',
                        authorRole: user?.isFaculty == true ? 'Faculty' : 'Student',
                        content: replyCtrl.text.trim(),
                        time: 'Just now',
                      ),
                    );
                  });
                  Navigator.of(ctx).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Post Answer', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final posts = _filteredPosts;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Discussion Forum', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_rounded),
            tooltip: 'Start Discussion',
            onPressed: _showNewPostModal,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search & Filter header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Column(
                children: [
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search queries, topics, questions...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      isDense: true,
                      filled: true,
                      fillColor: AppColors.surface,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.divider),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _subjects.map((subj) {
                        final isSelected = _selectedSubject == subj;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(subj),
                            selected: isSelected,
                            onSelected: (_) => setState(() => _selectedSubject = subj),
                            selectedColor: AppColors.primary.withAlpha(25),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? AppColors.primary : AppColors.navy,
                            ),
                            backgroundColor: AppColors.surface,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Posts list
            Expanded(
              child: posts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.forum_outlined, size: 48, color: AppColors.divider),
                          SizedBox(height: 12),
                          Text(
                            'No discussions found.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                          SizedBox(height: 4),
                          Text('Be the first to ask a question to your peers and faculty!', style: TextStyle(fontSize: 12.5, color: AppColors.textTertiary)),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: posts.length,
                      itemBuilder: (ctx, i) => _buildPostCard(posts[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPostCard(DiscussionPost post) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(4),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author & Subject Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: post.authorRole == 'Faculty' ? AppColors.secondary.withAlpha(20) : AppColors.primary.withAlpha(15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  post.authorRole,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: post.authorRole == 'Faculty' ? AppColors.secondary : AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                post.author,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy),
              ),
              const Spacer(),
              Text(post.time, style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary)),
            ],
          ),
          const SizedBox(height: 10),

          // Title
          Text(
            post.title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy),
          ),
          const SizedBox(height: 6),

          // Content
          Text(
            post.content,
            style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary, height: 1.45),
          ),
          const SizedBox(height: 10),

          // Tags
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: post.tags.map((tag) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Text(
                  '#$tag',
                  style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          const Divider(),

          // Actions row: Upvote, Answers count, Reply button
          Row(
            children: [
              InkWell(
                onTap: () {
                  setState(() {
                    post.isUpvoted = !post.isUpvoted;
                    post.upvotes += post.isUpvoted ? 1 : -1;
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    children: [
                      Icon(
                        post.isUpvoted ? Icons.thumb_up_rounded : Icons.thumb_up_outlined,
                        size: 16,
                        color: post.isUpvoted ? AppColors.primary : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${post.upvotes}',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: post.isUpvoted ? AppColors.primary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),

              Text(
                '${post.answers.length} answers',
                style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
              ),
              const Spacer(),

              TextButton.icon(
                onPressed: () => _showReplyModal(post),
                icon: const Icon(Icons.reply_rounded, size: 16),
                label: const Text('Reply', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              ),
            ],
          ),

          // Answers thread list if any
          if (post.answers.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: post.answers.map((ans) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: ans.authorRole == 'Faculty' ? AppColors.secondary.withAlpha(20) : AppColors.primary.withAlpha(20),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                ans.authorRole,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: ans.authorRole == 'Faculty' ? AppColors.secondary : AppColors.primary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              ans.author,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy),
                            ),
                            const Spacer(),
                            Text(ans.time, style: const TextStyle(fontSize: 10.5, color: AppColors.textTertiary)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          ans.content,
                          style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
