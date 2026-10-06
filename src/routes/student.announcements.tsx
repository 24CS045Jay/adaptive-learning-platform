import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, Search, RefreshCw, Bell } from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements · AI Tutor Student" },
      { name: "description", content: "Official updates, exam reminders, and announcements." },
    ],
  }),
  component: Announcements,
});

function Announcements() {
  const { announcements, subjects } = useAppData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScope, setSelectedScope] = useState("all");

  const filtered = announcements.filter((a) => {
    if (selectedScope !== "all" && a.scope !== selectedScope) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.postedBy || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Announcements"
        subtitle={`Stay informed with institution-wide notices and subject broadcasts (${announcements.length} total).`}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search announcements by title, content, or author..."
            className="w-full text-sm outline-none placeholder:text-muted-foreground bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Scope:</span>
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-violet"
          >
            <option value="all">All Scopes</option>
            <option value="Institution">Institution-wide</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-muted-foreground mb-2">
                <Bell className="h-6 w-6" />
              </div>
              <div className="font-semibold text-foreground">No announcements found</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {searchTerm || selectedScope !== "all"
                  ? "Try resetting your filter or search query."
                  : "New notices from faculty or university admin will appear here."}
              </p>
            </div>
          </Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Pill tone={a.scope === "Institution" ? "amber" : "indigo"}>
                      {a.scope}
                    </Pill>
                    <span className="text-xs text-muted-foreground">
                      Posted on {a.createdAt} · By <strong className="text-foreground">{a.postedBy}</strong>
                    </span>
                  </div>
                  <div className="font-serif text-lg font-bold text-foreground leading-snug">
                    {a.title}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90 font-sans">
                {a.message}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
