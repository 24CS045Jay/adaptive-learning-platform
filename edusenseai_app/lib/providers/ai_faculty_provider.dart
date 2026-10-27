import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/ai_faculty_model.dart';
import '../services/ai_faculty_service.dart';
import '../services/session_cleanup_service.dart';

/// Phase 7: State management for the AI Faculty Real-Time Voice & Avatar Experience.
///
/// Implements:
/// - Conversational state machine (`idle`, `connecting`, `listening`, `processing`, `speaking`, `interrupting`, `ended`)
/// - Monotonic turn-token barge-in interruption (instantly halts audio & discards late RAG replies)
/// - Trilingual language selection (English `en-IN`, Hindi `hi-IN`, Gujarati `gu-IN`)
/// - Grounded RAG turn handling with syllabus citation rendering
/// - Tavus CVI WebRTC session coordination
class AiFacultyProvider extends ChangeNotifier {
  final AiFacultyService _service;

  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  AiFacultyProvider({AiFacultyService? service})
    : _service = service ?? AiFacultyService() {
    _cleanupHandler = () async {
      await endSession();
      _messages.clear();
      _session = null;
      _state = AiFacultyState.idle;
      _errorMessage = null;
      if (!_disposed && hasListeners) {
        notifyListeners();
      }
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  // State
  AiFacultyState _state = AiFacultyState.idle;
  AiFacultySessionModel? _session;
  final List<AiFacultyMessage> _messages = [];
  String _selectedLanguage = 'en-IN';
  String _selectedSpeaker = 'anushka';
  String _learnerLevel = 'intermediate';
  double _speechPace = 1.0;
  bool _isAudioMuted = false;
  String? _currentSpokenText;
  String? _errorMessage;
  bool _isConnecting = false;

  // Interruption / Barge-in Tracking
  int _currentTurnId = 0;
  CancelToken? _activeCancelToken;
  Timer? _speakingTimer;

  // Tavus Video Call State
  TavusSessionModel? _tavusSession;
  bool _isTavusActive = false;

  // Getters
  AiFacultyState get state => _state;
  AiFacultySessionModel? get session => _session;
  List<AiFacultyMessage> get messages => List.unmodifiable(_messages);
  String get selectedLanguage => _selectedLanguage;
  String get selectedSpeaker => _selectedSpeaker;
  String get learnerLevel => _learnerLevel;
  double get speechPace => _speechPace;
  bool get isAudioMuted => _isAudioMuted;
  String? get currentSpokenText => _currentSpokenText;
  String? get errorMessage => _errorMessage;
  bool get isConnecting => _isConnecting;
  int get currentTurnId => _currentTurnId;
  TavusSessionModel? get tavusSession => _tavusSession;
  bool get isTavusActive => _isTavusActive;

  /// Starts or joins an AI Faculty classroom session.
  Future<bool> startSession({
    required String subjectCode,
    String? subjectId,
    String? subjectName,
    String? languageCode,
    String? speaker,
  }) async {
    _isConnecting = true;
    _state = AiFacultyState.connecting;
    _errorMessage = null;
    notifyListeners();

    try {
      final lang = languageCode ?? _selectedLanguage;
      final spk = speaker ?? _selectedSpeaker;

      final newSession = await _service.createSession(
        subjectCode: subjectCode,
        subjectId: subjectId,
        languageCode: lang,
        speaker: spk,
      );

      _session = newSession;
      _selectedLanguage = lang;
      _selectedSpeaker = spk;

      // Add Teacher Greeting Message
      if (newSession.greeting.isNotEmpty) {
        _messages.add(
          AiFacultyMessage(
            id: 'msg-greeting-${DateTime.now().millisecondsSinceEpoch}',
            role: 'faculty',
            text: newSession.greeting,
            timestamp: DateTime.now(),
            type: 'voice',
            turnId: 0,
          ),
        );
        _currentSpokenText = newSession.greeting;
        _state = AiFacultyState.speaking;
        _scheduleSpeakingCompletion(durationSeconds: 4);
      } else {
        _state = AiFacultyState.listening;
      }

      _isConnecting = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _state = AiFacultyState.error;
      _isConnecting = false;
      notifyListeners();
      return false;
    }
  }

  /// Sends a question to the AI Faculty RAG pipeline.
  /// Handles both typed and voice-transcribed questions.
  Future<void> askQuestion(String questionText, {bool isVoice = false}) async {
    final cleanQuestion = questionText.trim();
    if (cleanQuestion.isEmpty) return;

    // Increment turn token to invalidate any previous responses
    final thisTurn = ++_currentTurnId;
    _activeCancelToken?.cancel('Superseded by turn $thisTurn');
    _activeCancelToken = CancelToken();

    // Add Student question to transcript
    _messages.add(
      AiFacultyMessage(
        id: 'msg-std-${DateTime.now().millisecondsSinceEpoch}',
        role: 'student',
        text: cleanQuestion,
        timestamp: DateTime.now(),
        type: isVoice ? 'voice' : 'typed',
        turnId: thisTurn,
      ),
    );

    _state = AiFacultyState.processing;
    _currentSpokenText = null;
    _errorMessage = null;
    notifyListeners();

    try {
      final subjectCode = _session?.subjectCode ?? 'CSUC501';
      final subjectId = _session?.subjectId;
      final convId = _session?.conversationId;

      final result = await _service.interact(
        question: cleanQuestion,
        subjectCode: subjectCode,
        subjectId: subjectId,
        conversationId: convId,
        languageCode: _selectedLanguage,
        learnerLevel: _learnerLevel,
        turnId: thisTurn,
        speaker: _selectedSpeaker,
        pace: _speechPace,
        audioRequested: !_isAudioMuted,
        cancelToken: _activeCancelToken,
      );

      // Verify this response belongs to the active turn (Barge-in safety)
      if (thisTurn != _currentTurnId) {
        // Obsolete response discarded
        return;
      }

      // Add Faculty response to transcript
      _messages.add(
        AiFacultyMessage(
          id: 'msg-fac-${DateTime.now().millisecondsSinceEpoch}',
          role: 'faculty',
          text: result.fullAnswer.isNotEmpty ? result.fullAnswer : result.spokenAnswer,
          timestamp: DateTime.now(),
          type: 'voice',
          sources: result.sources,
          audioBase64: result.audioBase64,
          turnId: thisTurn,
        ),
      );

      _currentSpokenText = result.spokenAnswer.isNotEmpty ? result.spokenAnswer : result.fullAnswer;

      if (!_isAudioMuted) {
        _state = AiFacultyState.speaking;
        // Estimate speech duration based on word count (approx 130 words per minute)
        final wordCount = _currentSpokenText!.split(' ').length;
        final seconds = (wordCount / 2.2).ceil().clamp(3, 15);
        _scheduleSpeakingCompletion(durationSeconds: seconds);
      } else {
        _state = AiFacultyState.listening;
      }

      notifyListeners();
    } catch (e) {
      if (thisTurn != _currentTurnId) return; // Discard canceled errors

      _errorMessage = e.toString();
      _state = AiFacultyState.listening;
      notifyListeners();
    }
  }

  /// Triggers immediate Barge-in / Interruption.
  /// Halts current speech, cancels active network request, increments turn token,
  /// and shifts state back to listening immediately.
  void interruptTeacher() {
    if (_state == AiFacultyState.speaking || _state == AiFacultyState.processing) {
      _speakingTimer?.cancel();
      _speakingTimer = null;

      // Invalidate active turn & cancel in-flight network query
      _currentTurnId++;
      _activeCancelToken?.cancel('Interrupted by student');
      _activeCancelToken = null;

      _state = AiFacultyState.interrupting;
      _currentSpokenText = null;
      notifyListeners();

      // Brief transition into listening
      Future.delayed(const Duration(milliseconds: 150), () {
        if (_state == AiFacultyState.interrupting) {
          _state = AiFacultyState.listening;
          notifyListeners();
        }
      });
    }
  }

  /// Changes the conversational language (`en-IN`, `hi-IN`, `gu-IN`).
  void setLanguage(String langCode) {
    if (_selectedLanguage == langCode) return;
    _selectedLanguage = langCode;
    notifyListeners();
  }

  /// Changes the faculty speaker persona (`anushka`, `shubh`, `ritu`, `aditya`).
  void setSpeaker(String speakerId) {
    if (_selectedSpeaker == speakerId) return;
    _selectedSpeaker = speakerId;
    notifyListeners();
  }

  /// Changes the explanation depth level (`beginner`, `intermediate`, `advanced`).
  void setLearnerLevel(String level) {
    if (_learnerLevel == level) return;
    _learnerLevel = level;
    notifyListeners();
  }

  /// Toggles spoken audio playback mute status.
  void toggleAudioMute() {
    _isAudioMuted = !_isAudioMuted;
    if (_isAudioMuted && _state == AiFacultyState.speaking) {
      interruptTeacher();
    } else {
      notifyListeners();
    }
  }

  /// Adjusts speech playback pace (0.85x to 1.25x).
  void setSpeechPace(double pace) {
    _speechPace = pace.clamp(0.85, 1.25);
    notifyListeners();
  }

  /// Starts a live Tavus WebRTC photorealistic video replica call.
  Future<String?> launchTavusVideoCall() async {
    final subName = _session?.subjectName ?? 'Computer Science';
    final subCode = _session?.subjectCode ?? 'CSUC501';

    try {
      final tavus = await _service.startTavusSession(
        subjectName: subName,
        subjectCode: subCode,
        languageCode: _selectedLanguage,
      );
      _tavusSession = tavus;
      _isTavusActive = true;
      notifyListeners();
      return tavus.conversationUrl;
    } catch (e) {
      _errorMessage = 'Tavus call initiation notice: $e';
      notifyListeners();
      return null;
    }
  }

  /// Clears the in-memory transcript.
  void clearTranscript() {
    _messages.clear();
    notifyListeners();
  }

  /// Gracefully concludes the AI Faculty session and releases resources.
  Future<void> endSession() async {
    _speakingTimer?.cancel();
    _speakingTimer = null;
    _activeCancelToken?.cancel('Session ended');
    _activeCancelToken = null;

    if (_tavusSession != null && _tavusSession!.conversationId.isNotEmpty) {
      await _service.endTavusSession(_tavusSession!.conversationId);
      _tavusSession = null;
      _isTavusActive = false;
    }

    _state = AiFacultyState.ended;
    _currentSpokenText = null;

    _messages.add(
      AiFacultyMessage(
        id: 'msg-end-${DateTime.now().millisecondsSinceEpoch}',
        role: 'system',
        text: 'Live Session Concluded. All learning turns have been recorded.',
        timestamp: DateTime.now(),
        type: 'system',
      ),
    );

    notifyListeners();
  }

  void _scheduleSpeakingCompletion({required int durationSeconds}) {
    _speakingTimer?.cancel();
    _speakingTimer = Timer(Duration(seconds: durationSeconds), () {
      if (_state == AiFacultyState.speaking) {
        _state = AiFacultyState.listening;
        _currentSpokenText = null;
        notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _disposed = true;
    SessionCleanupService().unregisterHandler(_cleanupHandler);
    _speakingTimer?.cancel();
    _activeCancelToken?.cancel('Provider disposed');
    super.dispose();
  }
}
