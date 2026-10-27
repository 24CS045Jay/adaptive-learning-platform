/// Data model for citation sources returned by EduSense AI RAG engine.
class ChatSourceModel {
  final String? documentId;
  final String? fileName;
  final String? title;
  final int page;
  final String? snippet;

  const ChatSourceModel({
    this.documentId,
    this.fileName,
    this.title,
    this.page = 1,
    this.snippet,
  });

  factory ChatSourceModel.fromJson(Map<String, dynamic> json) {
    return ChatSourceModel(
      documentId: json['document_id'] ?? json['documentId'] ?? json['doc_id'],
      fileName: json['file_name'] ?? json['fileName'] ?? json['name'],
      title: json['title'] ?? json['heading'],
      page:
          json['page'] is int
              ? json['page'] as int
              : int.tryParse(json['page']?.toString() ?? '1') ?? 1,
      snippet: json['snippet'] ?? json['text'] ?? json['content'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'document_id': documentId,
      'file_name': fileName,
      'title': title,
      'page': page,
      'snippet': snippet,
    };
  }

  String get displayName {
    if (fileName != null && fileName!.isNotEmpty) return fileName!;
    if (title != null && title!.isNotEmpty) return title!;
    return 'Course Material';
  }
}
