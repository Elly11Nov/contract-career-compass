import type { Job, JobStatus } from "@/types/job";
import { JobCard } from "./JobCard";

interface SavedJobsProps {
  jobs: Job[];
  emptyMessage: string;
  onOpen: (job: Job) => void;
  onStatusChange: (id: string, status: JobStatus) => void;
  isNew?: (job: Job) => boolean;
}

export function SavedJobs({
  jobs,
  emptyMessage,
  onOpen,
  onStatusChange,
  isNew,
}: SavedJobsProps) {
  if (jobs.length === 0) {
    return (
      <div className="bg-card border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onOpen={onOpen}
          onStatusChange={onStatusChange}
          isNew={isNew?.(job)}
        />
      ))}
    </div>
  );
}