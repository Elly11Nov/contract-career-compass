/**
 * Job data service layer.
 *
 * This is the ONLY place the UI touches job data. All reads and writes go to
 * the Lovable Cloud database; components never talk to the database directly.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ContractType,
  Country,
  Job,
  JobLanguage,
  JobStatus,
  Recommendation,
  RoleCategory,
  SearchRun,
  WorkModel,
} from "@/types/job";

const VISIT_KEY = "cjf.last-visit.v1";
const SAVED_STATUS: JobStatus = "Interested";

const isBrowser = () => typeof window !== "undefined";

type JobRow = {
  id: string;
  title: string;
  company: string;
  country: string;
  city: string | null;
  role_category: string;
  role_title_group: string | null;
  contract_type: string;
  duration: string | null;
  work_model: string;
  publication_date: string;
  source: string | null;
  url: string | null;
  language: unknown;
  match_score: number;
  recommendation: string;
  match_summary: string | null;
  strong_matches: string[] | null;
  partial_matches: string[] | null;
  missing_requirements: string[] | null;
  transferable_experience: string[] | null;
  red_flags: string[] | null;
  status: string;
  date_added: string;
  last_verified: string;
};

const emptyLanguage: JobLanguage = {
  working_language: "English",
  english_required: true,
  local_language_required: false,
  additional_languages: [],
  assessment: "",
};

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    country: row.country as Country,
    city: row.city ?? "",
    role_category: row.role_category as RoleCategory,
    role_title_group: row.role_title_group ?? row.role_category,
    contract_type: row.contract_type as ContractType,
    duration: row.duration,
    work_model: row.work_model as WorkModel,
    publication_date: row.publication_date,
    source: row.source ?? "",
    url: row.url ?? "#",
    language: { ...emptyLanguage, ...((row.language ?? {}) as Partial<JobLanguage>) },
    match_score: row.match_score,
    recommendation: row.recommendation as Recommendation,
    match_summary: row.match_summary ?? "",
    strong_matches: row.strong_matches ?? [],
    partial_matches: row.partial_matches ?? [],
    missing_requirements: row.missing_requirements ?? [],
    transferable_experience: row.transferable_experience ?? [],
    red_flags: row.red_flags ?? [],
    status: row.status as JobStatus,
    date_added: row.date_added,
  };
}

export async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("match_score", { ascending: false });
  if (error) throw error;
  return (data as JobRow[]).map(toJob);
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toJob(data as JobRow) : null;
}

export async function createJob(job: Partial<Job>): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .insert(job as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toJob(data as JobRow) : null;
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toJob(data as JobRow) : null;
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
  return updateJob(id, { status });
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

export async function getSavedJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", SAVED_STATUS)
    .order("match_score", { ascending: false });
  if (error) throw error;
  return (data as JobRow[]).map(toJob);
}

export async function saveJob(id: string): Promise<Job | null> {
  return updateJobStatus(id, SAVED_STATUS);
}

export async function getSearchHistory(): Promise<SearchRun[]> {
  const { data, error } = await supabase
    .from("search_runs")
    .select("*")
    .order("search_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    run_date: row.search_date as string,
    jobs_found: row.jobs_found as number,
    jobs_added: row.jobs_added as number,
    jobs_removed: row.jobs_removed as number,
    criteria: (row.search_criteria ?? {}) as SearchRun["criteria"],
  }));
}

export async function createSearchRun(run: {
  search_criteria: unknown;
  jobs_found: number;
  jobs_added: number;
  jobs_removed: number;
}): Promise<void> {
  const { error } = await supabase.from("search_runs").insert(run as never);
  if (error) throw error;
}

export function getLastVisit(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(VISIT_KEY);
}

export function markVisit() {
  if (!isBrowser()) return;
  window.localStorage.setItem(VISIT_KEY, new Date().toISOString());
}

export const jobService = {
  getJobs,
  getJob,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
  getSavedJobs,
  saveJob,
  getSearchHistory,
  createSearchRun,
};
