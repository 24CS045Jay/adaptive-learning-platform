import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/chat_message_model.dart';
import '../models/conversation_model.dart';

/// Response wrapper for AI Tutor query containing the conversation session and answer message.
class AskTutorResponse {
  final String conversationId;
  final ChatMessageModel message;

  const AskTutorResponse({required this.conversationId, required this.message});
}

/// Service connecting Flutter app to EduSense AI RAG Backend Pipeline.
class TutorService {
  final ApiClient _apiClient;

  TutorService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Queries the existing RAG AI tutor microservice with multi-turn conversation memory,
  /// learner adaptation level, and multi-language support (English, Hindi, Gujarati).
  Future<AskTutorResponse> askQuestion({
    required String question,
    String? subjectId,
    String? subjectCode,
    String? conversationId,
    String? learnerLevel,
    String? mode,
    String? responseLanguage,
    Map<String, dynamic>? learnerProfile,
  }) async {
    try {
      final payload = <String, dynamic>{
        'question': question.trim(),
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        if (subjectCode != null && subjectCode.isNotEmpty)
          'subjectCode': subjectCode,
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
        if (learnerLevel != null) 'learner_level': learnerLevel,
        if (learnerLevel != null) 'masteryLevel': learnerLevel,
        if (mode != null) 'mode': mode,
        if (responseLanguage != null) 'response_language': responseLanguage,
        if (learnerProfile != null) 'learner_profile': learnerProfile,
      };

      final response = await _apiClient.post(
        AppConfig.tutorAskEndpoint,
        data: payload,
      );

      if (response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final convId =
            (data['conversationId'] ?? conversationId ?? '').toString();
        final message = ChatMessageModel.fromJson(data);
        return AskTutorResponse(conversationId: convId, message: message);
      }

      throw AppException('Invalid response structure received from AI Tutor.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to consult EduSense AI Tutor: $e');
    }
  }

  /// Lists student's prior conversation sessions with the AI Tutor.
  Future<List<ConversationModel>> getConversations() async {
    try {
      final response = await _apiClient.get(AppConfig.conversationsEndpoint);
      if (response.data is List) {
        return (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map((json) => ConversationModel.fromJson(json))
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to fetch conversation history: $e');
    }
  }

  /// Loads full multi-turn chat message history for a specific conversation.
  Future<List<ChatMessageModel>> getConversation(String conversationId) async {
    try {
      final response = await _apiClient.get(
        '${AppConfig.conversationsEndpoint}/$conversationId',
      );

      if (response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final rawMessages = data['messages'];
        if (rawMessages is List) {
          return rawMessages
              .whereType<Map<String, dynamic>>()
              .map((json) => ChatMessageModel.fromJson(json))
              .toList();
        }
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to load conversation messages: $e');
    }
  }

  /// Permanently deletes a student's conversation thread.
  Future<void> deleteConversation(String conversationId) async {
    try {
      await _apiClient.delete(
        '${AppConfig.conversationsEndpoint}/$conversationId',
      );
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to delete conversation: $e');
    }
  }

  /// Submits student rating / feedback on an AI Tutor response turn.
  Future<bool> submitFeedback({
    required String question,
    required String answer,
    required bool isThumbsUp,
    String? comment,
    String? subjectId,
  }) async {
    try {
      final response = await _apiClient.post(
        AppConfig.feedbackEndpoint,
        data: {
          'question': question,
          'answer': answer,
          'rating': isThumbsUp ? 'up' : 'down',
          'isThumbsUp': isThumbsUp,
          if (comment != null && comment.isNotEmpty) 'comment': comment,
          if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }
}
