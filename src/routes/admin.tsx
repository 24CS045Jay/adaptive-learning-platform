import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  History,
  UserPlus,
  BookOpen,
  CheckSquare,
  Database,
  BarChart3,
  ScrollText,
  Megaphone,
  FileBarChart,
  UserCircle,
  Network,
  LineChart,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/user-logs", label: "User Logs", icon: History },
  { to: "/admin/subjects", label: "Courses & Subjects", icon: BookOpen },
  { to: "/admin/approvals", label: "Content Approvals", icon: CheckSquare },
  { to: "/admin/knowledge", label: "Knowledge Base", icon: Database },
  { to: "/admin/graph", label: "Concept Graph", icon: Network },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/research", label: "Research Metrics", icon: LineChart },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/profile", label: "My Profile", icon: UserCircle },
];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · AI Tutor" },
      { name: "description", content: "Admin portal for AI Tutor." },
    ],
  }),
  component: () => <AppShell role="admin" nav={nav} />,
});
