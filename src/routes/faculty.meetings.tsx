import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { FacultyMeetingManager } from "@/components/meetings/FacultyMeetingManager";
import { Video, Calendar, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/faculty/meetings")({
  head: () => ({
    meta: [
      { title: "Faculty Connect & Teams Meetings · EduSense AI" },
      { name: "description", content: "Schedule office hours, doubt clearing sessions, and Microsoft Teams meetings with students." },
    ],
  }),
  component: FacultyMeetingsPage,
});

export function FacultyMeetingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Connect & Teams Meetings"
        subtitle="Schedule office hours, conduct group doubt seminars, and approve student consultation requests with Microsoft Teams."
      />

      {/* Overview Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Delivery Mode</div>
            <div className="text-sm font-bold text-foreground">Microsoft Teams</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Target Audience</div>
            <div className="text-sm font-bold text-foreground">Department & Targeted</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Security</div>
            <div className="text-sm font-bold text-foreground">Grounded Approval Flow</div>
          </div>
        </div>
      </div>

      {/* Dedicated Meeting Manager Component */}
      <FacultyMeetingManager />
    </div>
  );
}
