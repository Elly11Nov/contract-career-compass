import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchScore } from "./MatchScore";
import { StatusSelector } from "./StatusSelector";
import type { Job, JobStatus } from "@/types/job";
import { formatDate, relativeDays } from "@/lib/job-utils";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  onOpen: (job: Job) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
  isNew?: boolean;
}

const recommendationClass: Record<Job["recommendation"], string> = {
  Apply: "bg-success text-success-foreground",
  Maybe: "bg-warning text-warning-foreground",
  "Don't apply": "bg-destructive text-destructive-foreground",
};

export function JobCard({ job, onOpen, onStatusChange, isNew }: JobCardProps) {
  return (
    <article className="bg-card border-border hover:border-primary/40 flex flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(job)}
              className="hover:text-primary text-left text-base font-semibold leading-tight"
            >
              {job.title}
            </button>
            {isNew && <Badge className="bg-primary text-primary-foreground">New today</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {job.company} · {job.city}, {job.country}
          </p>
        </div>
        <MatchScore score={job.match_score} className="w-36 shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{job.contract_type}</Badge>
        <Badge variant="outline">{job.work_model}</Badge>
        {job.duration && <Badge variant="outline">{job.duration}</Badge>}
        <Badge variant="outline">{job.role_title_group}</Badge>
        <Badge
          variant="outline"
          className={cn(
            job.language.local_language_required && "border-destructive/50 text-destructive",
          )}
        >
          {job.language.local_language_required
            ? `${job.language.working_language} required`
            : "English working language"}
        </Badge>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{job.match_summary}</p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={recommendationClass[job.recommendation]}>{job.recommendation}</Badge>
          <span className="text-muted-foreground text-xs">
            Posted {formatDate(job.publication_date)} · {relativeDays(job.publication_date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelector value={job.status} onChange={(s) => onStatusChange(job.id, s)} />
          <Button variant="outline" size="sm" onClick={() => onOpen(job)}>
            Details
          </Button>
          <Button size="sm" asChild>
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              View job
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}