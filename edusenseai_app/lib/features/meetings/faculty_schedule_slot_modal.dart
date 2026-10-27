import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/subject_model.dart';
import '../../providers/faculty_dashboard_provider.dart';
import '../../providers/meeting_provider.dart';

/// Modal bottom sheet allowing faculty to schedule an office hour slot,
/// 1-on-1 consultation, or group lecture with live Microsoft Teams creation.
class FacultyScheduleSlotModal extends StatefulWidget {
  final VoidCallback? onSlotCreated;

  const FacultyScheduleSlotModal({super.key, this.onSlotCreated});

  @override
  State<FacultyScheduleSlotModal> createState() =>
      _FacultyScheduleSlotModalState();
}

class _FacultyScheduleSlotModalState extends State<FacultyScheduleSlotModal> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();
  final _descController = TextEditingController();
  final _capacityController = TextEditingController(text: '1');

  SubjectModel? _selectedSubject;
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _startTime = const TimeOfDay(hour: 10, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 10, minute: 30);

  String _audienceType =
      'department'; // 'department' | 'specific_students' | 'all'
  final List<String> _selectedStudentIds = [];
  bool _createTeamsMeeting = true;

  @override
  void dispose() {
    _topicController.dispose();
    _descController.dispose();
    _capacityController.dispose();
    super.dispose();
  }

  DateTime _combineDateAndTime(DateTime date, TimeOfDay time) {
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickStartTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime,
    );
    if (picked != null) {
      setState(() {
        _startTime = picked;
        // Auto-set end time 30 mins later
        final endMinute = (picked.minute + 30) % 60;
        final endHour = picked.hour + ((picked.minute + 30) ~/ 60);
        _endTime = TimeOfDay(hour: endHour % 24, minute: endMinute);
      });
    }
  }

  Future<void> _pickEndTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _endTime,
    );
    if (picked != null) {
      setState(() => _endTime = picked);
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final startDateTime = _combineDateAndTime(_selectedDate, _startTime);
    final endDateTime = _combineDateAndTime(_selectedDate, _endTime);
    final now = DateTime.now();

    if (startDateTime.isBefore(now)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot schedule sessions in the past.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    if (endDateTime.isBefore(startDateTime) ||
        endDateTime.isAtSameMomentAs(startDateTime)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('End time must be after start time.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    if (_audienceType == 'specific_students' && _selectedStudentIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please select at least one student for targeted invite.',
          ),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final meetingProv = context.read<MeetingProvider>();
    final capacity = int.tryParse(_capacityController.text) ?? 1;

    final success = await meetingProv.scheduleFacultySlot(
      topic: _topicController.text,
      subjectCode: _selectedSubject?.code,
      subjectName: _selectedSubject?.name,
      subjectId: _selectedSubject?.id,
      description: _descController.text,
      startTime: startDateTime,
      endTime: endDateTime,
      capacity: capacity,
      audienceType: _audienceType,
      invitedStudentIds:
          _audienceType == 'specific_students' ? _selectedStudentIds : null,
      createTeamsMeeting: _createTeamsMeeting,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            meetingProv.successMessage ?? 'Session scheduled successfully!',
          ),
          backgroundColor: AppColors.success,
        ),
      );
      widget.onSlotCreated?.call();
      Navigator.of(context).pop(true);
    } else if (mounted && meetingProv.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(meetingProv.errorMessage!),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final meetingProv = context.watch<MeetingProvider>();
    final facultyProv = context.watch<FacultyDashboardProvider>();
    final subjects = facultyProv.assignedSubjects;
    final eligibleStudents = meetingProv.eligibleStudents;

    final dateFormatted = DateFormat('EEE, MMM d, yyyy').format(_selectedDate);

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.add_to_photos_rounded,
                          color: AppColors.primaryNavy,
                          size: 22,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Schedule Session Slot',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primaryNavy,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Session Topic
                const Text(
                  'Topic / Session Title *',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _topicController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Unit 3 Doubt Session & Viva Prep',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate400,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.slate300),
                    ),
                  ),
                  validator:
                      (v) =>
                          v == null || v.trim().isEmpty
                              ? 'Topic is required'
                              : null,
                ),

                const SizedBox(height: 14),

                // Subject Selection
                const Text(
                  'Subject Course *',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<SubjectModel>(
                  value: _selectedSubject,
                  isExpanded: true,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.slate300),
                    ),
                  ),
                  hint: const Text(
                    'Choose subject',
                    style: TextStyle(fontSize: 13),
                  ),
                  items:
                      subjects.map((sub) {
                        return DropdownMenuItem<SubjectModel>(
                          value: sub,
                          child: Text(
                            '${sub.code}: ${sub.name}',
                            style: const TextStyle(fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                  onChanged: (val) => setState(() => _selectedSubject = val),
                  validator:
                      (val) => val == null ? 'Please select a subject' : null,
                ),

                const SizedBox(height: 14),

                // Date Picker Tile
                const Text(
                  'Date & Time *',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      flex: 5,
                      child: InkWell(
                        onTap: _pickDate,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.slate300),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.calendar_today_outlined,
                                size: 16,
                                color: AppColors.primaryNavy,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  dateFormatted,
                                  style: const TextStyle(fontSize: 12.5),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: InkWell(
                        onTap: _pickStartTime,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.slate300),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _startTime.format(context),
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ),
                    const Text(' - '),
                    Expanded(
                      flex: 3,
                      child: InkWell(
                        onTap: _pickEndTime,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.slate300),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _endTime.format(context),
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // Audience Type
                const Text(
                  'Audience & Target Students',
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _audienceType,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.slate300),
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'department',
                      child: Text(
                        'All Department Students (Open Office Hours)',
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'specific_students',
                      child: Text('Specific Students (Targeted Remediation)'),
                    ),
                    DropdownMenuItem(
                      value: 'all',
                      child: Text('Open Campus Session'),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _audienceType = val);
                  },
                ),

                // Specific students multi-select
                if (_audienceType == 'specific_students') ...[
                  const SizedBox(height: 10),
                  const Text(
                    'Select Students to Invite:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 140),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.slate300),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: eligibleStudents.length,
                      itemBuilder: (ctx, index) {
                        final student = eligibleStudents[index];
                        final isSelected = _selectedStudentIds.contains(
                          student.id,
                        );
                        return CheckboxListTile(
                          dense: true,
                          title: Text(
                            student.name,
                            style: const TextStyle(fontSize: 12.5),
                          ),
                          subtitle: Text(
                            student.email,
                            style: const TextStyle(fontSize: 11),
                          ),
                          value: isSelected,
                          onChanged: (checked) {
                            setState(() {
                              if (checked == true) {
                                _selectedStudentIds.add(student.id);
                              } else {
                                _selectedStudentIds.remove(student.id);
                              }
                            });
                          },
                        );
                      },
                    ),
                  ),
                ],

                const SizedBox(height: 14),

                // Microsoft Teams Toggle
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.videocam_rounded,
                        color: Color(0xFF4F46E5),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Generate Microsoft Teams Meeting',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF3730A3),
                              ),
                            ),
                            Text(
                              'Creates valid Teams join URL using Microsoft Graph.',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: _createTeamsMeeting,
                        activeColor: const Color(0xFF4F46E5),
                        onChanged:
                            (val) => setState(() => _createTeamsMeeting = val),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: meetingProv.isSubmitting ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryNavy,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child:
                        meetingProv.isSubmitting
                            ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                            : const Text(
                              'Publish Session Slot',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
