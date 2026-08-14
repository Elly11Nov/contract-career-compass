import type {
  ContractType,
  Country,
  JobLanguage,
  Recommendation,
  RoleCategory,
  WorkModel,
} from "@/types/job";

/** A verified + scored vacancy produced by the search engine (not yet stored). */
export interface CandidateJob {
  title: string;
  company: string;
  country: Country;
  city: string;
  role_category: RoleCategory;
  role_title_group: string;
  contract_type: ContractType;
  duration: string | null;
  work_model: WorkModel;
  publication_date: string;
  source: string;
  url: string;
  language: JobLanguage;
  match_score: number;
  recommendation: Recommendation;
  match_summary: string;
  strong_matches: string[];
  partial_matches: string[];
  missing_requirements: string[];
  transferable_experience: string[];
  red_flags: string[];
  last_verified: string;
}

export interface SearchEngineResult {
  jobs: CandidateJob[];
  examined: number;
  rejected: number;
  queries: string[];
}

export type SearchEngineResponse =
  | { ok: true; result: SearchEngineResult }
  | { ok: false; error: string; provider_missing?: boolean };

export interface JobSearchRunSummary {
  jobs_found: number;
  jobs_added: number;
  jobs_removed: number;
  duplicates: number;
}
