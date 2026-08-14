/**
 * Job search service (Phase 3A).
 *
 * Orchestrates the search engine and persistence. All database work is
 * delegated to jobService — this service never talks to the database directly.
 */
import { createJob, createSearchRun, getJobs } from "./jobService";
import { searchJobCandidates } from "./jobSearch.functions";
import { MAX_AGE_DAYS, SEARCH_CRITERIA } from "./searchCriteria";
import type {
  CandidateJob,
  JobSearchRunSummary,
  SearchEngineResult,
} from "./jobSearch.types";
import type { CandidateDiagnostic } from "./jobSearch.types";
import type { Job } from "@/types/job";

export type RunJobSearchResult =
  | ({
      ok: true;
      queries: string[];
      examined: number;
      diagnostics?: CandidateDiagnostic[];
    } & JobSearchRunSummary)
  | { ok: false; error: string; provider_missing: boolean };

/** Search the web for candidate vacancies (verification + scoring happen server-side). */
export async function searchJobs(options?: {
  maxQueries?: number;
  resultsPerQuery?: number;
}): Promise<SearchEngineResult> {
  const response = await searchJobCandidates({ data: options ?? {} });
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

const PLACEHOLDER_HOSTS = ["example.com", "example.org", "example.net", "localhost"];

/** Structural guard so no placeholder/mock URL can ever be persisted. */
function hasRealVacancyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return false;
    if (PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    return parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

/** Client-side re-check of the hard criteria before anything is stored. */
export function verifyJob(job: CandidateJob): boolean {
  if (!job.title || !job.company || !job.url) return false;
  if (!hasRealVacancyUrl(job.url)) return false;
  if (!SEARCH_CRITERIA.countries.includes(job.country)) return false;
  if (!SEARCH_CRITERIA.contract_types.includes(job.contract_type)) return false;
  const published = Date.parse(job.publication_date);
  if (Number.isNaN(published)) return false;
  const ageDays = (Date.now() - published) / 86_400_000;
  if (ageDays < 0 || ageDays > MAX_AGE_DAYS) return false;
  if (job.language?.local_language_required) return false;
  return job.language?.english_required !== false;
}

/** The engine scores server-side; this keeps the score/recommendation consistent. */
export function scoreJob(job: CandidateJob): CandidateJob {
  const score = Math.max(0, Math.min(100, Math.round(job.match_score)));
  const recommendation =
    score >= 80 ? "Apply" : score >= 60 ? "Maybe" : "Don't apply";
  return { ...job, match_score: score, recommendation };
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function identityKey(job: { company: string; title: string; city: string; country: string }) {
  return `${job.company}|${job.title}|${job.city}|${job.country}`.toLowerCase().trim();
}

/** Persist qualifying jobs via jobService, skipping duplicates. */
export async function saveJobs(
  candidates: CandidateJob[],
): Promise<{ added: Job[]; duplicates: number }> {
  const existing = await getJobs();
  const existingUrls = new Set(existing.map((j) => normalizeUrl(j.url)));
  const existingKeys = new Set(existing.map(identityKey));

  const added: Job[] = [];
  let duplicates = 0;

  for (const candidate of candidates) {
    const url = normalizeUrl(candidate.url);
    const key = identityKey(candidate);
    if (existingUrls.has(url) || existingKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    existingUrls.add(url);
    existingKeys.add(key);

    const created = await createJob({
      ...candidate,
      status: "New",
    } as Partial<Job>);
    if (created) added.push(created);
  }

  return { added, duplicates };
}

/** Full run: search -> verify -> score -> save -> record the search run. */
export async function runJobSearch(options?: {
  maxQueries?: number;
  resultsPerQuery?: number;
}): Promise<RunJobSearchResult> {
  const response = await searchJobCandidates({ data: options ?? {} });
  if (!response.ok) {
    return {
      ok: false,
      error: response.error,
      provider_missing: response.provider_missing === true,
    };
  }

  const { jobs, examined, queries, diagnostics } = response.result;
  const qualifying = jobs.filter(verifyJob).map(scoreJob);
  const { added, duplicates } = await saveJobs(qualifying);

  await createSearchRun({
    search_criteria: SEARCH_CRITERIA,
    jobs_found: qualifying.length,
    jobs_added: added.length,
    jobs_removed: examined - qualifying.length,
  });

  return {
    ok: true,
    queries,
    examined,
    jobs_found: qualifying.length,
    jobs_added: added.length,
    jobs_removed: examined - qualifying.length,
    duplicates,
    ...(diagnostics ? { diagnostics } : {}),
  };
}

export const jobSearchService = {
  searchJobs,
  verifyJob,
  scoreJob,
  saveJobs,
  runJobSearch,
};
