import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, MessagesSquare, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard, ActionCard, Card, EmptyState, Pill } from "@/components/app-shell";
import { WelcomeHero } from "@/components/welcome-hero";
import { useAppData } from "@/lib/app-data-context";
import { useAuth } from "@/lib/auth";
import { BookOpen, AlertCircle, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faculty/")(
  { component: FacultyDashboard }
);

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const sizeClass = size === "sm"
    ? "h-7 w-7 text-[10px]"
    : "h-8 w-8 text-xs";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-violet/15 font-bold text-violet", sizeClass)}>
      {initials}
    </div>
  );
}

/* Relative-time helper (fake but realistic) */
function relTime(idx: number) {
  const options = ["just now", "2 min ago", "5 min ago", "12 min ago", "28 min ago", "1 hr ago"];
  return options[idx % options.length];
}

function FacultyDashboard() {
  const { documents, queries, escalations, subjects } = useAppData();
  const { user } = useAuth();

  const myEmail = user?.email?.toLowerCase() ?? "faculty@charusat.edu.in";
  const myName  = user?.name ?? "Dr. Nisha Shah";

  const myDocs = documents.filter((d) => {
    const isOwner = d.uploadedBy.toLowerCase() === myEmail || d.uploadedByName.toLowerCase() === myName.toLowerCase();
    if (myEmail === "faculty@charusat.edu.in") return isOwner || d.uploadedBy === "faculty@charusat.edu.in";
    return isOwner;
  });

  const mySubjects = subjects.filter((s) => {
    if (myEmail === "faculty@charusat.edu.in") return s.faculty === "Dr. Nisha Shah";
    return s.faculty.toLowerCase().includes(myName.toLowerCase()) || myDocs.some((d) => d.subjectId === s.id);
  });

  const displaySubjectsCount = mySubjects.length > 0 ? mySubjects.length : subjects.length;
  const pendingCount = myDocs.filter((d) => d.status === "pending").length;
  const totalPending = documents.filter((d) => d.status === "pending").length;
  const openEscal    = escalations.filter((e) => e.status === "open").length;

  return (
    <div>
      <WelcomeHero
        name={myName.split(" ")[0]}
        subtitle={`Managing ${displaySubjectsCount} CSE subjects. Here’s what’s happening in your classes.`}
        note={["Teach", "Guide", "Inspire"]}
        tagline={["Great teaching", "shapes brighter", "futures!"]}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/faculty/subjects" className="block">
          <StatCard label="My Subjects" value={displaySubjectsCount} color="indigo" icon={BookOpen} caption="Click to manage →" />
        </Link>
        <Link to="/faculty/documents" className="block">
          <StatCard label="My Documents" value={myDocs.length} color="amber" icon={FileText} caption="View contributed materials →" />
        </Link>
        <Link to="/faculty/upload" className="block">
          <StatCard
            label="Docs Pending Approval"
            value={totalPending}
            color="red"
            icon={AlertCircle}
            caption={pendingCount > 0 ? `${pendingCount} uploaded by you` : "Awaiting admin review"}
          />
        </Link>
        <Link to="/faculty/escalations" className="block">
          <StatCard label="Open Escalations" value={openEscal} color="teal" icon={MessageSquare} caption="Student questions needing response →" />
        </Link>
      </div>

      {/* Quick Action Cards — with color strip + arrow on hover */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/faculty/upload">
          <ActionCard icon={Upload}         title="Upload Content"          description="Add PDFs, slides, or notes for approval." color="indigo" />
        </Link>
        <Link to="/faculty/escalations">
          <ActionCard icon={MessagesSquare} title="Review Student Queries"  description="See what students are asking the tutor."   color="amber" />
        </Link>
        <Link to="/faculty/quizzes">
          <ActionCard icon={Sparkles}       title="Generate a Quiz"         description="Auto-generate questions from a document."  color="green" />
        </Link>
      </div>

      {/* Activity Feed */}
      <div className="mt-6">
        <Card title="Recent Student Questions">
          {queries.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="No questions asked yet" description="Student questions will appear here as they use the tutor." />
          ) : (
            <ul className="space-y-0">
              {queries.slice(0, 6).map((q, i) => (
                <motion.li
                  key={q.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.2 }}
                  className="activity-item group flex items-start gap-3 border-t border-border py-3.5 pl-3 first:border-none first:pt-0 transition hover:bg-accent/25"
                >
                  <Avatar name={q.student} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-foreground">{q.student}</span>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-snug">{q.question}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill tone="indigo">{q.subject}</Pill>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                        {relTime(i)}
                      </span>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
