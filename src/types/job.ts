export type Country =
  | "Germany"
  | "France"
  | "Switzerland"
  | "Italy"
  | "Sweden"
  | "Denmark"
  | "Finland"
  | "Czechia"
  | "Hungary"
  | "Poland"
  | "Romania";

export type RoleCategory = "Technical Writer" | "Business Analyst" | "Related";

export type ContractType =
  | "Contract"
  | "Freelance"
  | "Fixed-term"
  | "Temporary"
  | "Project-based"
  | "Contractor"
  | "Consulting assignment"
  | "Interim"
  | "Permanent";

export type WorkModel = "Remote" | "Hybrid" | "Onsite";

export type Recommendation = "Apply" | "Maybe" | "Don't apply";

export type JobStatus =
  | "New"
  | "Interested"
  | "Applied"
  | "Interview"
  | "Rejected"
  | "Closed";

export interface JobLanguage {
  working_language: string;
  english_required: boolean;
  local_language_required: boolean;
  additional_languages: string[];
  assessment: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  country: Country;
  city: string;
  role_category: RoleCategory;
  role_title_group: string;
  contract_type: ContractType;
  duration: string | null;
  work_model: WorkModel;
  publication_date: string; // ISO date
  source: string;
  url: string;
  language: JobLanguage;
  match_score: number; // 0-100
  recommendation: Recommendation;
  match_summary: string;
  strong_matches: string[];
  partial_matches: string[];
  missing_requirements: string[];
  transferable_experience: string[];
  red_flags: string[];
  status: JobStatus;
  date_added: string; // ISO datetime
}

export interface SearchRun {
  id: string;
  run_date: string;
  jobs_found: number;
  jobs_added: number;
  jobs_removed: number;
  criteria: {
    roles: string[];
    countries: Country[];
    contract_types: ContractType[];
    language: string;
    max_age_days: number;
  };
}

export interface JobFilters {
  roles: RoleCategory[];
  countries: Country[];
  contract_types: ContractType[];
  work_models: WorkModel[];
  max_age_days: number;
  min_match_score: number;
}

export const matchBand = (score: number) => {
  if (score >= 90) return { label: "Excellent match", tone: "excellent" as const };
  if (score >= 80) return { label: "Strong match", tone: "strong" as const };
  if (score >= 70) return { label: "Good match", tone: "good" as const };
  if (score >= 60) return { label: "Possible match", tone: "possible" as const };
  return { label: "Weak match", tone: "weak" as const };
};

export const JOB_STATUSES: JobStatus[] = [
  "New",
  "Interested",
  "Applied",
  "Interview",
  "Rejected",
  "Closed",
];

export const CONTRACT_TYPES: ContractType[] = [
  "Contract",
  "Freelance",
  "Fixed-term",
  "Temporary",
  "Project-based",
  "Contractor",
  "Consulting assignment",
  "Interim",
  "Permanent",
];

export const COUNTRIES: Country[] = [
  "Germany",
  "France",
  "Switzerland",
  "Italy",
  "Sweden",
  "Denmark",
  "Finland",
  "Czechia",
  "Hungary",
  "Poland",
  "Romania",
];

export const WORK_MODELS: WorkModel[] = ["Remote", "Hybrid", "Onsite"];

export const ROLE_CATEGORIES: RoleCategory[] = [
  "Technical Writer",
  "Business Analyst",
  "Related",
];