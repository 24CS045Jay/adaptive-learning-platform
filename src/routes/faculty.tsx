import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard, Upload, FileText, MessagesSquare, BarChart3,
  ListChecks, AlertTriangle, Megaphone, UserCircle, BookOpen, Network,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { to: "/faculty", label: "Dashboard", icon: LayoutDashboard },
  { to: "/faculty/subjects", label: "My Subjects", icon: BookOpen },
  { to: "/faculty/discussion", label: "Discussions", icon: MessagesSquare },
  { to: "/faculty/knowledge-graph", label: "Knowledge Graph", icon: Network },
  { to: "/faculty/upload", label: "Upload Content", icon: Upload },
  { to: "/faculty/documents", label: "My Documents", icon: FileText },
  { to: "/faculty/queries", label: "Student Queries", icon: MessagesSquare },
  { to: "/faculty/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/faculty/quizzes", label: "Quiz Manager", icon: ListChecks },
  { to: "/faculty/escalations", label: "Escalations", icon: AlertTriangle },
  { to: "/faculty/announcements", label: "Announcements", icon: Megaphone },
  { to: "/faculty/profile", label: "My Profile", icon: UserCircle },
];

export const Route = createFileRoute("/faculty")({
  head: () => ({ meta: [{ title: "Faculty · AI Tutor" }, { name: "description", content: "Faculty portal for AI Tutor." }] }),
  component: () => <AppShell role="faculty" nav={nav} />,
});
