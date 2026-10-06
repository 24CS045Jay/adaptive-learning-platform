/**
 * AppDataContext — reactive store synchronized with MongoDB Express API.
 * No localStorage persistence or mock data fallbacks used at runtime.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type {
  FileType,
  Difficulty,
  LearningModule,
  LearningResource,
  MultiModalChunk,
  ConceptNode,
  ConceptEdge,
} from "@/lib/mock-data";
import { _setGlobalOnRegister } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { API_BASE, fetchJson, authHeaders } from "@/lib/api";
import { AUDIT_LOG, type AuditEntry, appendAudit } from "@/lib/auth-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocStatus = "pending" | "approved" | "rejected";

export interface AppDocument {
  id: string;
  name: string;
  fileType: FileType;
  subjectId: string;
  moduleId: string | null;
  topicTag: string;
  difficulty: Difficulty;
  semester: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadDate: string;
  status: DocStatus;
  chunks: number;
  priority: number;
  ingestionStatus?: "pending" | "ok" | "failed";
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "Student" | "Faculty" | "Admin";
  departmentId?: string;
  studentId?: string;
  facultyId?: string;
  status: "active" | "inactive";
  joinedAt: string;
  /** Tracks whether user is still on the admin-created default password */
  passwordStatus: "default" | "changed";
}

export interface AppSubject {
  id: string;
  name: string;
  code: string;
  semester: number;
  faculty: string;
  syllabus: string;
  enrolledStudentIds: string[];
}

export interface AppQuery {
  id: string;
  student: string;
  subject: string;
  question: string;
  createdAt: string;
  confidence?: number;
  escalated?: boolean;
}

export interface AppEscalation {
  id: string;
  student: string;
  subject: string;
  question: string;
  status: "open" | "resolved";
  escalatedAt: string;
  facultyAnswer?: string;
  resolvedBy?: string;
}

export interface AppAnnouncement {
  id: string;
  title: string;
  message: string;
  scope: string;
  postedBy: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "approval" | "escalation" | "announcement" | "quiz" | "reminder" | "progress";
}

export interface DiscussionAnswer {
  id: string;
  author: string;
  authorRole: "Student" | "Faculty";
  content: string;
  createdAt: string;
  isFacultyVerified: boolean;
  upvotes: number;
}

export interface DiscussionPost {
  id: string;
  title: string;
  content: string;
  author: string;
  authorRole: "Student" | "Faculty";
  subjectName: string;
  tags: string[];
  upvotes: number;
  createdAt: string;
  answers: DiscussionAnswer[];
}

export interface AiFeedback {
  id: string;
  question: string;
  answer: string;
  isThumbsUp: boolean;
  comment?: string;
  timestamp: string;
}

export interface StudentRiskProfile {
  studentId: string;
  studentName: string;
  email: string;
  subject: string;
  trend: "Improving" | "Stable" | "Declining";
  risk: "Low" | "Medium" | "High";
  scorePct: number;
  weakTopicCount: number;
}

// ─── Context Value Interface ──────────────────────────────────────────────────

interface AppDataContextValue {
  documents: AppDocument[];
  subjects: AppSubject[];
  modules: LearningModule[];
  resources: LearningResource[];
  users: AppUser[];
  queries: AppQuery[];
  escalations: AppEscalation[];
  announcements: AppAnnouncement[];
  notifications: AppNotification[];
  discussions: DiscussionPost[];
  aiFeedback: AiFeedback[];
  riskProfiles: StudentRiskProfile[];
  multiModalChunks: MultiModalChunk[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  quizzes: any[];
  weakTopics: any[];
  bookmarks: any[];
  topicVolume: any[];
  chatSources: any[];

  // Quiz CRUD
  addQuiz: (quiz: { subjectId: string; title: string; isAiGenerated?: boolean; questions?: any[] }) => Promise<boolean>;
  deleteQuiz: (id: string) => Promise<boolean>;
  refreshQuizzes: () => Promise<boolean>;

  // Queries & Telemetry
  refreshQueries: () => Promise<boolean>;
  refreshAuditLog: () => Promise<boolean>;

  // Bookmarks
  addBookmark: (b: { question: string; answer: string; subject: string; notes?: string }) => void;
  updateBookmarkNote: (id: string, notes: string) => void;
  removeBookmark: (id: string) => void;

  // Document CRUD
  uploadDocument: (formData: FormData) => Promise<boolean>;
  approveDocument: (id: string) => Promise<boolean>;
  rejectDocument: (id: string) => Promise<boolean>;
  updateDocument: (
    id: string,
    updates: Partial<Pick<AppDocument, "chunks" | "ingestionStatus" | "status">>,
  ) => void;
  deleteDocument: (id: string) => Promise<boolean>;

  // Feedback & Notifications
  addAiFeedback: (question: string, answer: string, isThumbsUp: boolean, comment?: string) => void;
  markNotificationsAsRead: () => void;

  // Escalations CRUD & RAG Re-indexing
  addEscalation: (question: string, subject: string, studentName: string) => void;
  resolveEscalation: (id: string, facultyAnswer: string, resolvedByName: string) => void;

  // Discussions CRUD
  addDiscussionPost: (
    post: Omit<DiscussionPost, "id" | "upvotes" | "createdAt" | "answers">,
  ) => void;
  addDiscussionAnswer: (
    postId: string,
    content: string,
    author: string,
    authorRole: "Student" | "Faculty",
  ) => void;
  upvotePost: (postId: string) => void;

  // Multi-Modal Chunk Reranking
  updateChunkWeight: (chunkId: string, weight: number) => void;
  toggleChunkStatus: (chunkId: string) => void;
  addMultiModalChunk: (chunk: Omit<MultiModalChunk, "id">) => void;

  // User CRUD
  addUser: (user: Omit<AppUser, "id" | "joinedAt">) => void;
  removeUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;
  markPasswordChanged: (email: string) => void;
  refreshUsers: () => Promise<boolean>;

  // Audit Log
  auditLog: AuditEntry[];
  logAudit: (actor: string, action: string, target: string) => void;

  // Subject CRUD
  addSubject: (subject: Omit<AppSubject, "id" | "enrolledStudentIds">) => void;
  deleteSubject: (id: string) => void;
  updateSyllabus: (subjectId: string, syllabus: string) => void;
  updateSubjectFaculty: (subjectId: string, facultyName: string, facultyId?: string) => Promise<boolean>;

  // Module / Resource CRUD
  addModule: (mod: Omit<LearningModule, "id">) => void;
  removeModule: (id: string) => void;
  addResource: (res: Omit<LearningResource, "id">) => void;
  removeResource: (id: string) => void;
  enrollStudent: (subjectId: string, userId: string) => void;
  unenrollStudent: (subjectId: string, userId: string) => void;

  // Queries & Announcements
  addQuery: (q: Omit<AppQuery, "id">) => void;
  addAnnouncement: (a: Omit<AppAnnouncement, "id" | "createdAt">) => void;
  deleteAnnouncement: (id: string) => void;
}

// ─── Backend Mappers ──────────────────────────────────────────────────────────

function getFileTypeFromFileName(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pptx") return "pptx";
  if (ext === "docx") return "docx";
  return "pdf";
}

function mapBackendSubject(subject: any): AppSubject {
  return {
    id: String(subject._id || subject.id),
    name: subject.name,
    code: subject.code,
    semester: subject.semester,
    faculty: subject.facultyId?.name ?? subject.faculty ?? "",
    syllabus: subject.syllabus ?? "",
    enrolledStudentIds: (subject.enrolledStudentIds || []).map((id: any) => String(id)),
  };
}

function mapBackendUser(u: any): AppUser {
  const roleMap: Record<string, "Student" | "Faculty" | "Admin"> = {
    student: "Student",
    faculty: "Faculty",
    admin: "Admin",
  };
  const roleLabel = roleMap[String(u.role).toLowerCase()] ?? "Student";
  const rawDept = u.departmentId || u.department_id;
  const deptId =
    typeof rawDept === "object" && rawDept
      ? String(rawDept._id || rawDept.id || rawDept.code || "")
      : rawDept
        ? String(rawDept)
        : undefined;

  return {
    id: String(u._id || u.id),
    departmentId: deptId ? String(deptId).toUpperCase() : undefined,
    name: u.name,
    email: u.email,
    studentId: u.studentId || u.student_id,
    facultyId: u.facultyId || u.faculty_id,
    role: roleLabel,
    status: "active",
    passwordStatus: u.mustChangePassword ? "default" : "changed",
    joinedAt: u.createdAt
      ? new Date(u.createdAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  };
}

function mapBackendDocument(doc: any): AppDocument {
  const subjectId =
    typeof doc.subjectId === "object"
      ? String(doc.subjectId._id || doc.subjectId.id)
      : String(doc.subjectId);
  const uploader = typeof doc.uploaderId === "object" ? doc.uploaderId : undefined;
  return {
    id: String(doc._id || doc.id),
    name: doc.fileName,
    fileType: doc.fileType ? doc.fileType : getFileTypeFromFileName(doc.fileName),
    subjectId,
    moduleId: doc.unit || doc.moduleId || null,
    topicTag: doc.topicTag ?? "",
    difficulty: doc.difficulty ?? "medium",
    semester: doc.semester ?? doc.subjectId?.semester ?? 1,
    uploadedBy: uploader?.email ?? doc.uploadedBy ?? "faculty@charusat.edu.in",
    uploadedByName: uploader?.name ?? doc.uploadedByName ?? uploader?.email ?? "Faculty",
    uploadDate: doc.createdAt
      ? new Date(doc.createdAt).toISOString().split("T")[0]
      : (doc.uploadDate ?? new Date().toISOString().split("T")[0]),
    status: doc.status ?? "pending",
    chunks: doc.chunkCount ?? doc.chunks ?? 0,
    priority: doc.priority ?? 0,
    ingestionStatus: doc.ingestionStatus ?? "pending",
  };
}

// ─── Provider Component ───────────────────────────────────────────────────────

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [subjects, setSubjects] = useState<AppSubject[]>([]);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [queries, setQueries] = useState<AppQuery[]>([]);
  const [escalations, setEscalations] = useState<AppEscalation[]>([]);
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback[]>([]);
  const [riskProfiles, setRiskProfiles] = useState<StudentRiskProfile[]>([]);
  const [multiModalChunks, setMultiModalChunks] = useState<MultiModalChunk[]>([]);
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [conceptEdges, setConceptEdges] = useState<ConceptEdge[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [liveAuditLogs, setLiveAuditLogs] = useState<AuditEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("ai_tutor_user_bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ── Refresh Functions ─────────────────────────────────────────────────────

  const refreshDocuments = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const docsData = await fetchJson<any[]>(`/api/documents`, {
        headers: authHeaders(user.token),
      });
      setDocuments(docsData.map(mapBackendDocument));
      return true;
    } catch (error) {
      console.warn("[AppData] refreshDocuments failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshSubjects = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const subjectsData = await fetchJson<any[]>(`/api/subjects`, {
        headers: authHeaders(user.token),
      });
      setSubjects(subjectsData.map(mapBackendSubject));
      return true;
    } catch (error) {
      console.warn("[AppData] refreshSubjects failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshUsers = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const usersData = await fetchJson<any[]>(`/api/users`, { headers: authHeaders(user.token) });
      setUsers(usersData.map(mapBackendUser));
      return true;
    } catch (error) {
      console.warn("[AppData] refreshUsers failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshModules = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/modules`, { headers: authHeaders(user.token) });
      setModules(data.map((m) => ({ ...m, id: String(m._id || m.id) })));
      return true;
    } catch (error) {
      console.warn("[AppData] refreshModules failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshResources = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/resources`, { headers: authHeaders(user.token) });
      setResources(data.map((r) => ({ ...r, id: String(r._id || r.id) })));
      return true;
    } catch (error) {
      console.warn("[AppData] refreshResources failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshEscalations = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/escalations`, { headers: authHeaders(user.token) });
      setEscalations(data);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshEscalations failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshAnnouncements = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/announcements`, {
        headers: authHeaders(user.token),
      });
      setAnnouncements(data);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshAnnouncements failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/notifications`, {
        headers: authHeaders(user.token),
      });
      setNotifications(data);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshNotifications failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshDiscussions = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/discussions`, { headers: authHeaders(user.token) });
      setDiscussions(data);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshDiscussions failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshFeedback = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any>(`/api/feedback`, { headers: authHeaders(user.token) });
      if (Array.isArray(data.feedback)) {
        setAiFeedback(data.feedback);
      }
      return true;
    } catch (error) {
      console.warn("[AppData] refreshFeedback failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshRiskProfiles = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<StudentRiskProfile[]>(`/api/analytics/risk-profiles`, {
        headers: authHeaders(user.token),
      });
      setRiskProfiles(data);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshRiskProfiles failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshConceptGraph = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<{ nodes: ConceptNode[]; edges: ConceptEdge[] }>(
        `/api/concept-graph`,
        { headers: authHeaders(user.token) },
      );
      setConceptNodes(data.nodes || []);
      setConceptEdges(data.edges || []);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshConceptGraph failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshQuizzes = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/quizzes`, { headers: authHeaders(user.token) });
      const mapped = (data || []).map((q: any) => ({
        id: String(q._id || q.id),
        title: q.title,
        subjectId: typeof q.subjectId === "object" ? String(q.subjectId?._id || q.subjectId?.id) : String(q.subjectId || ""),
        subjectName: typeof q.subjectId === "object" ? (q.subjectId?.name || "Subject") : (subjects.find((s) => s.id === q.subjectId)?.name || "Subject"),
        subjectCode: typeof q.subjectId === "object" ? (q.subjectId?.code || "") : "",
        createdBy: typeof q.createdBy === "object" ? (q.createdBy?.name || "Faculty") : (q.createdBy || "Faculty"),
        isAiGenerated: !!q.isAiGenerated,
        totalQuestions: q.questions?.length || 0,
        questions: (q.questions || []).map((qst: any) => ({
          id: String(qst._id || qst.id),
          text: qst.text,
          type: qst.type || "mcq",
          options: qst.options || [],
          correctAnswer: qst.correctOption ?? qst.correctAnswer ?? 0,
          explanation: qst.explanation || "",
          topicTag: qst.topicTag || "",
          difficulty: qst.difficulty || "medium",
        })),
        createdAt: q.createdAt,
      }));
      setQuizzes(mapped);
      return true;
    } catch (error) {
      console.warn("[AppData] refreshQuizzes failed:", error);
      return false;
    }
  }, [user?.token, subjects]);

  const refreshQueries = useCallback(async () => {
    if (!user?.token) return false;
    try {
      const data = await fetchJson<any[]>(`/api/tutor/queries`, { headers: authHeaders(user.token) });
      if (Array.isArray(data)) {
        setQueries(data);
      }
      return true;
    } catch (error) {
      console.warn("[AppData] refreshQueries failed:", error);
      return false;
    }
  }, [user?.token]);

  const refreshAuditLogs = useCallback(async () => {
    if (!user?.token || user?.role?.toLowerCase() !== "admin") return false;
    try {
      const data = await fetchJson<any[]>(`/api/analytics/audit-logs`, {
        headers: authHeaders(user.token, {
          role: user.role,
          id: user.id,
          departmentId: user.departmentId,
        }),
      });
      if (Array.isArray(data)) {
        setLiveAuditLogs(data);
      }
      return true;
    } catch (error) {
      console.warn("[AppData] refreshAuditLogs failed:", error);
      return false;
    }
  }, [user]);

  // ── Document Operations ───────────────────────────────────────────────────

  const uploadDocument = useCallback(
    async (formData: FormData) => {
      try {
        const headers: Record<string, string> = {};
        if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
        if (user?.role) headers["x-user-role"] = user.role.toLowerCase();
        if (user?.id) headers["x-user-id"] = user.id;
        if (user?.departmentId) headers["x-department-id"] = user.departmentId;

        const res = await fetch(`${API_BASE}/api/documents/upload`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn("[AppData] uploadDocument failed:", errText);
          return false;
        }

        await refreshDocuments();
        return true;
      } catch (error) {
        console.warn("[AppData] uploadDocument failed:", error);
        return false;
      }
    },
    [refreshDocuments, user],
  );

  const approveDocument = useCallback(
    async (id: string) => {
      // Optimistically update document status in local state
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "approved" as DocStatus } : d)),
      );

      try {
        const token = user?.token || "mock_admin_token";
        const res = await fetch(`${API_BASE}/api/documents/${id}/approve`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token, {
              role: user?.role || "admin",
              id: user?.id,
              departmentId: user?.departmentId,
            }),
          },
        });
        if (!res.ok) {
          console.warn("[AppData] approveDocument endpoint returned non-200:", res.status);
        }
        await refreshDocuments();
        return true;
      } catch (error) {
        console.warn("[AppData] approveDocument failed:", error);
        return false;
      }
    },
    [refreshDocuments, user],
  );

  const rejectDocument = useCallback(
    async (id: string) => {
      // Optimistically update document status in local state
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "rejected" as DocStatus } : d)),
      );

      try {
        const token = user?.token || "mock_admin_token";
        const res = await fetch(`${API_BASE}/api/documents/${id}/reject`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token, {
              role: user?.role || "admin",
              id: user?.id,
              departmentId: user?.departmentId,
            }),
          },
        });
        if (!res.ok) {
          console.warn("[AppData] rejectDocument endpoint returned non-200:", res.status);
        }
        await refreshDocuments();
        return true;
      } catch (error) {
        console.warn("[AppData] rejectDocument failed:", error);
        return false;
      }
    },
    [refreshDocuments, user],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      try {
        const token = user?.token || "mock_admin_token";
        const res = await fetch(`${API_BASE}/api/documents/${id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token, {
              role: user?.role || "admin",
              id: user?.id,
              departmentId: user?.departmentId,
            }),
          },
        });
        if (!res.ok) return false;
        await refreshDocuments();
        return true;
      } catch (error) {
        console.warn("[AppData] deleteDocument failed:", error);
        return false;
      }
    },
    [refreshDocuments, user],
  );

  const updateDocument = useCallback(
    (id: string, updates: Partial<Pick<AppDocument, "chunks" | "ingestionStatus" | "status">>) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    },
    [],
  );

  // ── Feedback & Notifications Operations ───────────────────────────────────

  const addAiFeedback = useCallback(
    async (question: string, answer: string, isThumbsUp: boolean, comment?: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ question, answer, isThumbsUp, comment }),
        });
        await refreshFeedback();
      } catch (err) {
        console.warn("[AppData] addAiFeedback failed:", err);
      }
    },
    [refreshFeedback, user?.token],
  );

  const markNotificationsAsRead = useCallback(async () => {
    if (!user?.token) return;
    try {
      await fetch(`${API_BASE}/api/notifications/read-all/read`, {
        method: "PATCH",
        headers: authHeaders(user.token),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn("[AppData] markNotificationsAsRead failed:", err);
    }
  }, [user?.token]);

  // ── Escalations Operations ────────────────────────────────────────────────

  const addEscalation = useCallback(
    async (question: string, subject: string, studentName: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/escalations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ question, subject }),
        });
        await refreshEscalations();
      } catch (err) {
        console.warn("[AppData] addEscalation failed:", err);
      }
    },
    [refreshEscalations, user?.token],
  );

  const resolveEscalation = useCallback(
    async (id: string, facultyAnswer: string, resolvedByName: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/escalations/${id}/resolve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ facultyAnswer }),
        });
        await refreshEscalations();
      } catch (err) {
        console.warn("[AppData] resolveEscalation failed:", err);
      }
    },
    [refreshEscalations, user?.token],
  );

  // ── Discussions Operations ────────────────────────────────────────────────

  const addDiscussionPost = useCallback(
    async (post: Omit<DiscussionPost, "id" | "upvotes" | "createdAt" | "answers">) => {
      const tempId = `disc_${Date.now()}`;
      const optimisticPost: DiscussionPost = {
        ...post,
        id: tempId,
        upvotes: 1,
        createdAt: new Date().toISOString().split("T")[0],
        answers: [],
      };
      setDiscussions((prev) => [optimisticPost, ...prev]);

      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/discussions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify(post),
        });
        await refreshDiscussions();
      } catch (err) {
        console.warn("[AppData] addDiscussionPost failed:", err);
      }
    },
    [refreshDiscussions, user?.token],
  );

  const addDiscussionAnswer = useCallback(
    async (postId: string, content: string, author: string, authorRole: "Student" | "Faculty") => {
      const optimisticAnswer: DiscussionAnswer = {
        id: `ans_${Date.now()}`,
        author,
        authorRole,
        content,
        isFacultyVerified: authorRole === "Faculty",
        upvotes: 1,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setDiscussions((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, answers: [...(p.answers || []), optimisticAnswer] } : p,
        ),
      );

      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/discussions/${postId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ content }),
        });
        await refreshDiscussions();
      } catch (err) {
        console.warn("[AppData] addDiscussionAnswer failed:", err);
      }
    },
    [refreshDiscussions, user?.token],
  );

  const upvotePost = useCallback(
    async (postId: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/discussions/${postId}/upvote`, {
          method: "PATCH",
          headers: authHeaders(user.token),
        });
        setDiscussions((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p)),
        );
      } catch (err) {
        console.warn("[AppData] upvotePost failed:", err);
      }
    },
    [user?.token],
  );

  // ── Chunk Operations ──────────────────────────────────────────────────────

  const updateChunkWeight = useCallback((chunkId: string, weight: number) => {
    setMultiModalChunks((prev) => prev.map((c) => (c.id === chunkId ? { ...c, weight } : c)));
  }, []);

  const toggleChunkStatus = useCallback((chunkId: string) => {
    setMultiModalChunks((prev) =>
      prev.map((c) =>
        c.id === chunkId ? { ...c, status: c.status === "active" ? "deprecated" : "active" } : c,
      ),
    );
  }, []);

  const addMultiModalChunk = useCallback((chunk: Omit<MultiModalChunk, "id">) => {
    setMultiModalChunks((prev) => [{ ...chunk, id: `mmc_${Date.now()}` }, ...prev]);
  }, []);

  // ── User Operations ───────────────────────────────────────────────────────

  const addUser = useCallback(
    async (newUser: Omit<AppUser, "id" | "joinedAt">) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({
            name: newUser.name,
            email: newUser.email,
            password: "password123",
            role: newUser.role.toLowerCase(),
          }),
        });
        await refreshUsers();
      } catch (err) {
        console.warn("[AppData] addUser failed:", err);
      }
    },
    [refreshUsers, user?.token],
  );

  const removeUser = useCallback(
    async (id: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(user.token),
        });
        await refreshUsers();
      } catch (err) {
        console.warn("[AppData] removeUser failed:", err);
      }
    },
    [refreshUsers, user?.token],
  );

  const toggleUserStatus = useCallback((id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u,
      ),
    );
  }, []);

  const markPasswordChanged = useCallback((email: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === email.toLowerCase()
          ? { ...u, passwordStatus: "changed" as const }
          : u,
      ),
    );
  }, []);

  const logAudit = useCallback((actor: string, action: string, target: string) => {
    appendAudit(actor, action, target);
  }, []);

  // ── Subject Operations ────────────────────────────────────────────────────

  const addSubject = useCallback(
    async (subj: Omit<AppSubject, "id" | "enrolledStudentIds">) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify(subj),
        });
        await refreshSubjects();
      } catch (err) {
        console.warn("[AppData] addSubject failed:", err);
      }
    },
    [refreshSubjects, user?.token],
  );

  const deleteSubject = useCallback(
    async (id: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/subjects/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(user.token),
        });
        await refreshSubjects();
      } catch (err) {
        console.warn("[AppData] deleteSubject failed:", err);
      }
    },
    [refreshSubjects, user?.token],
  );

  const updateSyllabus = useCallback(
    async (subjectId: string, syllabus: string) => {
      // Optimistically update subject list
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId || s.code === subjectId ? { ...s, syllabus } : s)),
      );

      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/subjects/${encodeURIComponent(subjectId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ syllabus }),
        });
        await refreshSubjects();
      } catch (err) {
        console.warn("[AppData] updateSyllabus failed:", err);
      }
    },
    [refreshSubjects, user?.token],
  );

  const updateSubjectFaculty = useCallback(
    async (subjectId: string, facultyName: string, facultyId?: string) => {
      // Optimistically update subject list
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? { ...s, faculty: facultyName } : s)),
      );

      if (!user?.token) return true;
      try {
        await fetch(`${API_BASE}/api/subjects/${encodeURIComponent(subjectId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ faculty: facultyName, facultyId }),
        });
        await refreshSubjects();
        return true;
      } catch (err) {
        console.warn("[AppData] updateSubjectFaculty failed:", err);
        return false;
      }
    },
    [refreshSubjects, user?.token],
  );

  const enrollStudent = useCallback(
    async (subjectId: string, userId: string) => {
      const studentIdentifier = userId || user?.id || user?.email || "";
      const studentEmail = user?.email ? String(user.email).toLowerCase() : "";
      const studentRoll = user?.studentId ? String(user.studentId) : "";

      // Optimistically add student to subject
      setSubjects((prev) =>
        prev.map((s) => {
          if (s.id === subjectId || s.code === subjectId) {
            const currentList = s.enrolledStudentIds || [];
            const nextList = [...currentList];
            if (studentIdentifier && !nextList.includes(studentIdentifier)) nextList.push(studentIdentifier);
            if (studentEmail && !nextList.includes(studentEmail)) nextList.push(studentEmail);
            if (studentRoll && !nextList.includes(studentRoll)) nextList.push(studentRoll);
            return { ...s, enrolledStudentIds: nextList };
          }
          return s;
        }),
      );

      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/subjects/${encodeURIComponent(subjectId)}/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ userId }),
        });
        await refreshSubjects();
      } catch (err) {
        console.warn("[AppData] enrollStudent failed:", err);
      }
    },
    [refreshSubjects, user],
  );

  const unenrollStudent = useCallback(
    async (subjectId: string, userId: string) => {
      const studentIdentifier = userId || user?.id || user?.email || "";
      const studentEmail = user?.email ? String(user.email).toLowerCase() : "";
      const studentRoll = user?.studentId ? String(user.studentId) : "";

      // Optimistically remove student from subject
      setSubjects((prev) =>
        prev.map((s) => {
          if (s.id === subjectId || s.code === subjectId) {
            const currentList = s.enrolledStudentIds || [];
            const nextList = currentList.filter(
              (id) => id !== studentIdentifier && id !== studentEmail && id !== studentRoll
            );
            return { ...s, enrolledStudentIds: nextList };
          }
          return s;
        }),
      );

      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/subjects/${encodeURIComponent(subjectId)}/unenroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify({ userId }),
        });
        await refreshSubjects();
      } catch (err) {
        console.warn("[AppData] unenrollStudent failed:", err);
      }
    },
    [refreshSubjects, user],
  );

  // ── Module & Resource Operations ──────────────────────────────────────────

  const addModule = useCallback(
    async (mod: Omit<LearningModule, "id">) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/modules`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify(mod),
        });
        await refreshModules();
      } catch (err) {
        console.warn("[AppData] addModule failed:", err);
      }
    },
    [refreshModules, user?.token],
  );

  const removeModule = useCallback(
    async (id: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/modules/${id}`, {
          method: "DELETE",
          headers: authHeaders(user.token),
        });
        await refreshModules();
      } catch (err) {
        console.warn("[AppData] removeModule failed:", err);
      }
    },
    [refreshModules, user?.token],
  );

  const addResource = useCallback(
    async (res: Omit<LearningResource, "id">) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/resources`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify(res),
        });
        await refreshResources();
      } catch (err) {
        console.warn("[AppData] addResource failed:", err);
      }
    },
    [refreshResources, user?.token],
  );

  const removeResource = useCallback(
    async (id: string) => {
      if (!user?.token) return;
      try {
        await fetch(`${API_BASE}/api/resources/${id}`, {
          method: "DELETE",
          headers: authHeaders(user.token),
        });
        await refreshResources();
      } catch (err) {
        console.warn("[AppData] removeResource failed:", err);
      }
    },
    [refreshResources, user?.token],
  );

  const addQuiz = useCallback(
    async (quizData: { subjectId: string; title: string; isAiGenerated?: boolean; questions?: any[] }) => {
      if (!user?.token) return false;
      try {
        const res = await fetch(`${API_BASE}/api/quizzes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(user.token) },
          body: JSON.stringify(quizData),
        });
        if (!res.ok) return false;
        await refreshQuizzes();
        return true;
      } catch (err) {
        console.warn("[AppData] addQuiz failed:", err);
        return false;
      }
    },
    [refreshQuizzes, user?.token],
  );

  const deleteQuiz = useCallback(
    async (id: string) => {
      if (!user?.token) return false;
      try {
        const res = await fetch(`${API_BASE}/api/quizzes/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(user.token),
        });
        if (!res.ok) return false;
        setQuizzes((prev) => prev.filter((q) => q.id !== id));
        return true;
      } catch (err) {
        console.warn("[AppData] deleteQuiz failed:", err);
        return false;
      }
    },
    [user?.token],
  );

  const addBookmark = useCallback(
    (b: { question: string; answer: string; subject: string; notes?: string }) => {
      const newBm = {
        id: `bm_${Date.now()}`,
        ...b,
        date: new Date().toISOString().split("T")[0],
      };
      setBookmarks((prev) => {
        const updated = [newBm, ...prev];
        try {
          localStorage.setItem("ai_tutor_user_bookmarks", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [],
  );

  const updateBookmarkNote = useCallback(
    (id: string, notes: string) => {
      setBookmarks((prev) => {
        const updated = prev.map((b) => (b.id === id ? { ...b, notes } : b));
        try {
          localStorage.setItem("ai_tutor_user_bookmarks", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const updated = prev.filter((b) => b.id !== id);
        try {
          localStorage.setItem("ai_tutor_user_bookmarks", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [],
  );

  const addQuery = useCallback((q: Omit<AppQuery, "id">) => {
    setQueries((prev) => [{ ...q, id: `q_${Date.now()}` }, ...prev]);
  }, []);

  const addAnnouncement = useCallback(
    async (a: Omit<AppAnnouncement, "id" | "createdAt">) => {
      const tempId = `ann_${Date.now()}`;
      const tempAnn: AppAnnouncement = {
        ...a,
        id: tempId,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setAnnouncements((prev) => [tempAnn, ...prev]);

      if (!user?.token) return true;
      try {
        const token = user.token || "mock_token";
        const res = await fetch(`${API_BASE}/api/announcements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token, {
              role: user.role,
              id: user.id,
              departmentId: user.departmentId,
            }),
          },
          body: JSON.stringify(a),
        });
        if (res.ok) {
          await refreshAnnouncements();
        }
        return true;
      } catch (err) {
        console.warn("[AppData] addAnnouncement failed:", err);
        return false;
      }
    },
    [refreshAnnouncements, user],
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));

      if (!user?.token) return true;
      try {
        const token = user.token || "mock_token";
        await fetch(`${API_BASE}/api/announcements/${id}`, {
          method: "DELETE",
          headers: authHeaders(token, {
            role: user.role,
            id: user.id,
            departmentId: user.departmentId,
          }),
        });
        await refreshAnnouncements();
        return true;
      } catch (err) {
        console.warn("[AppData] deleteAnnouncement failed:", err);
        return false;
      }
    },
    [refreshAnnouncements, user],
  );

  // ── Global Mount & Token Effect ───────────────────────────────────────────

  useEffect(() => {
    if (!user?.token) return;

    let active = true;
    const loadAllBackendData = async () => {
      await Promise.all([
        refreshSubjects(),
        refreshDocuments(),
        refreshUsers(),
        refreshModules(),
        refreshResources(),
        refreshEscalations(),
        refreshAnnouncements(),
        refreshNotifications(),
        refreshDiscussions(),
        refreshFeedback(),
        refreshRiskProfiles(),
        refreshConceptGraph(),
        refreshQuizzes(),
        refreshQueries(),
        refreshAuditLogs(),
      ]);
      if (!active) return;
    };
    loadAllBackendData();
    return () => {
      active = false;
    };
  }, [
    refreshAnnouncements,
    refreshAuditLogs,
    refreshConceptGraph,
    refreshDiscussions,
    refreshDocuments,
    refreshEscalations,
    refreshFeedback,
    refreshModules,
    refreshNotifications,
    refreshQueries,
    refreshQuizzes,
    refreshResources,
    refreshRiskProfiles,
    refreshSubjects,
    refreshUsers,
    user?.token,
  ]);

  useEffect(() => {
    _setGlobalOnRegister((name, email, role) => {
      refreshUsers();
    });
  }, [refreshUsers]);

  return (
    <AppDataContext.Provider
      value={{
        documents,
        subjects,
        modules,
        resources,
        users,
        queries,
        escalations,
        announcements,
        notifications,
        discussions,
        aiFeedback,
        riskProfiles,
        multiModalChunks,
        conceptNodes,
        conceptEdges,
        quizzes,
        weakTopics: [],
        bookmarks,
        topicVolume: [],
        chatSources: [],
        addQuiz,
        deleteQuiz,
        refreshQuizzes,
        refreshQueries,
        refreshAuditLog: refreshAuditLogs,
        addBookmark,
        updateBookmarkNote,
        removeBookmark,
        uploadDocument,
        approveDocument,
        rejectDocument,
        updateDocument,
        deleteDocument,
        addAiFeedback,
        markNotificationsAsRead,
        addEscalation,
        resolveEscalation,
        addDiscussionPost,
        addDiscussionAnswer,
        upvotePost,
        updateChunkWeight,
        toggleChunkStatus,
        addMultiModalChunk,
        addUser,
        removeUser,
        toggleUserStatus,
        refreshUsers,
        addSubject,
        deleteSubject,
        updateSyllabus,
        updateSubjectFaculty,
        addModule,
        removeModule,
        addResource,
        removeResource,
        enrollStudent,
        unenrollStudent,
        addQuery,
        addAnnouncement,
        deleteAnnouncement,
        markPasswordChanged,
        auditLog: liveAuditLogs.length > 0 ? liveAuditLogs : AUDIT_LOG,
        logAudit,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside <AppDataProvider>");
  return ctx;
}
