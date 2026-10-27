import { useEffect, useState } from "react";
import { Calendar, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Clean Academic Dashboard Hero: "Welcome Back, [name]"
 * Distraction-free, trustworthy, high-contrast.
 */
export function WelcomeHero({
  name,
  subtitle,
  tabs,
  activeTab,
  onTab,
}: {
  name: string;
  subtitle: string;
  tabs?: { id: string; label: string; icon?: React.ElementType }[];
  activeTab?: string;
  onTab?: (id: string) => void;
  note?: string[];
  tagline?: string[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
            <GraduationCap className="h-4 w-4" />
            <span>Academic Workspace</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Welcome Back, <span className="text-blue-700">{name}</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            {subtitle}
          </p>

          {tabs && (
            <div className="seg mt-4 max-w-full overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={activeTab === t.id}
                  onClick={() => onTab?.(t.id)}
                  className={cn(activeTab === t.id && "on")}
                >
                  {t.icon && <t.icon className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clean Date Card */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100/60 text-blue-700">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[11px] font-semibold text-slate-400">
              {now ? now.toLocaleDateString("en-US", { weekday: "long" }) : "\u00A0"}
            </div>
            <div className="text-sm font-bold text-slate-900">
              {now ? now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u00A0"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
