import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/meeting_slot_model.dart';
import '../../providers/meeting_provider.dart';

/// Modal bottom sheet allowing students to request a 1-on-1 consultation or book an open slot.
class RequestMeetingModal extends StatefulWidget {
  final MeetingSlotModel? initialSlot;
  final String? preselectedSlotId;
  final List<MeetingSlotModel>? availableSlots;
  final VoidCallback? onRequestSubmitted;

  const RequestMeetingModal({
    super.key,
    this.initialSlot,
    this.preselectedSlotId,
    this.availableSlots,
    this.onRequestSubmitted,
  });

  @override
  State<RequestMeetingModal> createState() => _RequestMeetingModalState();
}

class _RequestMeetingModalState extends State<RequestMeetingModal> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();
  final _descController = TextEditingController();

  MeetingSlotModel? _selectedSlot;

  @override
  void initState() {
    super.initState();
    _selectedSlot = widget.initialSlot;
    if (_selectedSlot == null &&
        widget.preselectedSlotId != null &&
        widget.availableSlots != null) {
      final match = widget.availableSlots!.where(
        (s) => s.id == widget.preselectedSlotId,
      );
      if (match.isNotEmpty) {
        _selectedSlot = match.first;
      }
    }
    if (_selectedSlot != null) {
      _topicController.text = _selectedSlot!.topic;
    }
  }

  @override
  void dispose() {
    _topicController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSlot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select an available faculty session slot.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final meetingProv = context.read<MeetingProvider>();
    final success = await meetingProv.requestMeeting(
      slotId: _selectedSlot!.id,
      topic: _topicController.text,
      doubtDescription: _descController.text,
      meetingType: 'one_on_one',
    );

    if (success && mounted) {
      widget.onRequestSubmitted?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Meeting request submitted! Awaiting faculty approval.',
          ),
          backgroundColor: AppColors.success,
        ),
      );
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
    final slots = meetingProv.availableSlots;

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
                          Icons.calendar_month_rounded,
                          color: AppColors.primaryNavy,
                          size: 22,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Request Consultation',
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
                const SizedBox(height: 6),
                const Text(
                  'Book a 1-on-1 doubt session with your course faculty. A Microsoft Teams meeting will be generated upon approval.',
                  style: TextStyle(fontSize: 12, color: AppColors.slate500),
                ),
                const SizedBox(height: 18),

                // Slot Selector
                const Text(
                  'Select Available Faculty Slot *',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.deepSlate,
                  ),
                ),
                const SizedBox(height: 6),
                if (widget.initialSlot != null)
                  _buildPrefilledSlotBanner(_selectedSlot!)
                else if (slots.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Text(
                      'No open faculty office hours available right now. Please check back later or contact your department.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                    ),
                  )
                else
                  DropdownButtonFormField<MeetingSlotModel>(
                    value: _selectedSlot,
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
                      'Choose a date & faculty slot',
                      style: TextStyle(fontSize: 13),
                    ),
                    items:
                        slots.map((s) {
                          final timeStr = DateFormat(
                            'EEE, MMM d • h:mm a',
                          ).format(s.startTime.toLocal());
                          return DropdownMenuItem<MeetingSlotModel>(
                            value: s,
                            child: Text(
                              '${s.subjectCode} - Prof. ${s.facultyName} ($timeStr)',
                              style: const TextStyle(fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                    onChanged: (val) {
                      setState(() {
                        _selectedSlot = val;
                        if (val != null && _topicController.text.isEmpty) {
                          _topicController.text = val.topic;
                        }
                      });
                    },
                    validator:
                        (val) => val == null ? 'Please select a slot' : null,
                  ),

                const SizedBox(height: 14),

                // Doubt Topic
                const Text(
                  'Doubt / Consultation Topic *',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.deepSlate,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _topicController,
                  decoration: InputDecoration(
                    hintText:
                        'e.g. Clarification on State Management & InheritedWidget',
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

                // Description
                const Text(
                  'Specific Questions or Description',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.deepSlate,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _descController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText:
                        'Describe where you got stuck or which assignment questions need review...',
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate400,
                    ),
                    contentPadding: const EdgeInsets.all(12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.slate300),
                    ),
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
                              'Submit Consultation Request',
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

  Widget _buildPrefilledSlotBanner(MeetingSlotModel slot) {
    final timeStr = DateFormat(
      'EEE, MMM d, yyyy • h:mm a',
    ).format(slot.startTime.toLocal());
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.slate300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryNavy,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  slot.subjectCode,
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Prof. ${slot.facultyName}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.deepSlate,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            timeStr,
            style: const TextStyle(fontSize: 11.5, color: AppColors.slate600),
          ),
        ],
      ),
    );
  }
}
