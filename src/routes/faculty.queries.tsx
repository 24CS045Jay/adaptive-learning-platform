import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, RefreshCw, MessagesSquare, AlertCircle } from "lucide-react";
import { PageHeader, Card, Pill, EmptyState } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/queries")({
  head: () => ({
    meta: [
      { title: "Student Queries Telemetry · AI Tutor Faculty" },
      { name: "description", content: "Real-time log of student questions asked to the AI Tutor." },
    ],
  }),
  component: StudentQueriesPage,
});

function StudentQueriesPage() {
  const { queries, refreshQueries, subjects } = useAppData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredQueries = queries.filter((q) => {
    if (selectedSubject !== "all" && q.subject !== selectedSubject) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        q.student.toLowerCase().includes(term) ||
        q.question.toLowerCase().includes(term) ||
        q.subject.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Student Queries Telemetry"
        subtitle={`Live monitoring of student interactions with the AI Tutor (${filteredQueries.length} questions logged).`}
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent/50 shadow-xs transition"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin text-violet")} />
            Refresh Telemetry
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student questions, concepts, or student names..."
            className="w-full text-sm outline-none placeholder:text-muted-foreground bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Subject:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:border-violet"
          >
            <option value="all">All Subjects ({subjects.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        {filteredQueries.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No student queries found"
            description={searchTerm ? "Try adjusting your search filter." : "Student questions asked to Ask Tutor will stream here in real time."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="pb-3 pl-2">Student</th>
                  <th className="pb-3 px-3">Subject</th>
                  <th className="pb-3 px-3">Question / Doubt</th>
                  <th className="pb-3 px-3 text-center">Confidence</th>
                  <th className="pb-3 pr-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueries.map((q: any) => {
                  const conf = q.confidence ?? 92;
                  return (
                    <tr key={q.id} className="border-t border-border hover:bg-accent/40 transition">
                      <td className="py-3.5 pl-2 font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
                            {(q.student || "S").charAt(0).toUpperCase()}
                          </div>
                          <span>{q.student}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Pill tone="indigo">{q.subject}</Pill>
                      </td>
                      <td className="py-3.5 px-3 text-foreground min-w-[280px]">
                        <div className="font-normal leading-relaxed">{q.question}</div>
                        {q.escalated && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-600">
                            <AlertCircle className="h-3 w-3" /> Escalated to Faculty
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <Pill tone={conf >= 85 ? "green" : conf >= 65 ? "amber" : "red"}>
                          {conf}%
                        </Pill>
                      </td>
                      <td className="py-3.5 pr-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {q.createdAt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
