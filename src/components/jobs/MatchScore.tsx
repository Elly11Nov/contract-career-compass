import { matchBand } from "@/types/job";
import { cn } from "@/lib/utils";

const toneClasses: Record<string, { text: string; bg: string; ring: string }> = {
  excellent: { text: "text-score-excellent", bg: "bg-score-excellent", ring: "border-score-excellent/40" },
  strong: { text: "text-score-strong", bg: "bg-score-strong", ring: "border-score-strong/40" },
  good: { text: "text-score-good", bg: "bg-score-good", ring: "border-score-good/40" },
  possible: { text: "text-score-possible", bg: "bg-score-possible", ring: "border-score-possible/40" },
  weak: { text: "text-score-weak", bg: "bg-score-weak", ring: "border-score-weak/40" },
};

interface MatchScoreProps {
  score: number;
  size?: "sm" | "lg";
  showBar?: boolean;
  className?: string;
}

export function MatchScore({ score, size = "sm", showBar = true, className }: MatchScoreProps) {
  const band = matchBand(score);
  const tone = toneClasses[band.tone]!;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone.text,
            size === "lg" ? "text-3xl" : "text-xl",
          )}
        >
          {score}
          <span className="text-muted-foreground text-xs font-normal">/100</span>
        </span>
        <span className={cn("text-xs font-medium", tone.text)}>{band.label}</span>
      </div>
      {showBar && (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", tone.bg)} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  );
}