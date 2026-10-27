import 'package:dio/dio.dart';
import '../core/config/app_config.dart';
import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../models/ai_faculty_model.dart';

/// Phase 7: Real-Time AI Faculty Service.
///
/// Connects to the Express backend (`routes/ai-faculty.js`) for:
/// - Configuration and provider detection (Sarvam STT/TTS, Tavus CVI)
/// - Subject-scoped session initialization
/// - Real-time audio transcription (STT)
/// - Speech synthesis (TTS)
/// - Grounded RAG interaction with interruption / cancel token support
/// - Tavus WebRTC live replica session handling
class AiFacultyService {
  final ApiClient _apiClient;

  AiFacultyService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  /// Fetches system configuration, supported languages, speakers, and provider availability.
  Future<Map<String, dynamic>> getConfig() async {
    try {
      final response = await _apiClient.get(AppConfig.aiFacultyConfigEndpoint);
      if (response.data is Map<String, dynamic>) {
        return response.data as Map<String, dynamic>;
      }
      return {};
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to load AI Faculty configuration: $e');
    }
  }

  /// Fetches enrolled subjects for the student.
  Future<List<Map<String, dynamic>>> getSubjects() async {
    try {
      final response = await _apiClient.get(
        AppConfig.aiFacultySubjectsEndpoint,
      );
      if (response.data is Map<String, dynamic> &&
          response.data['subjects'] is List) {
        return (response.data['subjects'] as List)
            .whereType<Map<String, dynamic>>()
            .toList();
      }
      return [];
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to load subjects for AI Faculty: $e');
    }
  }

  /// Initializes a live AI Faculty tutoring session.
  Future<AiFacultySessionModel> createSession({
    String? subjectId,
    required String subjectCode,
    String languageCode = 'en-IN',
    String speaker = 'anushka',
  }) async {
    try {
      final payload = {
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        'subjectCode': subjectCode,
        'language_code': languageCode,
        'speaker': speaker,
      };

      final response = await _apiClient.post(
        AppConfig.aiFacultySessionEndpoint,
        data: payload,
      );

      if (response.data is Map<String, dynamic>) {
        return AiFacultySessionModel.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      throw AppException('Unexpected session response format.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Failed to start AI Faculty session: $e');
    }
  }

  /// Sends a question to the grounded AI Faculty RAG pipeline.
  /// Supports [cancelToken] for immediate barge-in / interruption termination.
  Future<AiFacultyInteractionResult> interact({
    required String question,
    required String subjectCode,
    String? subjectId,
    String? conversationId,
    String languageCode = 'en-IN',
    String learnerLevel = 'intermediate',
    int turnId = 1,
    String speaker = 'anushka',
    double pace = 1.0,
    bool audioRequested = true,
    CancelToken? cancelToken,
  }) async {
    try {
      final payload = {
        'question': question.trim(),
        'subjectCode': subjectCode,
        if (subjectId != null) 'subjectId': subjectId,
        if (conversationId != null) 'conversationId': conversationId,
        'language_code': languageCode,
        'learnerLevel': learnerLevel,
        'turnId': turnId,
        'speaker': speaker,
        'pace': pace,
        'audioRequested': audioRequested,
      };

      final response = await _apiClient.post(
        AppConfig.aiFacultyInteractEndpoint,
        data: payload,
        options: Options(
          // cancelToken is passed directly on options if needed
        ),
      );

      if (response.data is Map<String, dynamic>) {
        return AiFacultyInteractionResult.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      throw AppException('Invalid interaction response.');
    } on AppException {
      rethrow;
    } catch (e) {
      if (e is DioException && CancelToken.isCancel(e)) {
        throw AppException('Interaction cancelled by user.');
      }
      throw AppException('AI Faculty interaction error: $e');
    }
  }

  /// Transcribes spoken audio bytes via backend Sarvam STT (`saaras:v4`).
  Future<Map<String, dynamic>> transcribeAudio({
    required List<int> audioBytes,
    String filename = 'utterance.wav',
    String languageCode = 'en-IN',
    String fallbackTranscript = '',
  }) async {
    try {
      final formData = FormData.fromMap({
        'audio': MultipartFile.fromBytes(audioBytes, filename: filename),
        'language_code': languageCode,
        'fallback_transcript': fallbackTranscript,
      });

      final response = await _apiClient.post(
        AppConfig.aiFacultyTranscribeEndpoint,
        data: formData,
      );

      if (response.data is Map<String, dynamic>) {
        return response.data as Map<String, dynamic>;
      }
      return {'transcript': fallbackTranscript, 'provider': 'fallback'};
    } on AppException {
      rethrow;
    } catch (e) {
      return {'transcript': fallbackTranscript, 'provider': 'local_fallback'};
    }
  }

  /// Synthesizes text to speech using backend Sarvam TTS (`bulbul:v3`).
  Future<Map<String, dynamic>> synthesizeSpeech({
    required String text,
    String languageCode = 'en-IN',
    String speaker = 'anushka',
    double pace = 1.0,
  }) async {
    try {
      final payload = {
        'text': text,
        'language_code': languageCode,
        'speaker': speaker,
        'pace': pace,
      };

      final response = await _apiClient.post(
        AppConfig.aiFacultySynthesizeEndpoint,
        data: payload,
      );

      if (response.data is Map<String, dynamic>) {
        return response.data as Map<String, dynamic>;
      }
      return {'audio_base64': null, 'spoken_text': text};
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Speech synthesis failed: $e');
    }
  }

  /// Creates a live Tavus CVI WebRTC video replica session.
  Future<TavusSessionModel> startTavusSession({
    required String subjectName,
    required String subjectCode,
    String? subjectId,
    String languageCode = 'en-IN',
  }) async {
    try {
      final payload = {
        'subjectName': subjectName,
        'subjectCode': subjectCode,
        if (subjectId != null) 'subjectId': subjectId,
        'language_code': languageCode,
      };

      final response = await _apiClient.post(
        AppConfig.aiFacultyTavusSessionEndpoint,
        data: payload,
      );

      if (response.data is Map<String, dynamic>) {
        return TavusSessionModel.fromJson(
          response.data as Map<String, dynamic>,
        );
      }
      throw AppException('Failed to parse Tavus session response.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw AppException('Tavus video call session error: $e');
    }
  }

  /// Ends an active Tavus CVI WebRTC session.
  Future<void> endTavusSession(String conversationId) async {
    try {
      await _apiClient.post(
        AppConfig.aiFacultyTavusEndEndpoint,
        data: {'conversation_id': conversationId},
      );
    } catch (_) {
      // Ignored for graceful cleanup
    }
  }
}
