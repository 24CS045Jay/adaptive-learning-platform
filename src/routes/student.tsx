import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageCircle,
  Search,
  ListChecks,
  Bookmark,
  CalendarClock,
  Megaphone,
  Network,
  MessageSquare,
  Video,
  Sparkles,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  // Core Learning
  { to: "/student", label: "Overview", icon: LayoutDashboard, section: "Core Learning" },
  { to: "/student/ask", label: "AI Tutor", icon: MessageCircle, section: "Core Learning" },
  { to: "/student/quizzes", label: "Adaptive Quizzes", icon: ListChecks, section: "Core Learning" },
  { to: "/student/planner", label: "Study Planner", icon: CalendarClock, section: "Core Learning" },

  // Faculty & Meetings
  { to: "/student/meetings", label: "Office Hours (Teams)", icon: Video, section: "Faculty & Meetings" },
  { to: "/student/ai-faculty", label: "AI Faculty Avatar", icon: Sparkles, section: "Faculty & Meetings" },

  // Knowledge & Resources
  { to: "/student/concept-map", label: "Concept Map", icon: Network, section: "Resources" },
  { to: "/student/bookmarks", label: "Saved Notes", icon: Bookmark, section: "Resources" },
  { to: "/student/discussion", label: "Discussions", icon: MessageSquare, section: "Resources" },
  { to: "/student/search", label: "Search Syllabus", icon: Search, section: "Resources" },
  { to: "/student/announcements", label: "Announcements", icon: Megaphone, section: "Resources" },
];

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student Portal · EduSense AI" },
      { name: "description", content: "Academic AI Tutoring and syllabus-grounded learning for students." },
    ],
  }),
  component: () => <AppShell role="student" nav={nav} />,
});
