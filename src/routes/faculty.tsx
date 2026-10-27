import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  FileText,
  MessagesSquare,
  BarChart3,
  ListChecks,
  AlertTriangle,
  Megaphone,
  BookOpen,
  Network,
  Video,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  // Teaching & Courses
  { to: "/faculty", label: "Overview", icon: LayoutDashboard, section: "Teaching & Courses" },
  { to: "/faculty/subjects", label: "Assigned Subjects", icon: BookOpen, section: "Teaching & Courses" },
  { to: "/faculty/meetings", label: "Office Hours Slots", icon: Video, section: "Teaching & Courses" },

  // Course Materials
  { to: "/faculty/upload", label: "Upload Syllabus Material", icon: Upload, section: "Course Materials" },
  { to: "/faculty/documents", label: "Document Repository", icon: FileText, section: "Course Materials" },
  { to: "/faculty/knowledge-graph", label: "Curriculum Graph", icon: Network, section: "Course Materials" },

  // Student Assessment & Support
  { to: "/faculty/quizzes", label: "Quiz Manager", icon: ListChecks, section: "Student Assessment" },
  { to: "/faculty/analytics", label: "Mastery Analytics", icon: BarChart3, section: "Student Assessment" },
  { to: "/faculty/escalations", label: "Student Escalations", icon: AlertTriangle, section: "Student Assessment" },
  { to: "/faculty/queries", label: "Student Questions", icon: MessagesSquare, section: "Student Assessment" },
  { to: "/faculty/discussion", label: "Class Discussions", icon: MessagesSquare, section: "Student Assessment" },
  { to: "/faculty/announcements", label: "Announcements", icon: Megaphone, section: "Student Assessment" },
];

export const Route = createFileRoute("/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty Portal · EduSense AI" },
      { name: "description", content: "Faculty course management, syllabus ingestion, and student mastery analytics." },
    ],
  }),
  component: () => <AppShell role="faculty" nav={nav} />,
});
