import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Users,
  GripVertical,
  Link2,
  FileText,
  Presentation,
  FileType2,
  X,
  Check,
  Edit3,
  Save,
  CheckCircle2,
  UserCheck,
  Building2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { PageHeader, Card, PrimaryButton, Pill, EmptyState } from "@/components/app-shell";
import { useAppData } from "@/lib/app-data-context";
import type { LearningModule, LearningResource, ResourceType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getDepartmentCode, getDepartmentLabel } from "@/lib/department-utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/subjects")({
  head: () => ({
    meta: [
      { title: "Course & Subject Management · AI Tutor Admin" },
      { name: "description", content: "Assign faculty to subjects, manage modules, resources, and student enrollment." },
    ],
  }),
  component: SubjectsPage,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<ResourceType, React.ElementType> = {
  pdf: FileText,
  pptx: Presentation,
  docx: FileType2,
  link: Link2,
  video: BookOpen,
};

const RESOURCE_COLORS: Record<ResourceType, string> = {
  pdf: "bg-red-brand/10 text-red-brand",
  pptx: "bg-amber-brand/15 text-gold",
  docx: "bg-indigo-brand/10 text-violet",
  link: "bg-teal-brand/10 text-teal-brand",
  video: "bg-green-brand/10 text-green-brand",
};

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  facultyId?: string;
  departmentId?: string;
}

function SubjectsPage() {
  const {
    subjects: subjectList,
    modules,
    resources,
    users,
    refreshUsers,
    addSubject,
    deleteSubject,
    updateSyllabus,
    updateSubjectFaculty,
    addModule,
    removeModule,
    addResource,
    removeResource,
    enrollStudent,
    unenrollStudent,
  } = useAppData();
  const { user: adminUser } = useAuth();

  const adminDeptCode = getDepartmentCode(adminUser?.departmentId) || "CSE";
  const isSuperAdmin =
    String(adminUser?.role ?? "").toLowerCase() === "super_admin" ||
    !adminUser?.departmentId ||
    adminUser?.departmentId === "all";

  // Additional live Supabase faculty fetch to guarantee 100% immediate reflection
  const [liveFaculty, setLiveFaculty] = useState<FacultyMember[]>([]);

  useEffect(() => {
    const fetchDirectFaculty = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, email, role, department_id, faculty_id")
          .eq("role", "faculty");

        if (!error && Array.isArray(data)) {
          const mapped = data.map((d: any) => ({
            id: String(d.id),
            name: d.name || "Faculty Member",
            email: d.email,
            facultyId: d.faculty_id,
            departmentId: (d.department_id || "").toUpperCase(),
          }));
          setLiveFaculty(mapped);
        }
      } catch (err) {
        console.warn("[Subjects] Live faculty fetch notice:", err);
      }
    };
    fetchDirectFaculty();
    refreshUsers();
  }, [adminUser]);

  // Merge faculty from AppDataContext users and direct Supabase fetch
  const allFacultyList = useMemo(() => {
    const map = new Map<string, FacultyMember>();

    // From context users
    users
      .filter((u) => String(u.role).toLowerCase() === "faculty")
      .forEach((u) => {
        map.set(u.email.toLowerCase(), {
          id: u.id,
          name: u.name,
          email: u.email,
          facultyId: u.facultyId,
          departmentId: (u.departmentId || "").toUpperCase(),
        });
      });

    // From direct Supabase query
    liveFaculty.forEach((f) => {
      if (!map.has(f.email.toLowerCase())) {
        map.set(f.email.toLowerCase(), f);
      }
    });

    const list = Array.from(map.values());

    // Filter by admin department if not super_admin
    return list.filter((f) => {
      if (isSuperAdmin) return true;
      const fDept = (f.departmentId || "").toUpperCase();
      const aDept = adminDeptCode.toUpperCase();
      return !fDept || fDept === aDept || fDept.includes(aDept) || aDept.includes(fDept);
    });
  }, [users, liveFaculty, isSuperAdmin, adminDeptCode]);

  // Scoped students for enrollment
  const studentUsers = useMemo(() => {
    return users.filter((u) => {
      if (String(u.role).toLowerCase() !== "student") return false;
      if (isSuperAdmin) return true;
      const uDept = (u.departmentId || "").toUpperCase();
      const aDept = adminDeptCode.toUpperCase();
      return !uDept || uDept === aDept || uDept.includes(aDept) || aDept.includes(uDept);
    });
  }, [users, isSuperAdmin, adminDeptCode]);

  // Modal / Form state for Add Subject
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState("");
  const [newSubjCode, setNewSubjCode] = useState("");
  const [newSubjSem, setNewSubjSem] = useState("5");
  const [newSubjFaculty, setNewSubjFaculty] = useState("");
  const [newSubjSyllabus, setNewSubjSyllabus] = useState("");
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Set default faculty selection when faculty list loads
  useEffect(() => {
    if (!newSubjFaculty && allFacultyList.length > 0) {
      setNewSubjFaculty(allFacultyList[0].name);
    }
  }, [allFacultyList]);

  // Expanded card state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    Record<string, "syllabus" | "modules" | "resources" | "students" | "faculty">
  >({});

  // Assign faculty per subject card state
  const [assigningFacultySubjId, setAssigningFacultySubjId] = useState<string | null>(null);
  const [selectedFacultyForSubj, setSelectedFacultyForSubj] = useState<string>("");

  // Module / Resource form states
  const [newModuleName, setNewModuleName] = useState<Record<string, string>>({});
  const [newRes, setNewRes] = useState<{
    moduleId: string | null;
    name: string;
    type: ResourceType;
    url: string;
  }>({
    moduleId: null,
    name: "",
    type: "link",
    url: "",
  });
  const [editingSyllabusId, setEditingSyllabusId] = useState<string | null>(null);
  const [syllabusEdit, setSyllabusEdit] = useState("");

  const getTab = (sid: string) => activeTab[sid] ?? "syllabus";

  const subjectModules = (sid: string) =>
    modules.filter((m) => m.subjectId === sid).sort((a, b) => a.order - b.order);

  const moduleResources = (mid: string) => resources.filter((r) => r.moduleId === mid);

  // Handle Add Subject
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim() || !newSubjCode.trim()) return;

    const assignedFac = newSubjFaculty.trim() || (allFacultyList[0]?.name ?? "Faculty Member");

    addSubject({
      name: newSubjName.trim(),
      code: newSubjCode.trim().toUpperCase(),
      semester: parseInt(newSubjSem, 10),
      faculty: assignedFac,
      syllabus: newSubjSyllabus.trim(),
    });

    setNewSubjName("");
    setNewSubjCode("");
    setNewSubjSyllabus("");
    setShowAddSubjectModal(false);
    setNotificationBanner(`Subject "${newSubjName.trim()}" created and assigned to ${assignedFac}!`);
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  // Handle Changing/Reassigning Faculty for an existing subject
  const handleSaveFacultyAssignment = async (subjectId: string, subjectName: string) => {
    if (!selectedFacultyForSubj) return;
    const targetFaculty = allFacultyList.find((f) => f.name === selectedFacultyForSubj || f.id === selectedFacultyForSubj);
    const facultyName = targetFaculty ? targetFaculty.name : selectedFacultyForSubj;
    const facultyId = targetFaculty?.id;

    await updateSubjectFaculty(subjectId, facultyName, facultyId);

    setAssigningFacultySubjId(null);
    setNotificationBanner(`Assigned "${facultyName}" as the faculty for ${subjectName}!`);
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  const handleAddModule = (sid: string) => {
    const name = newModuleName[sid]?.trim();
    if (!name) return;
    const existing = subjectModules(sid);
    addModule({ subjectId: sid, order: existing.length + 1, name });
    setNewModuleName((prev) => ({ ...prev, [sid]: "" }));
  };

  const handleAddResource = () => {
    if (!newRes.moduleId || !newRes.name.trim()) return;
    addResource({
      moduleId: newRes.moduleId,
      name: newRes.name.trim(),
      type: newRes.type,
      url: newRes.url || undefined,
    });
    setNewRes({ moduleId: null, name: "", type: "link", url: "" });
  };

  const saveSyllabus = (sid: string) => {
    updateSyllabus(sid, syllabusEdit);
    setEditingSyllabusId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses & Subjects"
        subtitle={`Department: ${getDepartmentLabel(adminDeptCode)} · Manage semester subjects, faculty assignments, modules, and student enrollments.`}
        action={
          <PrimaryButton icon={Plus} onClick={() => setShowAddSubjectModal(true)}>
            Add Subject
          </PrimaryButton>
        }
      />

      {notificationBanner && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <span>{notificationBanner}</span>
        </div>
      )}

      {/* ── Add Subject Modal ── */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <BookOpen className="h-5 w-5 text-violet" /> Add New Subject
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="e.g. Artificial Intelligence"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newSubjCode}
                    onChange={(e) => setNewSubjCode(e.target.value)}
                    placeholder="CSE504"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs uppercase text-foreground outline-none focus:border-violet font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Semester
                  </label>
                  <select
                    value={newSubjSem}
                    onChange={(e) => setNewSubjSem(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet font-semibold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Assigned Faculty</span>
                    <span className="text-[10px] text-violet lowercase font-normal">
                      {allFacultyList.length} faculty found
                    </span>
                  </label>
                  <select
                    value={newSubjFaculty}
                    onChange={(e) => setNewSubjFaculty(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet font-semibold"
                  >
                    {allFacultyList.length > 0 ? (
                      allFacultyList.map((f) => (
                        <option key={f.id || f.email} value={f.name}>
                          {f.name} {f.facultyId ? `(${f.facultyId})` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="Dr. Nisha Shah">Dr. Nisha Shah (Default Faculty)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Course Syllabus / Description
                </label>
                <textarea
                  value={newSubjSyllabus}
                  onChange={(e) => setNewSubjSyllabus(e.target.value)}
                  placeholder="Overview of topics, learning objectives, and prerequisites..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-violet"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet px-5 py-2 text-xs font-semibold text-white hover:bg-violet-hover shadow-sm transition"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Subjects List ── */}
      <div className="space-y-4">
        {subjectList.map((s) => {
          const isOpen = expandedId === s.id;
          const tab = getTab(s.id);
          const mods = subjectModules(s.id);
          const enrolled = studentUsers.filter((u) => s.enrolledStudentIds?.includes(u.id));

          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition hover:border-violet/30"
            >
              {/* Header row */}
              <div
                onClick={() => setExpandedId(isOpen ? null : s.id)}
                className="flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left hover:bg-accent/20 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="font-mono text-xs font-bold text-violet bg-violet/10 px-2 py-0.5 rounded-md border border-violet/20">
                        {s.code}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Sem {s.semester}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted px-2 py-0.5 rounded-md">
                        <UserCheck className="h-3 w-3 text-violet" />
                        <strong>{s.faculty || "Not Assigned"}</strong>
                      </span>
                      <span>•</span>
                      <span>{mods.length} modules</span>
                      <span>•</span>
                      <span>{enrolled.length} students enrolled</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {/* Quick Assign Faculty Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAssigningFacultySubjId(assigningFacultySubjId === s.id ? null : s.id);
                      setSelectedFacultyForSubj(s.faculty || (allFacultyList[0]?.name ?? ""));
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-violet/30 bg-violet/5 px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet hover:text-white transition shadow-xs"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Assign Faculty</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete subject "${s.name}" (${s.code})?`)) {
                        deleteSubject(s.id);
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition rounded-lg hover:bg-destructive/10"
                    title="Delete subject"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div
                    onClick={() => setExpandedId(isOpen ? null : s.id)}
                    className="p-1 text-muted-foreground cursor-pointer"
                  >
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </div>
                </div>
              </div>

              {/* Quick Assign Faculty Panel */}
              {assigningFacultySubjId === s.id && (
                <div className="border-t border-border bg-muted/30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-violet" />
                    <span className="text-xs font-bold text-foreground">
                      Assign Faculty to <strong className="text-violet">{s.name}</strong>:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFacultyForSubj}
                      onChange={(e) => setSelectedFacultyForSubj(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-violet"
                    >
                      {allFacultyList.map((f) => (
                        <option key={f.id || f.email} value={f.name}>
                          {f.name} {f.facultyId ? `[${f.facultyId}]` : ""} ({f.email})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleSaveFacultyAssignment(s.id, s.name)}
                      className="flex items-center gap-1 rounded-xl bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-hover shadow-xs transition"
                    >
                      <Check className="h-3.5 w-3.5" /> Save Assignment
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssigningFacultySubjId(null)}
                      className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded panel */}
              {isOpen && (
                <div className="border-t border-border">
                  {/* Tab bar */}
                  <div className="flex border-b border-border px-6">
                    {(["syllabus", "modules", "resources", "students"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActiveTab((prev) => ({ ...prev, [s.id]: t }))}
                        className={cn(
                          "border-b-2 px-4 py-3 text-xs font-semibold capitalize transition-colors",
                          tab === t
                            ? "border-violet text-violet font-bold"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="px-6 py-5">
                    {/* ── Syllabus tab ── */}
                    {tab === "syllabus" && (
                      <div>
                        {editingSyllabusId === s.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={syllabusEdit}
                              onChange={(e) => setSyllabusEdit(e.target.value)}
                              rows={6}
                              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-xs text-foreground outline-none focus:border-violet"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveSyllabus(s.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet-hover"
                              >
                                <Save className="h-3.5 w-3.5" /> Save Syllabus
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSyllabusId(null)}
                                className="rounded-xl border border-border bg-card px-4 py-2 text-xs text-muted-foreground hover:bg-accent/40"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {s.syllabus || (
                                <span className="italic text-muted-foreground">
                                  No syllabus added yet.
                                </span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSyllabusId(s.id);
                                setSyllabusEdit(s.syllabus ?? "");
                              }}
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet hover:underline"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Edit Syllabus
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Modules tab ── */}
                    {tab === "modules" && (
                      <div className="space-y-3">
                        {mods.length === 0 && (
                          <EmptyState
                            icon={BookOpen}
                            title="No modules yet"
                            description="Add the first learning module below."
                          />
                        )}
                        {mods.map((mod) => (
                          <div
                            key={mod.id}
                            className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3"
                          >
                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
                              {mod.order}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-foreground">{mod.name}</div>
                              {mod.description && (
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {mod.description}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeModule(mod.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        <div className="flex gap-2 pt-2">
                          <input
                            value={newModuleName[s.id] ?? ""}
                            onChange={(e) =>
                              setNewModuleName((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            onKeyDown={(e) => e.key === "Enter" && handleAddModule(s.id)}
                            placeholder="New module name, e.g. Unit 5 – Deep Learning & Transformers"
                            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-xs text-foreground outline-none focus:border-violet"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddModule(s.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-white hover:bg-violet-hover"
                          >
                            <Plus className="h-4 w-4" /> Add Module
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Resources tab ── */}
                    {tab === "resources" && (
                      <div className="space-y-4">
                        {mods.length === 0 && (
                          <EmptyState
                            icon={Link2}
                            title="No modules"
                            description="Add modules first, then attach resources to them."
                          />
                        )}
                        {mods.map((mod) => {
                          const res = moduleResources(mod.id);
                          return (
                            <div key={mod.id}>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {mod.name}
                              </div>
                              {res.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic pl-1 mb-2">
                                  No resources yet.
                                </div>
                              ) : (
                                <div className="space-y-1.5 mb-2">
                                  {res.map((r) => {
                                    const Icon = RESOURCE_ICONS[r.type];
                                    return (
                                      <div
                                        key={r.id}
                                        className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2"
                                      >
                                        <span
                                          className={cn(
                                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs",
                                            RESOURCE_COLORS[r.type],
                                          )}
                                        >
                                          <Icon className="h-3.5 w-3.5" />
                                        </span>
                                        <span className="flex-1 text-xs font-medium text-foreground truncate">
                                          {r.name}
                                        </span>
                                        {r.url && (
                                          <a
                                            href={r.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-violet hover:underline font-medium"
                                          >
                                            open
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => removeResource(r.id)}
                                          className="text-muted-foreground hover:text-destructive"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {newRes.moduleId === mod.id ? (
                                <div className="rounded-xl border border-violet/20 bg-violet/5 p-3 space-y-2">
                                  <input
                                    value={newRes.name}
                                    onChange={(e) =>
                                      setNewRes((p) => ({ ...p, name: e.target.value }))
                                    }
                                    placeholder="Resource name"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <select
                                      value={newRes.type}
                                      onChange={(e) =>
                                        setNewRes((p) => ({
                                          ...p,
                                          type: e.target.value as ResourceType,
                                        }))
                                      }
                                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                                    >
                                      <option value="link">Link</option>
                                      <option value="pdf">PDF</option>
                                      <option value="pptx">PPTX</option>
                                      <option value="docx">DOCX</option>
                                      <option value="video">Video</option>
                                    </select>
                                    <input
                                      value={newRes.url}
                                      onChange={(e) =>
                                        setNewRes((p) => ({ ...p, url: e.target.value }))
                                      }
                                      placeholder="URL (optional)"
                                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={handleAddResource}
                                      className="flex items-center gap-1 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-hover"
                                    >
                                      <Check className="h-3.5 w-3.5" /> Add Resource
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNewRes({
                                          moduleId: null,
                                          name: "",
                                          type: "link",
                                          url: "",
                                        })
                                      }
                                      className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setNewRes((p) => ({ ...p, moduleId: mod.id }))}
                                  className="flex items-center gap-1 text-xs text-violet hover:underline font-medium"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add resource
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Students tab ── */}
                    {tab === "students" && (
                      <div className="space-y-2">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {enrolled.length} student{enrolled.length !== 1 ? "s" : ""} enrolled
                          </span>
                        </div>
                        {studentUsers.map((u) => {
                          const isEnrolled = s.enrolledStudentIds?.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              className={cn(
                                "flex items-center justify-between rounded-xl border px-4 py-3 transition",
                                isEnrolled
                                  ? "border-violet/20 bg-violet/5"
                                  : "border-border bg-muted/20",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
                                  {u.name
                                    .split(" ")
                                    .map((w) => w[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    <span>{u.name}</span>
                                    {u.studentId && (
                                      <span className="font-mono text-[10px] text-violet font-bold">
                                        [{u.studentId}]
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{u.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {isEnrolled && <Pill tone="indigo">Enrolled</Pill>}
                                <button
                                  type="button"
                                  onClick={() =>
                                    s.enrolledStudentIds?.includes(u.id)
                                      ? unenrollStudent(s.id, u.id)
                                      : enrollStudent(s.id, u.id)
                                  }
                                  className={cn(
                                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                                    isEnrolled
                                      ? "border border-rose-300 text-rose-600 hover:bg-rose-50"
                                      : "border border-violet/30 text-violet hover:bg-violet/10",
                                  )}
                                >
                                  {isEnrolled ? "Remove" : "Enroll"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
