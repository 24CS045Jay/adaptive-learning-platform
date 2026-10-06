import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Download, RefreshCw, ScrollText, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { auditLogs as defaultLogs } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Compliance Audit Trail · AI Tutor Admin" },
      { name: "description", content: "Immutable compliance audit logs tracking all system actions and modifications." },
    ],
  }),
  component: AuditLogsPage,
});

function actionTone(a: string) {
  if (a.includes("APPROVE") || a.includes("SUCCESS")) return "green" as const;
  if (a.includes("UPLOAD") || a.includes("REGISTER") || a.includes("ADD") || a.includes("CREATE")) return "indigo" as const;
  if (a.includes("REJECT") || a.includes("DELETE") || a.includes("REMOVE")) return "red" as const;
  if (a.includes("REINDEX") || a.includes("UPDATE") || a.includes("RESOLVE")) return "amber" as const;
  return "slate" as const;
}

function AuditLogsPage() {
  const { auditLog: liveAuditLogs, refreshAuditLog } = useAppData();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [exportedBanner, setExportedBanner] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Normalize logs
  const logs = (liveAuditLogs && liveAuditLogs.length > 0 ? liveAuditLogs : defaultLogs).map((l: any) => ({
    id: String(l.id || l._id),
    time: l.time || (l.timestamp ? new Date(l.timestamp).toLocaleString() : new Date().toLocaleString()),
    actor: l.actor || l.actorEmail || "system",
    action: l.action || "SYSTEM_EVENT",
    details: l.details || (typeof l.target === "object" ? JSON.stringify(l.target) : String(l.target || "")),
  }));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAuditLog();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filtered = logs.filter((l) => {
    if (roleFilter !== "all") {
      const act = l.actor.toLowerCase();
      if (roleFilter === "admin" && !act.includes("admin")) return false;
      if (roleFilter === "faculty" && !act.includes("faculty") && !act.includes("prof") && !act.includes("dr.")) return false;
      if (roleFilter === "student" && !act.includes("student") && !act.includes("stu") && !act.includes("24cs")) return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        l.actor.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    const csvRows = ["ID,Time,Actor,Action,Details"];
    filtered.forEach((l) => {
      csvRows.push(`"${l.id}","${l.time}","${l.actor}","${l.action}","${l.details.replace(/"/g, '""')}"`);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    setExportedBanner(true);
    setTimeout(() => setExportedBanner(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Immutable Compliance Audit Trail"
        subtitle={`System audit log tracking all platform actions, logins, approvals, and data modifications (${filtered.length} entries).`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-accent/50 shadow-xs transition"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin text-violet")} />
              Refresh Logs
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-hover shadow-xs transition"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        }
      />

      {exportedBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-success/5 px-6 py-4 text-sm text-success font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Audit log CSV exported successfully!
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by actor email, action event (e.g. APPROVE_DOC), or details..."
            className="w-full text-sm outline-none placeholder:text-muted-foreground bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Actor Role:</span>
          {["all", "admin", "faculty", "student"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition",
                roleFilter === r
                  ? "bg-violet text-white shadow-xs"
                  : "bg-background border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="pb-3 pr-4 pl-2">Timestamp</th>
                <th className="pb-3 pr-4">Actor Email / Name</th>
                <th className="pb-3 pr-4">Action Event</th>
                <th className="pb-3 pr-2">Audit Details / Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-accent/40 transition">
                  <td className="py-3.5 pr-4 pl-2 text-xs font-mono text-muted-foreground whitespace-nowrap">{l.time}</td>
                  <td className="py-3.5 pr-4 font-semibold text-foreground whitespace-nowrap">{l.actor}</td>
                  <td className="py-3.5 pr-4 whitespace-nowrap">
                    <Pill tone={actionTone(l.action)}>{l.action}</Pill>
                  </td>
                  <td className="py-3.5 pr-2 font-mono text-xs text-muted-foreground truncate max-w-xs">{l.details}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                    No audit logs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
