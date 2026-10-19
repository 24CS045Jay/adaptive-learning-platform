import { useEffect, useRef, useState, useId } from "react";
import mermaid from "mermaid";
import { Maximize2, Minimize2, Copy, Check, Sparkles, RefreshCw } from "lucide-react";

// Initialize mermaid once with clean modern theme configuration
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
    primaryColor: "#7c3aed",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#9d72f7",
    lineColor: "#a78bfa",
    secondaryColor: "#3b82f6",
    tertiaryColor: "#1e1b4b",
  },
  securityLevel: "loose",
});

interface MermaidRendererProps {
  chart: string;
  className?: string;
  title?: string;
}

export function MermaidRenderer({ chart, className = "", title = "Visual Concept Diagram" }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "_");
  const idRef = useRef<string>(`mermaid_${rawId}`);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!chart?.trim()) {
        setSvgContent("");
        setError(null);
        return;
      }
      try {
        // Normalize chart text (e.g. strip markdown fences if included)
        const cleanedChart = chart.trim().replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```$/, "").trim();
        const renderId = `${idRef.current}_${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(renderId, cleanedChart);
        if (isMounted) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err: any) {
        console.warn("[MermaidRenderer] Render failed:", err?.message || err);
        // Clean up any stray error elements injected by mermaid into DOM
        try {
          const stray = document.querySelectorAll(`[id^="d${idRef.current}"]`);
          stray.forEach((el) => el.remove());
        } catch {}
        if (isMounted) {
          setError(err?.message || "Failed to render visual diagram.");
          setSvgContent("");
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(chart.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
        <div className="flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {title} (Code View)
          </span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 rounded bg-black/30 px-2 py-0.5 text-[11px] text-foreground hover:bg-black/50"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-2 overflow-x-auto rounded bg-black/20 p-2 font-mono text-[11px] text-foreground">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group relative my-3 overflow-hidden rounded-2xl border border-violet/25 bg-card p-4 shadow-sm transition-all hover:border-violet/40 ${className}`}
      >
        <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2 text-[11px] font-semibold text-violet">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {title}
          </span>
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopyCode}
              title="Copy Diagram Syntax"
              className="flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              title="Expand Diagram"
              className="flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Expand</span>
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="overflow-x-auto py-2 text-center flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-5xl w-full flex-col overflow-hidden rounded-2xl border border-violet/30 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet" />
                <h3 className="text-base font-bold text-foreground">{title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-secondary/80"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 overflow-auto p-4 flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto min-h-[300px]"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>
        </div>
      )}
    </>
  );
}
