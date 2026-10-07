import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/brand";

/**
 * Dashboard hero: "Welcome Back, name!" + optional tab pills, mascot art and date card.
 */
export function WelcomeHero({
  name,
  subtitle,
  tabs,
  activeTab,
  onTab,
  note = ["Manage", "Guide", "Empower"],
  tagline = ["Keep building", "smarter education", "with AI!"],
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
    <div className="relative mb-7 grid items-end gap-4 xl:grid-cols-[1fr_auto] 2xl:grid-cols-[1fr_auto_17rem]">
      <div className="relative z-10 pb-1 pt-4">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[2.5rem] font-extrabold leading-tight tracking-tight text-foreground"
        >
          Welcome Back, <span className="gradient-word">{name}!</span>
        </motion.h1>
        <p className="mt-1.5 text-[0.98rem] text-muted-foreground">{subtitle}</p>

        {tabs && (
          <div className="seg mt-5 max-w-full overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} type="button" aria-pressed={activeTab === t.id} onClick={() => onTab?.(t.id)}>
                {t.icon && <t.icon className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* mascot + robot */}
      <div className="pointer-events-none relative hidden h-[13.5rem] w-[24rem] select-none xl:block">
        <div aria-hidden className="absolute -top-8 left-0 h-[15rem] w-[24rem] rounded-[4rem] bg-gradient-to-br from-violet/25 via-violet/10 to-transparent blur-2xl" />
        <div className="hand-note absolute left-0 top-3 z-10 w-24 text-[1.25rem]">
          {note.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        <img src="/assets/ui/dash-hero.png" alt="" draggable={false} className="absolute bottom-0 left-[6.2rem] h-[13rem] w-auto drop-shadow-[0_14px_20px_rgba(76,56,190,.3)]" />
        <div className="absolute right-0 top-1 w-[6.6rem]">
          <img src="/assets/ui/robot.png" alt="" draggable={false} className="bob w-full drop-shadow-[0_10px_20px_rgba(99,102,241,.5)]" />
          <Sparkle className="-right-1 top-0 h-3.5 w-3.5 text-violet" />
          <Sparkle className="-left-3 top-8 h-3 w-3 text-violet" delay={1} />
        </div>
      </div>

      {/* date card */}
      <div className="glass relative z-10 hidden items-center gap-4 rounded-3xl border border-border p-5 shadow-[var(--card-shadow)] 2xl:flex">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet/12 text-violet">
          <CalendarDays className="h-7 w-7" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-sm text-muted-foreground">{now ? now.toLocaleDateString("en-US", { weekday: "long" }) : "\u00A0"}</div>
          <div className="text-xl font-extrabold text-foreground">
            {now ? now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u00A0"}
          </div>
          <div className={cn("mt-1.5 text-xs leading-snug text-muted-foreground")}>
            {tagline.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
