/// Document/learning material model matching backend /api/documents schema.
class DocumentModel {
  final String id;
  final String fileName;
  final String fileUrl;
  final String status; // 'approved' | 'pending' | 'rejected'
  final String ingestionStatus; // 'ok' | 'pending' | 'failed'
  final int chunkCount;
  final String topicTag;
  final String unit;
  final String? subjectId;
  final String subjectCode;
  final String subjectName;
  final String? uploaderId;
  final String uploaderName;
  final String uploaderRole;
  final DateTime? createdAt;

  const DocumentModel({
    required this.id,
    required this.fileName,
    required this.fileUrl,
    this.status = 'pending',
    this.ingestionStatus = 'pending',
    this.chunkCount = 0,
    this.topicTag = '',
    this.unit = '',
    this.subjectId,
    this.subjectCode = 'GENERAL',
    this.subjectName = 'Course Material',
    this.uploaderId,
    this.uploaderName = 'Faculty',
    this.uploaderRole = 'faculty',
    this.createdAt,
  });

  bool get isApproved => status.toLowerCase() == 'approved';
  bool get isPending => status.toLowerCase() == 'pending';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isIngested => ingestionStatus.toLowerCase() == 'ok';
  String get displayName => fileName.isNotEmpty ? fileName : subjectName;

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    // Subject can be populated object or raw ID
    String? subjId;
    String subjCode = 'GENERAL';
    String subjName = 'Course Material';

    final rawSubj = json['subjectId'];
    if (rawSubj is Map) {
      subjId = (rawSubj['_id'] ?? rawSubj['id'])?.toString();
      subjCode = (rawSubj['code'] ?? 'GENERAL').toString().toUpperCase();
      subjName = (rawSubj['name'] ?? 'Course Material').toString();
    } else if (rawSubj != null) {
      subjId = rawSubj.toString();
    }

    // Uploader can be populated object or raw string
    String? upId;
    String upName = 'Faculty';
    String upRole = 'faculty';

    final rawUploader = json['uploaderId'];
    if (rawUploader is Map) {
      upId = (rawUploader['_id'] ?? rawUploader['id'])?.toString();
      upName = (rawUploader['name'] ?? 'Faculty').toString();
      upRole = (rawUploader['role'] ?? 'faculty').toString();
    } else if (rawUploader != null) {
      upId = rawUploader.toString();
    }

    DateTime? created;
    if (json['createdAt'] != null) {
      created = DateTime.tryParse(json['createdAt'].toString());
    }

    return DocumentModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      fileName: (json['fileName'] ?? 'document.pdf').toString(),
      fileUrl: (json['fileUrl'] ?? '').toString(),
      status: (json['status'] ?? 'pending').toString().toLowerCase(),
      ingestionStatus:
          (json['ingestionStatus'] ?? 'pending').toString().toLowerCase(),
      chunkCount:
          (json['chunkCount'] is num)
              ? (json['chunkCount'] as num).toInt()
              : int.tryParse(json['chunkCount']?.toString() ?? '0') ?? 0,
      topicTag: (json['topicTag'] ?? '').toString(),
      unit: (json['unit'] ?? '').toString(),
      subjectId: subjId,
      subjectCode: subjCode,
      subjectName: subjName,
      uploaderId: upId,
      uploaderName: upName,
      uploaderRole: upRole,
      createdAt: created,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fileName': fileName,
      'fileUrl': fileUrl,
      'status': status,
      'ingestionStatus': ingestionStatus,
      'chunkCount': chunkCount,
      'topicTag': topicTag,
      'unit': unit,
      'subjectId': subjectId,
      'subjectCode': subjectCode,
      'subjectName': subjectName,
      'uploaderId': uploaderId,
      'uploaderName': uploaderName,
      'uploaderRole': uploaderRole,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  DocumentModel copyWith({
    String? id,
    String? fileName,
    String? fileUrl,
    String? status,
    String? ingestionStatus,
    int? chunkCount,
    String? topicTag,
    String? unit,
    String? subjectId,
    String? subjectCode,
    String? subjectName,
    String? uploaderId,
    String? uploaderName,
    String? uploaderRole,
    DateTime? createdAt,
  }) {
    return DocumentModel(
      id: id ?? this.id,
      fileName: fileName ?? this.fileName,
      fileUrl: fileUrl ?? this.fileUrl,
      status: status ?? this.status,
      ingestionStatus: ingestionStatus ?? this.ingestionStatus,
      chunkCount: chunkCount ?? this.chunkCount,
      topicTag: topicTag ?? this.topicTag,
      unit: unit ?? this.unit,
      subjectId: subjectId ?? this.subjectId,
      subjectCode: subjectCode ?? this.subjectCode,
      subjectName: subjectName ?? this.subjectName,
      uploaderId: uploaderId ?? this.uploaderId,
      uploaderName: uploaderName ?? this.uploaderName,
      uploaderRole: uploaderRole ?? this.uploaderRole,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
