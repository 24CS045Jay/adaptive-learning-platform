import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, ShieldCheck, Printer, Filter, Sparkles } from "lucide-react";
import { PageHeader, Card, PrimaryButton, Pill } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { API_BASE, authHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reports")({
  component: Reports,
});

export type ReportType = "student_mastery" | "faculty_coverage" | "rag_compliance";

function Reports() {
  const { subjects, documents, users, queries } = useAppData();
  const { user } = useAuth();
  const token = localStorage.getItem("token") || "";

  const [activeReportType, setActiveReportType] = useState<ReportType>("student_mastery");
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [liveReports, setLiveReports] = useState<any[]>([]);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch(`${API_BASE}/api/analytics/institutional-reports`, {
          headers: authHeaders(token, { role: user?.role, id: user?.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setLiveReports(data);
        }
      } catch (err) {
        console.warn("[Reports] Failed to fetch live reports:", err);
      }
    }
    fetchReports();
  }, [token, user]);

  const reportRows = liveReports.length > 0
    ? liveReports
    : subjects.map((s) => {
        const approvedDocs = documents.filter((d) => (d.subjectId === s.id || (d as any).subject_id === s.id) && d.status === "approved").length;
        const studentCount = (s.enrolledStudentIds || []).length;
        const subjQueries = queries.filter((q) => q.subject === s.name || q.subject === s.code).length;

        return {
          id: s.id,
          subjectName: s.name,
          code: s.code,
          faculty: s.faculty || "Assigned Faculty",
          approvedDocs,
          studentCount,
          queriesCount: subjQueries,
          masteryPct: 0,
          hasMasteryData: false,
          complianceStatus: approvedDocs >= 1 ? "Compliant ✓" : "Pending Materials",
        };
      });

  const handleExportCSV = () => {
    const headers = ["Subject,Code,Faculty,Approved_Docs,Enrolled_Students,Total_Queries,Mastery_Pct,Compliance"];
    reportRows.forEach((r) => {
      headers.push(`"${r.subjectName}","${r.code}","${r.faculty}",${r.approvedDocs},${r.studentCount},${r.queriesCount},"${r.masteryPct}%","${r.complianceStatus}"`);
    });

    const blob = new Blob([headers.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `institutional_report_${activeReportType}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Institutional Export & Reports Workbench"
        subtitle="Generate, preview, and export compliance reports for accreditation, faculty reviews, and student mastery audits."
        action={
          <div className="flex items-center gap-2">
            <PrimaryButton icon={Download} onClick={handleExportCSV}>
              Export Report (CSV)
            </PrimaryButton>
          </div>
        }
      />

      {downloadSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-success/5 px-6 py-4 text-sm text-success font-medium">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Institutional report exported successfully! File saved to your downloads.
        </div>
      )}

      {/* Report Type Selector Tabs */}
      <div className="mb-6 flex border-b border-border bg-card px-6 rounded-2xl shadow-xs">
        {[
          { id: "student_mastery", label: "Student Performance & Mastery Report" },
          { id: "faculty_coverage", label: "Faculty Document Coverage & Approvals" },
          { id: "rag_compliance", label: "RAG Engine Groundedness Compliance Audit" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveReportType(tab.id as ReportType)}
            className={cn(
              "border-b-2 px-5 py-4 text-sm font-medium transition",
              activeReportType === tab.id
                ? "border-violet text-violet font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generated Summary Table · {new Date().toLocaleDateString()}
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="green">Accreditation Compliant ✓</Pill>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">Subject</th>
                <th className="pb-3 pr-4">Code</th>
                <th className="pb-3 pr-4">Faculty Lead</th>
                <th className="pb-3 pr-4">Approved Materials</th>
                <th className="pb-3 pr-4">Enrolled Students</th>
                <th className="pb-3 pr-4">Total RAG Queries</th>
                <th className="pb-3 pr-4">Avg Student Mastery</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r) => (
                <tr key={r.code} className="border-t border-border hover:bg-accent/40">
                  <td className="py-3 pr-4 font-bold text-foreground">{r.subjectName}</td>
                  <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{r.code}</td>
                  <td className="py-3 pr-4 text-foreground">{r.faculty}</td>
                  <td className="py-3 pr-4 text-foreground font-semibold">{r.approvedDocs} Docs</td>
                  <td className="py-3 pr-4 text-muted-foreground">{r.studentCount} Students</td>
                  <td className="py-3 pr-4 text-violet font-semibold">{r.queriesCount}</td>
                  <td className="py-3 pr-4 text-success font-bold">
                    {r.hasMasteryData ? `${r.masteryPct}%` : <span className="text-xs text-muted-foreground italic">No attempts yet</span>}
                  </td>
                  <td className="py-3"><Pill tone={r.approvedDocs > 0 ? "green" : "amber"}>{r.complianceStatus}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
