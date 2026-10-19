import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { StudentMeetingScheduler } from "@/components/meetings/StudentMeetingScheduler";
import { Video, Calendar, Clock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/student/meetings")({
  head: () => ({
    meta: [
      { title: "Faculty Connect & Doubt Sessions · EduSense AI" },
      { name: "description", content: "Schedule 1-on-1 office hours or small group doubt solving sessions with professors via Microsoft Teams." },
    ],
  }),
  component: StudentMeetingsPage,
});

export function StudentMeetingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Connect & Doubt Sessions"
        subtitle="Book 1-on-1 office hours or small group syllabus doubt consultations with course professors using Microsoft Teams."
      />

      {/* Info Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Session Platform</div>
            <div className="text-sm font-bold text-foreground">Microsoft Teams</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Approval Mode</div>
            <div className="text-sm font-bold text-foreground">Faculty Confirmed</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Audience Scope</div>
            <div className="text-sm font-bold text-foreground">Department Scoped</div>
          </div>
        </div>
      </div>

      {/* Dedicated Meeting Scheduler Component */}
      <StudentMeetingScheduler />
    </div>
  );
}
