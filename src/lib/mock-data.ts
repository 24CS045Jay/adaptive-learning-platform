export type Role = "student" | "faculty" | "admin";

export const currentUsers: Record<Role, { name: string; email: string; role: string }> = {
  student: { name: "", email: "", role: "Student" },
  faculty: { name: "", email: "", role: "Faculty" },
  admin: { name: "", email: "", role: "Admin" },
};

// ─── Subjects ────────────────────────────────────────────────────────────────

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
  semester: number;
  faculty: string;
  syllabus: string;
  enrolledStudentIds: string[];
}

export const subjects: SubjectItem[] = [];

// ─── Learning Modules ─────────────────────────────────────────────────────────

export type LearningModule = {
  id: string;
  subjectId: string;
  order: number;
  name: string;
  description?: string;
};

export const learningModules: LearningModule[] = [];

// ─── Learning Resources ───────────────────────────────────────────────────────

export type ResourceType = "link" | "pdf" | "pptx" | "docx" | "video";
export type LearningResource = {
  id: string;
  moduleId: string;
  name: string;
  type: ResourceType;
  url?: string;
  description?: string;
};

export const learningResources: LearningResource[] = [];

// ─── Documents (enriched metadata) ───────────────────────────────────────────

export type FileType = "pdf" | "pptx" | "docx";
export type Difficulty = "easy" | "medium" | "hard";

export interface DocumentItem {
  id: string;
  name: string;
  fileType: FileType;
  subjectId: string;
  moduleId: string | null;
  topicTag: string;
  difficulty: Difficulty;
  semester: number;
  uploadedBy: string;
  uploadDate: string;
  status: "pending" | "approved" | "rejected";
  chunks: number;
  priority: number;
}

export const documents: DocumentItem[] = [];

// ─── Multi-Modal Document Chunks ──────────────────────────────────────────────

export type ArtifactType = "diagram" | "table" | "equation" | "slide_preview";

export interface MultiModalChunk {
  id: string;
  docId: string;
  docName: string;
  fileType: FileType;
  subjectName: string;
  unit: string;
  pageOrSlide: number;
  text: string;
  weight: number;
  status: "active" | "deprecated";
  artifact?: {
    type: ArtifactType;
    title: string;
    caption: string;
    badge: string;
  };
}

export const initialMultiModalChunks: MultiModalChunk[] = [];

// ─── Interactive Knowledge Graph Nodes & Edges ───────────────────────────────

export interface ConceptNode {
  id: string;
  label: string;
  subjectId: string;
  subjectName: string;
  domain: string;
  x: number;
  y: number;
  mastery: "mastered" | "weak" | "unread";
  summary: string;
  relatedDocNames: string[];
}

export interface ConceptEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export const conceptNodes: ConceptNode[] = [];
export const conceptEdges: ConceptEdge[] = [];

// ─── Student Learning Profile ─────────────────────────────────────────────────

export type LearningStyle = "visual" | "textual" | "example-driven";

export type StudentLearningProfile = {
  studentId: string;
  learningStyle: LearningStyle;
  learningGoals: string;
  currentSemester: number;
  totalStudyTimeMinutes: number;
  currentStreakDays: number;
  topicsCompleted: string[];
  topicsViewed: string[];
  weakConcepts: string[];
  strongConcepts: string[];
  quizScoreHistory: Array<{ quizId: string; subject: string; score: number; total: number; date: string }>;
};

export const studentLearningProfiles: Record<string, StudentLearningProfile> = {};

// ─── Data Arrays (Empty by default, populated dynamically via Web Portal) ────

export const studentQueries: any[] = [];
export const escalations: any[] = [];
export const announcements: any[] = [];
export const users: any[] = [];
export const auditLogs: any[] = [];
export const quizzes: any[] = [];
export const weakTopics: any[] = [];
export const bookmarks: any[] = [];
export const topicVolume: any[] = [];
export const subjectActivity: any[] = [];
export const chatSources: any[] = [];