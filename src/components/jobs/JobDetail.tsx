import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MatchScore } from "./MatchScore";
import { StatusSelector } from "./StatusSelector";
import type { Job, JobStatus } from "@/types/job";
import { formatDate, relativeDays } from "@/lib/job-utils";

interface JobDetailProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function AnalysisList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="bg-muted/50 rounded-md p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-1.5 text-sm">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {items.map((i) => (
            <li key={i} className="text-muted-foreground flex gap-2 text-sm">
              <span aria-hidden>•</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JobDetail({ job, open, onOpenChange, onStatusChange }: JobDetailProps) {
  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8 text-xl leading-tight">{job.title}</DialogTitle>
          <DialogDescription>
            {job.company} · {job.city}, {job.country}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <MatchScore score={job.match_score} size="lg" className="w-56" />
          <div className="flex items-center gap-2">
            <StatusSelector value={job.status} onChange={(s) => onStatusChange(job.id, s)} size="md" />
            <Button asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                View job
              </a>
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Job information</h3>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoRow label="Contract type" value={job.contract_type} />
            <InfoRow label="Duration" value={job.duration ?? "Not stated"} />
            <InfoRow label="Work model" value={job.work_model} />
            <InfoRow label="Role category" value={job.role_title_group} />
            <InfoRow
              label="Published"
              value={`${formatDate(job.publication_date)} (${relativeDays(job.publication_date)})`}
            />
            <InfoRow label="Source" value={job.source} />
            <InfoRow label="Status" value={job.status} />
            <InfoRow label="Recommendation" value={job.recommendation} />
          </div>
        </section>

        <Separator className="my-4" />

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Match analysis</h3>
          <p className="text-muted-foreground mt-2 text-sm">{job.match_summary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <AnalysisList title="Strong matches" items={job.strong_matches} empty="None recorded." />
            <AnalysisList title="Partial matches" items={job.partial_matches} empty="None recorded." />
            <AnalysisList
              title="Missing requirements"
              items={job.missing_requirements}
              empty="Nothing missing."
            />
            <AnalysisList
              title="Transferable experience"
              items={job.transferable_experience}
              empty="None recorded."
            />
            <AnalysisList title="Potential red flags" items={job.red_flags} empty="No red flags." />
            <div className="bg-muted/50 rounded-md p-3">
              <h4 className="text-sm font-semibold">Language assessment</h4>
              <p className="text-muted-foreground mt-1.5 text-sm">{job.language.assessment}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">Working: {job.language.working_language}</Badge>
                {job.language.additional_languages.map((l) => (
                  <Badge key={l} variant="outline">
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}