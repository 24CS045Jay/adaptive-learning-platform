import { Moon, Sun } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

/** Gradient graduation-cap mark used in the logo lockup. */
export function CapMark({ className }: { className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 56" className={cn("h-9 w-9 drop-shadow-[0_6px_10px_rgba(99,70,240,.45)]", className)} aria-hidden>
      <defs>
        <linearGradient id={`${gid}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f7cff" />
          <stop offset="1" stopColor="#5b3fe0" />
        </linearGradient>
        <linearGradient id={`${gid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e56f5" />
          <stop offset="1" stopColor="#4b30cf" />
        </linearGradient>
      </defs>
      <path d="M32 4 2 18l30 14 30-14z" fill={`url(#${gid}a)`} />
      <path d="M14 27v12c0 5 8 10 18 10s18-5 18-10V27L32 35z" fill={`url(#${gid}b)`} />
      <path d="M32 18 55 28v14" stroke="#c4b5fd" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="55" cy="44" r="3" fill="#a78bfa" />
    </svg>
  );
}

export function Logo({
  subtitle = "Smart Study Assistant",
  size = "md",
  className,
}: {
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = size === "lg" ? "text-[1.7rem]" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CapMark className={size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-10 w-10"} />
      <div className="leading-tight">
        <div className={cn("font-extrabold tracking-tight text-foreground", t)}>
          AI <span className="text-violet">Tutor</span>
        </div>
        {subtitle && <div className="text-[11px] font-medium text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

/** Floating AI robot mascot cut from the design reference. */
export function Mascot({ className, bob = true }: { className?: string; bob?: boolean }) {
  return (
    <img
      src="/assets/ui/robot.png"
      alt=""
      draggable={false}
      className={cn("select-none drop-shadow-[0_10px_24px_rgba(99,102,241,.45)]", bob && "bob", className)}
    />
  );
}

export function Sparkle({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("twinkle absolute h-4 w-4 text-white", className)} style={{ animationDelay: `${delay}s` }} aria-hidden>
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="currentColor" />
    </svg>
  );
}

/** Sun | Moon capsule toggle — matches the reference top-right control. */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, toggle } = useTheme();
  return (
    <div className={cn("theme-capsule", className)} role="group" aria-label="Theme">
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={!isDark}
        onClick={() => isDark && toggle()}
        className={cn(!isDark && "sun-on")}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={isDark}
        onClick={() => !isDark && toggle()}
        className={cn(isDark && "on")}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
