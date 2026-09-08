import { CONTRACT_ONLY_COUNTRIES } from "@/services/searchCriteria";
import type { Country, Job, JobFilters } from "@/types/job";

const CONTRACT_ONLY_SET = new Set<Country>(CONTRACT_ONLY_COUNTRIES);


/** Central European Time (handles CET/CEST automatically). */
const TIME_ZONE = "Europe/Zurich";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  });
}

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function relativeDays(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

export function filterJobs(jobs: Job[], filters: JobFilters, query: string): Job[] {
  const q = query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (daysSince(job.publication_date) > filters.max_age_days) return false;
    if (job.match_score < filters.min_match_score) return false;
    if (filters.roles.length && !filters.roles.includes(job.role_category)) return false;
    if (filters.countries.length && !filters.countries.includes(job.country)) return false;
    if (filters.contract_types.length && !filters.contract_types.includes(job.contract_type))
      return false;
    if (filters.work_models.length && !filters.work_models.includes(job.work_model)) return false;
    if (q) {
      const haystack = [
        job.title,
        job.company,
        job.city,
        job.country,
        job.role_title_group,
        job.role_category,
        job.contract_type,
        job.work_model,
        job.duration ?? "",
        job.source,
        job.recommendation,
        job.status,
        job.match_summary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function isQualifying(job: Job): boolean {
  return (
    daysSince(job.publication_date) <= 15 &&
    !job.language.local_language_required &&
    job.match_score >= 60
  );
}

export function isNewSince(job: Job, lastVisit: string | null): boolean {
  if (!lastVisit) return daysSince(job.date_added) === 0;
  return new Date(job.date_added).getTime() > new Date(lastVisit).getTime();
}