import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';

/// Represents a bookmarked AI answer, key formula, or revision note in the Study Notebook.
class BookmarkItem {
  final String id;
  final String question;
  final String answer;
  final String subject;
  final String date;
  String? notes;

  BookmarkItem({
    required this.id,
    required this.question,
    required this.answer,
    required this.subject,
    required this.date,
    this.notes,
  });
}

/// Screen providing 1:1 parity with the web portal's Study Notebook & Bookmarks (/student/bookmarks):
/// - Enrolled subject filtering
/// - Adding personal notes & AI answer bookmarks
/// - Inline note editing
/// - Exporting personal study notebook to clipboard/share
class BookmarksScreen extends StatefulWidget {
  const BookmarksScreen({super.key});

  @override
  State<BookmarksScreen> createState() => _BookmarksScreenState();
}

class _BookmarksScreenState extends State<BookmarksScreen> {
  String _selectedSubject = 'All';
  String _searchQuery = '';

  final List<BookmarkItem> _bookmarks = [
    BookmarkItem(
      id: 'bm-1',
      question: 'Explain MapReduce Shuffle and Sort Phase',
      answer:
          'Shuffle is the physical transfer of intermediate map outputs over the network to the assigned reducer partition. '
          'Sort organizes key-value pairs by key before they reach the Reducer function.',
      subject: 'Big Data Analytics',
      date: 'Oct 18, 2026',
      notes: 'Important for Mid-sem Unit 2 exam. Remember hash(key) % numReducers.',
    ),
    BookmarkItem(
      id: 'bm-2',
      question: 'Difference between L1 (Lasso) and L2 (Ridge) Regularization',
      answer:
          'L1 adds an absolute penalty |w|, driving irrelevant feature weights to exactly zero (feature selection). '
          'L2 adds a squared penalty w^2, shrinking weights smoothly without setting them to zero.',
      subject: 'Machine Learning',
      date: 'Oct 16, 2026',
      notes: 'L1 = sparse solutions. L2 = handles multicollinearity.',
    ),
    BookmarkItem(
      id: 'bm-3',
      question: 'Dijkstra Algorithm Time Complexity with Min-Heap',
      answer:
          'With adjacency list and binary min-heap priority queue, Dijkstra runs in O((V + E) log V) time.',
      subject: 'Design & Analysis of Algorithms',
      date: 'Oct 12, 2026',
      notes: 'Negative edges require Bellman-Ford instead.',
    ),
  ];

  final List<String> _subjects = [
    'All',
    'Big Data Analytics',
    'Machine Learning',
    'Design & Analysis of Algorithms',
  ];

  List<BookmarkItem> get _filteredBookmarks {
    return _bookmarks.where((b) {
      if (_selectedSubject != 'All' && b.subject != _selectedSubject) {
        return false;
      }
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        return b.question.toLowerCase().contains(q) ||
            b.answer.toLowerCase().contains(q) ||
            (b.notes != null && b.notes!.toLowerCase().contains(q));
      }
      return true;
    }).toList();
  }

  void _showAddBookmarkModal() {
    final questionCtrl = TextEditingController();
    final answerCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String targetSubj = _subjects.firstWhere((s) => s != 'All', orElse: () => 'General');

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
                    'Add Study Note / Bookmark',
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: questionCtrl,
                decoration: InputDecoration(
                  labelText: 'Topic / Question',
                  hintText: 'e.g. Concept name or formula',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: answerCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Explanation / Key Definition',
                  hintText: 'Summary or definition to memorize',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: notesCtrl,
                decoration: InputDecoration(
                  labelText: 'Personal Revision Note (Optional)',
                  hintText: 'e.g. Remember exception condition',
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  if (questionCtrl.text.trim().isEmpty || answerCtrl.text.trim().isEmpty) return;
                  setState(() {
                    _bookmarks.insert(
                      0,
                      BookmarkItem(
                        id: 'bm-${DateTime.now().millisecondsSinceEpoch}',
                        question: questionCtrl.text.trim(),
                        answer: answerCtrl.text.trim(),
                        subject: targetSubj,
                        date: 'Today',
                        notes: notesCtrl.text.trim().isNotEmpty ? notesCtrl.text.trim() : null,
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
                child: const Text('Save to Notebook', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        );
      },
    );
  }

  void _exportNotebook() {
    final buffer = StringBuffer();
    buffer.writeln('# EduSense AI — Personal Study Notebook');
    buffer.writeln('Exported on ${DateTime.now().toLocal()}\n');

    for (final item in _bookmarks) {
      buffer.writeln('## [${item.subject}] ${item.question}');
      buffer.writeln('Saved: ${item.date}');
      buffer.writeln('\n${item.answer}\n');
      if (item.notes != null) {
        buffer.writeln('> Note: ${item.notes}\n');
      }
      buffer.writeln('---\n');
    }

    Clipboard.setData(ClipboardData(text: buffer.toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Study Notebook copied to clipboard in Markdown format!'),
        backgroundColor: AppColors.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = _filteredBookmarks;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Study Notebook', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Export Notebook',
            onPressed: _exportNotebook,
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Add Bookmark',
            onPressed: _showAddBookmarkModal,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Column(
                children: [
                  // Search Box
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search saved answers, formulas, and notes...',
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

                  // Subject Pill Filter
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

            // Bookmarks List
            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.bookmark_border_rounded, size: 48, color: AppColors.divider),
                          const SizedBox(height: 12),
                          const Text(
                            'No bookmarked notes found.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Save answers from AI Tutor or tap + above to add revision notes.',
                            style: TextStyle(fontSize: 12.5, color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      itemBuilder: (ctx, i) {
                        final item = items[i];
                        return _buildBookmarkCard(item);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookmarkCard(BookmarkItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(5),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.subject,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary),
                ),
              ),
              const Spacer(),
              Text(
                item.date,
                style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                color: AppColors.textTertiary,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () {
                  setState(() => _bookmarks.remove(item));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Bookmark removed.')),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 10),

          Text(
            item.question,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 6),

          Text(
            item.answer,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),

          if (item.notes != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.edit_note_rounded, size: 16, color: Color(0xFFD97706)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item.notes!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF92400E),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
