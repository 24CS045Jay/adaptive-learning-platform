import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Model representing an official institutional or course announcement.
class AnnouncementItem {
  final String id;
  final String title;
  final String message;
  final String scope;
  final String postedBy;
  final String date;
  final bool isImportant;

  const AnnouncementItem({
    required this.id,
    required this.title,
    required this.message,
    required this.scope,
    required this.postedBy,
    required this.date,
    this.isImportant = false,
  });
}

/// Screen providing 1:1 parity with the web portal's Announcements (/student/announcements, /faculty/announcements):
/// - Institution-wide broadcasts and enrolled course notices
/// - Scope filtering (Institution, Big Data Analytics, Machine Learning)
/// - Search filter by title, author, or content
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  String _selectedScope = 'All';
  String _searchQuery = '';

  final List<AnnouncementItem> _announcements = const [
    AnnouncementItem(
      id: 'ann-1',
      title: 'Mid-Semester Examination Schedule Announced',
      message:
          'The Mid-Semester theory examinations for Semester 5 will commence from November 10, 2026. '
          'Please review the detailed syllabus and timetable on your student portal.',
      scope: 'Institution',
      postedBy: 'Dean of Academic Affairs',
      date: 'Oct 20, 2026',
      isImportant: true,
    ),
    AnnouncementItem(
      id: 'ann-2',
      title: 'Machine Learning Lab Assignment 3 Submission Due Date Extended',
      message:
          'Due to the campus hackathon event this weekend, Lab Assignment 3 (Regularization & SVM) deadline is extended by 48 hours to Monday, 11:59 PM.',
      scope: 'Machine Learning',
      postedBy: 'Dr. Nisha Shah',
      date: 'Oct 19, 2026',
      isImportant: false,
    ),
    AnnouncementItem(
      id: 'ann-3',
      title: 'Guest Lecture on Cloud Infrastructure & Distributed Hadoop Clusters',
      message:
          'Join us for an interactive industry expert session on building enterprise Big Data pipelines. Microsoft Teams link will be shared 15 mins prior.',
      scope: 'Big Data Analytics',
      postedBy: 'Prof. Anil Kumar',
      date: 'Oct 17, 2026',
      isImportant: false,
    ),
  ];

  final List<String> _scopes = [
    'All',
    'Institution',
    'Big Data Analytics',
    'Machine Learning',
  ];

  List<AnnouncementItem> get _filteredAnnouncements {
    return _announcements.where((a) {
      if (_selectedScope != 'All' && a.scope != _selectedScope) {
        return false;
      }
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        return a.title.toLowerCase().contains(q) ||
            a.message.toLowerCase().contains(q) ||
            a.postedBy.toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _filteredAnnouncements;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Official Announcements', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search and Filter Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.white,
              child: Column(
                children: [
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search notices by title, content, or author...',
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
                      children: _scopes.map((s) {
                        final isSelected = _selectedScope == s;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(s == 'Institution' ? 'Institution-wide' : s),
                            selected: isSelected,
                            onSelected: (_) => setState(() => _selectedScope = s),
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

            // Announcement List
            Expanded(
              child: list.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.campaign_outlined, size: 48, color: AppColors.divider),
                          SizedBox(height: 12),
                          Text(
                            'No announcements found.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: list.length,
                      itemBuilder: (ctx, i) => _buildCard(list[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(AnnouncementItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: item.isImportant ? AppColors.warning : AppColors.divider,
        ),
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
          // Scope & Date Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: item.scope == 'Institution' ? const Color(0xFFFEF3C7) : AppColors.primary.withAlpha(15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.scope,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: item.scope == 'Institution' ? const Color(0xFFD97706) : AppColors.primary,
                  ),
                ),
              ),
              if (item.isImportant) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(20),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'IMPORTANT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.error,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              Text(item.date, style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary)),
            ],
          ),
          const SizedBox(height: 10),

          // Title
          Text(
            item.title,
            style: const TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w800,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 6),

          // Message
          Text(
            item.message,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),

          // Posted by
          Row(
            children: [
              const Icon(Icons.person_outline_rounded, size: 14, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(
                item.postedBy,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
