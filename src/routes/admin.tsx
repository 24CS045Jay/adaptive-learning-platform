import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  History,
  BookOpen,
  CheckSquare,
  Database,
  BarChart3,
  ScrollText,
  Megaphone,
  FileBarChart,
  Network,
  LineChart,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  // Institutional Health
  { to: "/admin", label: "Overview & Health", icon: LayoutDashboard, section: "Institutional Health" },
  { to: "/admin/analytics", label: "Campus Analytics", icon: BarChart3, section: "Institutional Health" },
  { to: "/admin/research", label: "Research Metrics", icon: LineChart, section: "Institutional Health" },

  // User Administration
  { to: "/admin/users", label: "User Management & Excel", icon: Users, section: "User Administration" },
  { to: "/admin/user-logs", label: "User Session Logs", icon: History, section: "User Administration" },

  // Curriculum & Indexing Approvals
  { to: "/admin/approvals", label: "Content Approvals Queue", icon: CheckSquare, section: "Curriculum & Ingestion" },
  { to: "/admin/subjects", label: "Courses & Departments", icon: BookOpen, section: "Curriculum & Ingestion" },
  { to: "/admin/knowledge", label: "Vector Knowledge Base", icon: Database, section: "Curriculum & Ingestion" },
  { to: "/admin/graph", label: "Curriculum Concept Graph", icon: Network, section: "Curriculum & Ingestion" },

  // Compliance & Audits
  { to: "/admin/audit", label: "Security Audit Logs", icon: ScrollText, section: "Compliance & Audits" },
  { to: "/admin/reports", label: "System Reports", icon: FileBarChart, section: "Compliance & Audits" },
  { to: "/admin/announcements", label: "Institutional Announcements", icon: Megaphone, section: "Compliance & Audits" },
];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal · EduSense AI" },
      { name: "description", content: "Campus administrator portal for EduSense AI." },
    ],
  }),
  component: () => <AppShell role="admin" nav={nav} />,
});
