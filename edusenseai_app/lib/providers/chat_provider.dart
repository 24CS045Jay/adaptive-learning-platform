import 'package:flutter/foundation.dart';
import '../models/chat_message_model.dart';
import '../models/conversation_model.dart';
import '../models/subject_model.dart';
import '../services/session_cleanup_service.dart';
import '../services/tutor_service.dart';

/// State management for the EduSense AI RAG Chatbot.
class ChatProvider extends ChangeNotifier {
  final TutorService _tutorService;

  List<ChatMessageModel> _messages = [];
  List<ConversationModel> _conversations = [];
  String? _currentConversationId;
  SubjectModel? _selectedSubject;
  bool _isLoading = false;
  bool _isHistoryLoading = false;
  String? _errorMessage;
  String? _lastFailedQuestion;
  String _selectedLanguage = 'en'; // 'en' | 'hi' | 'gu'
  String _learnerLevel = 'intermediate'; // 'beginner' | 'intermediate' | 'advanced'
  final Map<String, String> _feedbackStatus = {};
  bool _disposed = false;
  late final LogoutCleanupHandler _cleanupHandler;

  ChatProvider({TutorService? tutorService})
    : _tutorService = tutorService ?? TutorService() {
    _cleanupHandler = () async {
      clearSessionData();
    };
    SessionCleanupService().registerHandler(_cleanupHandler);
  }

  /// Wipes all active chat and conversation history upon sign-out
  void clearSessionData() {
    _messages = [];
    _conversations = [];
    _currentConversationId = null;
    _selectedSubject = null;
    _errorMessage = null;
    _lastFailedQuestion = null;
    _feedbackStatus.clear();
    if (!_disposed && hasListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    SessionCleanupService().unregisterHandler(_cleanupHandler);
    super.dispose();
  }

  // Getters
  List<ChatMessageModel> get messages => List.unmodifiable(_messages);
  List<ConversationModel> get conversations =>
      List.unmodifiable(_conversations);
  String? get currentConversationId => _currentConversationId;
  SubjectModel? get selectedSubject => _selectedSubject;
  bool get isLoading => _isLoading;
  bool get isHistoryLoading => _isHistoryLoading;
  String? get errorMessage => _errorMessage;
  bool get canRetry => _lastFailedQuestion != null;
  String get selectedLanguage => _selectedLanguage;
  String get learnerLevel => _learnerLevel;
  Map<String, String> get feedbackStatus => Map.unmodifiable(_feedbackStatus);

  /// Sets or clears the active subject filter for the AI Tutor.
  void setSubject(SubjectModel? subject) {
    if (_selectedSubject?.id == subject?.id) return;
    _selectedSubject = subject;
    notifyListeners();
  }

  /// Sets the preferred language for tutor answers ('en', 'hi', 'gu').
  void setLanguage(String lang) {
    if (_selectedLanguage == lang) return;
    _selectedLanguage = lang;
    notifyListeners();
  }

  /// Sets the explanation depth level ('beginner', 'intermediate', 'advanced').
  void setLearnerLevel(String level) {
    if (_learnerLevel == level) return;
    _learnerLevel = level;
    notifyListeners();
  }

  /// Starts a fresh conversation session.
  void startNewChat() {
    _messages = [];
    _currentConversationId = null;
    _errorMessage = null;
    _lastFailedQuestion = null;
    notifyListeners();
  }

  /// Loads prior conversation threads for the authenticated student.
  Future<void> loadConversations() async {
    _isHistoryLoading = true;
    notifyListeners();

    try {
      _conversations = await _tutorService.getConversations();
    } catch (e) {
      debugPrint('[ChatProvider] Error loading conversations: $e');
    } finally {
      _isHistoryLoading = false;
      notifyListeners();
    }
  }

  /// Opens an existing conversation and loads its messages.
  Future<void> selectConversation(ConversationModel conv) async {
    _currentConversationId = conv.id;
    _isLoading = true;
    _errorMessage = null;
    _messages = [];
    notifyListeners();

    try {
      _messages = await _tutorService.getConversation(conv.id);
    } catch (e) {
      _errorMessage = 'Failed to load conversation history: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Deletes a conversation thread.
  Future<void> deleteConversation(String convId) async {
    try {
      await _tutorService.deleteConversation(convId);
      _conversations.removeWhere((c) => c.id == convId);
      if (_currentConversationId == convId) {
        startNewChat();
      } else {
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = 'Failed to delete conversation: $e';
      notifyListeners();
    }
  }

  /// Sends a question to the backend RAG pipeline with language & learner level context.
  Future<void> sendMessage(String question, {String? mode}) async {
    final trimmed = question.trim();
    if (trimmed.isEmpty || _isLoading) return;

    _errorMessage = null;
    _lastFailedQuestion = null;

    // 1. Add student query
    final studentMsg = ChatMessageModel.student(text: trimmed);
    _messages.add(studentMsg);

    // 2. Add loading placeholder
    final loadingMsg = ChatMessageModel.loading();
    _messages.add(loadingMsg);
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _tutorService.askQuestion(
        question: trimmed,
        subjectId: _selectedSubject?.id,
        subjectCode: _selectedSubject?.code,
        conversationId: _currentConversationId,
        learnerLevel: _learnerLevel,
        mode: mode,
        responseLanguage: _selectedLanguage,
      );

      // Remove loading message
      _messages.removeWhere((m) => m.id == loadingMsg.id);

      // Add response message
      _currentConversationId = response.conversationId;
      _messages.add(response.message);

      // Refresh conversations list in background
      loadConversations();
    } catch (e) {
      // Remove loading message
      _messages.removeWhere((m) => m.id == loadingMsg.id);
      _lastFailedQuestion = trimmed;
      _errorMessage = e.toString();

      // Add error message turn so user sees notice and retry button
      _messages.add(
        ChatMessageModel.error(
          'Could not reach AI Tutor. Please check your network or try again.',
        ),
      );
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Submits student feedback on a specific tutor turn.
  Future<bool> submitFeedback({
    required ChatMessageModel message,
    required bool isThumbsUp,
    String? comment,
  }) async {
    // Find the student question that preceded this message
    final msgIndex = _messages.indexOf(message);
    String question = 'Question';
    if (msgIndex > 0 && _messages[msgIndex - 1].isStudent) {
      question = _messages[msgIndex - 1].text;
    }

    final success = await _tutorService.submitFeedback(
      question: question,
      answer: message.text,
      isThumbsUp: isThumbsUp,
      comment: comment,
      subjectId: _selectedSubject?.id,
    );

    if (success) {
      _feedbackStatus[message.id] = isThumbsUp ? 'helpful' : 'unhelpful';
      notifyListeners();
    }
    return success;
  }

  /// Retries the most recent failed question.
  Future<void> retryLastMessage() async {
    if (_lastFailedQuestion == null) return;
    final retryText = _lastFailedQuestion!;
    // Remove trailing error message if present
    if (_messages.isNotEmpty && _messages.last.hasError) {
      _messages.removeLast();
    }
    // Remove student question duplicate if already present
    if (_messages.isNotEmpty &&
        _messages.last.isStudent &&
        _messages.last.text == retryText) {
      _messages.removeLast();
    }
    await sendMessage(retryText);
  }
}
