import 'package:flutter/foundation.dart';
import '../models/document_model.dart';
import '../models/quiz_model.dart';
import '../models/subject_model.dart';
import '../services/document_service.dart';
import '../services/quiz_service.dart';

/// State management for subject-specific learning materials and assessments.
class SubjectLearningProvider extends ChangeNotifier {
  final DocumentService _documentService;
  final QuizService _quizService;

  SubjectModel? _subject;
  List<DocumentModel> _materials = [];
  List<QuizModel> _quizzes = [];
  bool _isLoading = false;
  String? _errorMessage;

  SubjectLearningProvider({
    DocumentService? documentService,
    QuizService? quizService,
  }) : _documentService = documentService ?? DocumentService(),
       _quizService = quizService ?? QuizService();

  SubjectModel? get subject => _subject;
  List<DocumentModel> get materials => List.unmodifiable(_materials);
  List<QuizModel> get quizzes => List.unmodifiable(_quizzes);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Loads study materials and quizzes for the specified subject.
  Future<void> loadSubjectContent(SubjectModel subject) async {
    _subject = subject;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _documentService.getDocuments(
          subjectId: subject.id,
          status: 'approved',
        ),
        _quizService.getQuizzes(subjectId: subject.id),
      ]);

      _materials = results[0] as List<DocumentModel>;
      _quizzes = results[1] as List<QuizModel>;
    } catch (e) {
      _errorMessage = 'Failed to load subject content: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refreshes content for the active subject.
  Future<void> refresh() async {
    if (_subject != null) {
      await loadSubjectContent(_subject!);
    }
  }
}
