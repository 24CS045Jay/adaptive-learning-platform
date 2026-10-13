import { useState } from "react";
import {
  Lightbulb,
  Maximize2,
  FileQuestion,
  Layers,
  ArrowRightLeft,
  BookOpen,
  Copy,
  Check,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface EducationalActionsProps {
  onAction: (promptText: string) => void;
  onCopyAnswer: () => void;
  onRetry?: () => void;
  isAiMessage?: boolean;
}

export function EducationalActions({
  onAction,
  onCopyAnswer,
  onRetry,
  isAiMessage = true,
}: EducationalActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyAnswer();
    setCopied(true);
    toast.success("Answer copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAiMessage) return null;

  const quickActions = [
    { label: "Explain more simply", icon: Lightbulb, prompt: "Could you please explain this more simply with an intuitive real-world analogy?" },
    { label: "Step-by-step breakdown", icon: Layers, prompt: "Break down this concept step-by-step in numbered detail." },
    { label: "Give another example", icon: Sparkles, prompt: "Give me another clear practical example illustrating this concept." },
    { label: "Explain in more detail", icon: Maximize2, prompt: "Explain this in more rigorous detail, including technical nuances and limitations." },
    { label: "Generate mini quiz", icon: FileQuestion, prompt: "Create a 3-question practice quiz on this topic with answer keys." },
    { label: "Summarize answer", icon: BookOpen, prompt: "Summarize the key takeaways of this answer into 3 quick bullet points." },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
      <div className="flex items-center gap-1 mr-1">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Copy full answer text"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy Answer"}</span>
        </button>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Retry explanation"
          >
            <RotateCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onAction(action.prompt)}
              className="inline-flex items-center gap-1 rounded-lg border border-violet/20 bg-violet/5 px-2 py-1 text-[11px] font-medium text-violet hover:bg-violet/15 hover:border-violet/40 transition-all cursor-pointer"
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
