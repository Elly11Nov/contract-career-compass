import type { Job } from "@/types/job";
import { formatDateTime } from "@/lib/job-utils";

interface DashboardStatsProps {
  lastUpdated: string;
  newCount: number;
  qualifyingCount: number;
  technicalWriterCount: number;
  businessAnalystCount: number;
  countries: Job["country"][];
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border-border rounded-lg border p-4 shadow-sm">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

export function DashboardStats({
  lastUpdated,
  newCount,
  qualifyingCount,
  technicalWriterCount,
  businessAnalystCount,
  countries,
}: DashboardStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Stat label="Last updated" value={formatDateTime(lastUpdated)} hint="Automated search run" />
      <Stat label="New jobs" value={String(newCount)} hint="Since your last visit" />
      <Stat label="Qualifying jobs" value={String(qualifyingCount)} hint="Last 15 days, English" />
      <Stat label="Technical Writer" value={String(technicalWriterCount)} />
      <Stat label="Business Analyst" value={String(businessAnalystCount)} />
      <Stat
        label="Countries"
        value={String(countries.length)}
        hint={countries.join(", ") || "None"}
      />
    </div>
  );
}