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
  diagnostics?: CandidateDiagnostic[];
}

/** Diagnostics-only classification of a role family, derived from the ad title. */
export type RoleFamily = "documentation" | "requirements_analysis" | "other";

export type RejectionReason =
  | "qualified"
  | "not_a_vacancy_url"
  | "page_not_openable"
  | "extraction_failed"
  | "permanent_role"
  | "local_language_required"
  | "publication_date_out_of_range"
  | "country_out_of_scope"
  | "role_not_relevant"
  | "url_not_verified"
  | "other";

export interface CandidateDiagnostic {
  url: string;
  title: string;
  role_family: RoleFamily;
  reason: RejectionReason;
  detail?: string;
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
