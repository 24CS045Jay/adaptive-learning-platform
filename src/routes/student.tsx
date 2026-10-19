import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard, MessageCircle, Search, ListChecks, Bookmark,
  CalendarClock, Megaphone, UserCircle, Network, MessageSquare, Video, Sparkles,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard },
  { to: "/student/ai-faculty", label: "AI Faculty", icon: Sparkles },
  { to: "/student/ask", label: "Ask Tutor", icon: MessageCircle },
  { to: "/student/meetings", label: "Faculty Connect", icon: Video },
  { to: "/student/planner", label: "Study Planner", icon: CalendarClock },
  { to: "/student/concept-map", label: "Concept Map", icon: Network },
  { to: "/student/discussion", label: "Discussions", icon: MessageSquare },
  { to: "/student/search", label: "Search Notes", icon: Search },
  { to: "/student/quizzes", label: "Quizzes", icon: ListChecks },
  { to: "/student/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/student/announcements", label: "Announcements", icon: Megaphone },
  { to: "/student/profile", label: "My Profile", icon: UserCircle },
];

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Student · EduSense AI" }, { name: "description", content: "Student learning dashboard for EduSense AI — Learn Smarter. Adapt Faster. Achieve More." }] }),
  component: () => <AppShell role="student" nav={nav} />,
});
