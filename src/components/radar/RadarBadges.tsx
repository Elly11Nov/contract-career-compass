import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { radarStatusHint, radarStatusTone, type RadarStatus } from "@/types/radar";

export function RadarStatusBadge({
  status,
  label = "Radar",
  className,
}: {
  status: RadarStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge className={cn(radarStatusTone[status], className)} title={radarStatusHint[status]}>
      {label}: {status.toUpperCase()}
    </Badge>
  );
}

export function ExampleBadge() {
  return (
    <Badge variant="outline" className="border-warning/60 text-warning">
      Example data
    </Badge>
  );
}

export function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <Badge key={s} variant="secondary">
          {s}
        </Badge>
      ))}
    </div>
  );
}
