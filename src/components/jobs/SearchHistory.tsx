import type { SearchRun } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/job-utils";

export function SearchHistory({ runs }: { runs: SearchRun[] }) {
  return (
    <section className="bg-card border-border rounded-lg border p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Search history</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Automated runs against the saved search criteria.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-4 font-medium">Search date</th>
              <th className="py-2 pr-4 font-medium">Found</th>
              <th className="py-2 pr-4 font-medium">Added</th>
              <th className="py-2 pr-4 font-medium">Removed</th>
              <th className="py-2 font-medium">Criteria</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(run.run_date)}</td>
                <td className="py-2 pr-4 tabular-nums">{run.jobs_found}</td>
                <td className="text-success py-2 pr-4 tabular-nums">+{run.jobs_added}</td>
                <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                  -{run.jobs_removed}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">{run.criteria.countries.length} countries</Badge>
                    <Badge variant="outline">{run.criteria.roles.length} role groups</Badge>
                    <Badge variant="outline">{run.criteria.contract_types.length} contract types</Badge>
                    <Badge variant="outline">{run.criteria.language}</Badge>
                    <Badge variant="outline">≤ {run.criteria.max_age_days} days</Badge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}