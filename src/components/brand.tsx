import { Moon, Sun } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

/** Official EduSense AI Brand Emblem */
export function EduSenseMark({
  className,
  size = "md",
  src = "/assets/edusense-emblem.svg",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  src?: string;
}) {
  const sizeClass = {
    xs: "h-7 w-7",
    sm: "h-9 w-9",
    md: "h-11 w-11",
    lg: "h-14 w-14",
    xl: "h-20 w-20",
  }[size];

  return (
    <img
      src={src}
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src.endsWith(".svg")) {
          target.src = "/assets/edusense-logo.png";
        }
      }}
      alt="EduSense AI"
      draggable={false}
      className={cn(
        "object-contain select-none transition-transform hover:scale-105 duration-200",
        sizeClass,
        className,
      )}
    />
  );
}

/** Legacy alias for backwards compatibility */
export const CapMark = EduSenseMark;

export function Logo({
  subtitle = "Learn Smarter. Adapt Faster. Achieve More.",
  size = "md",
  showSubtitle = true,
  className,
}: {
  subtitle?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  className?: string;
}) {
  const titleSize = {
    xs: "text-base font-bold",
    sm: "text-lg font-bold",
    md: "text-xl font-extrabold",
    lg: "text-2xl font-black",
    xl: "text-3xl font-black",
  }[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <EduSenseMark size={size} />
      <div className="leading-tight">
        <div className={cn("tracking-tight flex items-center gap-1 text-foreground", titleSize)}>
          <span className="text-slate-900 dark:text-white">EduSense</span>
          <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 bg-clip-text text-transparent">AI</span>
        </div>
        {showSubtitle && subtitle && (
          <div className="text-[10.5px] font-medium tracking-tight text-muted-foreground line-clamp-1">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

/** Official EduSense AI Horizontal Logo with White Background */
export function EduSenseHorizontalLogo({
  className,
  height = "h-10",
  alt = "EduSense AI — Adaptive Intelligence Platform",
}: {
  className?: string;
  height?: string;
  alt?: string;
}) {
  return (
    <img
      src="/assets/edusense-logo-horizontal-dark.svg"
      alt={alt}
      draggable={false}
      className={cn("w-auto object-contain select-none transition-transform hover:scale-[1.02] duration-200", height, className)}
    />
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
