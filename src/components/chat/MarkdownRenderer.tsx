import React, { useState, useMemo } from "react";
import katex from "katex";
import { Copy, Check, Info, Lightbulb, AlertTriangle, BookOpen, Terminal, Sparkles } from "lucide-react";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { ChartRenderer, type ChartSpec } from "@/components/chat/ChartRenderer";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCitationClick?: (index: number) => void;
}

// ── Code Block with Copy ────────────────────────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border/80 bg-zinc-950 shadow-md">
      <div className="flex items-center justify-between border-b border-border/40 bg-zinc-900/90 px-4 py-1.5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-violet-400">
          <Terminal className="h-3.5 w-3.5" />
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs text-zinc-200 leading-relaxed">
        <pre className="selection:bg-violet-900 selection:text-white">{code}</pre>
      </div>
    </div>
  );
}

// ── Safe LaTeX Math Renderer ────────────────────────────────────────────────────
function MathBlock({ tex, displayMode = false }: { tex: string; displayMode?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode,
        throwOnError: false,
        output: "htmlAndMathml",
      });
    } catch {
      return tex;
    }
  }, [tex, displayMode]);

  if (displayMode) {
    return (
      <div
        className="my-3 overflow-x-auto rounded-xl border border-violet/20 bg-violet/5 py-3 px-4 text-center font-serif shadow-xs"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className="inline-block px-1 font-serif text-violet font-medium align-middle"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Main Markdown Renderer ──────────────────────────────────────────────────────
export function MarkdownRenderer({ content, className = "", onCitationClick }: MarkdownRendererProps) {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Process fences (Code blocks, Mermaid diagrams, and Charts)
    const blocks: React.ReactNode[] = [];
    const lines = content.split("\n");
    let inFence = false;
    let fenceLang = "";
    let fenceBuffer: string[] = [];
    let textBuffer: string[] = [];

    const flushTextBuffer = () => {
      if (textBuffer.length > 0) {
        const textChunk = textBuffer.join("\n");
        blocks.push(renderTextAndTables(textChunk, blocks.length, onCitationClick));
        textBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for code fence start/end
      const fenceMatch = line.match(/^```([a-zA-Z0-9_\-:]*)/);
      if (fenceMatch && !inFence) {
        flushTextBuffer();
        inFence = true;
        fenceLang = (fenceMatch[1] || "").toLowerCase().trim();
        fenceBuffer = [];
        continue;
      } else if (line.trim() === "```" && inFence) {
        inFence = false;
        const code = fenceBuffer.join("\n");

        if (fenceLang === "mermaid") {
          blocks.push(<MermaidRenderer key={`mermaid-${blocks.length}`} chart={code} />);
        } else if (fenceLang === "chart" || fenceLang === "json:chart") {
          try {
            const spec = JSON.parse(code) as ChartSpec;
            blocks.push(<ChartRenderer key={`chart-${blocks.length}`} spec={spec} />);
          } catch {
            blocks.push(<CodeBlock key={`code-${blocks.length}`} code={code} language="json (chart error)" />);
          }
        } else {
          blocks.push(<CodeBlock key={`code-${blocks.length}`} code={code} language={fenceLang || "code"} />);
        }
        fenceBuffer = [];
        continue;
      }

      if (inFence) {
        fenceBuffer.push(line);
      } else {
        textBuffer.push(line);
      }
    }

    if (inFence && fenceBuffer.length > 0) {
      blocks.push(
        <CodeBlock key={`code-unterminated-${blocks.length}`} code={fenceBuffer.join("\n")} language={fenceLang} />
      );
    }
    flushTextBuffer();

    return blocks;
  }, [content, onCitationClick]);

  return <div className={`space-y-2 leading-relaxed text-foreground ${className}`}>{renderedElements}</div>;
}

// ── Text, Headings, Lists, Tables, Blockquotes & Math ────────────────────────────
function renderTextAndTables(
  rawText: string,
  keyOffset: number,
  onCitationClick?: (index: number) => void
): React.ReactNode {
  // Split on double newlines for paragraph structures
  const paragraphs = rawText.split(/\n{2,}/);

  return (
    <div key={`section-${keyOffset}`} className="space-y-3">
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Check if paragraph is a LaTeX block: $$...$$
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
          const tex = trimmed.slice(2, -2);
          return <MathBlock key={`math-${pIdx}`} tex={tex} displayMode={true} />;
        }

        // Check for Headings
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={`h3-${pIdx}`} className="text-base font-bold text-foreground mt-4 mb-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-violet shrink-0" />
              {renderInline(trimmed.slice(4), onCitationClick)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={`h2-${pIdx}`} className="text-lg font-bold text-foreground mt-5 mb-2 border-b border-border/40 pb-1">
              {renderInline(trimmed.slice(3), onCitationClick)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={`h1-${pIdx}`} className="text-xl font-extrabold text-foreground mt-6 mb-2">
              {renderInline(trimmed.slice(2), onCitationClick)}
            </h2>
          );
        }

        // Check for Markdown Table
        if (trimmed.includes("|") && trimmed.split("\n").length >= 2) {
          const tableLines = trimmed.split("\n").filter((l) => l.trim().startsWith("|"));
          if (tableLines.length >= 2) {
            return renderTable(tableLines, pIdx, onCitationClick);
          }
        }

        // Check for Blockquote / Callout
        if (trimmed.startsWith(">")) {
          return renderCallout(trimmed, pIdx, onCitationClick);
        }

        // Check for Lists
        const lines = trimmed.split("\n");
        const isBulletList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

        if (isBulletList) {
          return (
            <ul key={`ul-${pIdx}`} className="space-y-1.5 my-2 pl-2">
              {lines.map((l, lIdx) => {
                const itemText = l.replace(/^\s*[-*]\s+/, "");
                return (
                  <li key={`li-${lIdx}`} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                    <span>{renderInline(itemText, onCitationClick)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol key={`ol-${pIdx}`} className="space-y-1.5 my-2 pl-2">
              {lines.map((l, lIdx) => {
                const numMatch = l.match(/^\s*(\d+)\.\s+(.*)/);
                const num = numMatch ? numMatch[1] : `${lIdx + 1}`;
                const itemText = numMatch ? numMatch[2] : l;
                return (
                  <li key={`oli-${lIdx}`} className="flex items-start gap-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet/10 text-[11px] font-bold text-violet mt-0.5">
                      {num}
                    </span>
                    <span className="flex-1">{renderInline(itemText, onCitationClick)}</span>
                  </li>
                );
              })}
            </ol>
          );
        }

        // Standard Paragraph
        return (
          <p key={`p-${pIdx}`} className="text-sm leading-relaxed text-foreground/95">
            {renderInline(trimmed, onCitationClick)}
          </p>
        );
      })}
    </div>
  );
}

// ── Markdown Table Component ────────────────────────────────────────────────────
function renderTable(lines: string[], key: number, onCitationClick?: (index: number) => void) {
  const parseRow = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headerCells = parseRow(lines[0]);
  const dataRows = lines.slice(2).map(parseRow);

  return (
    <div key={`table-wrapper-${key}`} className="my-3 overflow-x-auto rounded-xl border border-border shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-muted/70 text-foreground font-semibold">
          <tr>
            {headerCells.map((h, i) => (
              <th key={`th-${i}`} className="border-b border-border px-3 py-2.5">
                {renderInline(h, onCitationClick)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 bg-card/60">
          {dataRows.map((row, rIdx) => (
            <tr key={`tr-${rIdx}`} className="hover:bg-muted/30 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={`td-${cIdx}`} className="px-3 py-2 text-foreground/90 whitespace-normal">
                  {renderInline(cell, onCitationClick)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Callouts & Blockquotes ──────────────────────────────────────────────────────
function renderCallout(raw: string, key: number, onCitationClick?: (index: number) => void) {
  const cleanLines = raw
    .split("\n")
    .map((l) => l.replace(/^>\s?/, ""))
    .join("\n")
    .trim();

  let type: "note" | "tip" | "warning" | "default" = "default";
  let content = cleanLines;

  if (cleanLines.startsWith("[!NOTE]") || cleanLines.startsWith("[!INFO]")) {
    type = "note";
    content = cleanLines.replace(/^\[!(?:NOTE|INFO)\]\s*/i, "");
  } else if (cleanLines.startsWith("[!TIP]")) {
    type = "tip";
    content = cleanLines.replace(/^\[!TIP\]\s*/i, "");
  } else if (cleanLines.startsWith("[!WARNING]") || cleanLines.startsWith("[!CAUTION]")) {
    type = "warning";
    content = cleanLines.replace(/^\[!(?:WARNING|CAUTION)\]\s*/i, "");
  }

  const icons = {
    note: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
    tip: <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
    default: <BookOpen className="h-4 w-4 text-violet shrink-0" />,
  };

  const borders = {
    note: "border-blue-500/40 bg-blue-500/5",
    tip: "border-emerald-500/40 bg-emerald-500/5",
    warning: "border-amber-500/40 bg-amber-500/5",
    default: "border-violet/40 bg-violet/5",
  };

  return (
    <div key={`callout-${key}`} className={`my-3 flex items-start gap-3 rounded-xl border-l-4 p-3.5 text-xs shadow-xs ${borders[type]}`}>
      {icons[type]}
      <div className="flex-1 space-y-1 text-foreground/90 leading-relaxed">
        {renderInline(content, onCitationClick)}
      </div>
    </div>
  );
}

// ── Inline Elements: LaTeX, Bold, Code, Citations, Links ────────────────────────
function renderInline(text: string, onCitationClick?: (index: number) => void): React.ReactNode {
  if (!text) return null;

  // Split on:
  // 1. Math: $[^$]+$
  // 2. Inline Code: `[^`]+`
  // 3. Citations: \[\d+(?:,\s*\d+)*\]
  // 4. Bold: \*\*[^*]+\*\*
  // 5. Italic: \*[^*]+\*
  // 6. Links: \[([^\]]+)\]\(([^)]+)\)
  const regex = /(\$[^$]+\$|`[^`]+`|\[\d+(?:,\s*\d+)*\]|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline LaTeX: $...$
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      return <MathBlock key={`inline-math-${i}`} tex={part.slice(1, -1)} displayMode={false} />;
    }

    // Inline Code: `...`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={`code-chip-${i}`}
          className="rounded-md border border-violet/20 bg-muted/80 px-1.5 py-0.5 font-mono text-[12px] text-violet font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Citation badge: [1] or [1, 2]
    const citeMatch = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (citeMatch) {
      const numbers = citeMatch[1].split(",").map((n) => parseInt(n.trim(), 10));
      return (
        <span key={`cite-${i}`} className="inline-flex items-center gap-0.5 align-super text-[10px] ml-0.5">
          {numbers.map((num) => (
            <button
              key={`num-${num}`}
              type="button"
              onClick={() => onCitationClick?.(num)}
              title={`View Source [${num}]`}
              className="inline-flex items-center justify-center rounded bg-violet/15 px-1 py-0.2 font-mono font-bold text-violet hover:bg-violet hover:text-white transition-colors cursor-pointer"
            >
              [{num}]
            </button>
          ))}
        </span>
      );
    }

    // Bold: **...**
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`bold-${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *...*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={`italic-${i}`} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = linkMatch[2];
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith("#");
      return (
        <a
          key={`link-${i}`}
          href={isSafe ? href : "#"}
          target={isSafe && !href.startsWith("#") ? "_blank" : undefined}
          rel="noopener noreferrer"
          className="font-medium text-violet underline underline-offset-2 hover:text-violet/80"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={`text-${i}`}>{part}</React.Fragment>;
  });
}
