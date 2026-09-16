import type { Country } from "@/types/job";

/** How confident we are that a relevant opportunity exists. Never a prediction of fact. */
export type RadarStatus = "High" | "Medium" | "Low";

/** Category of an early signal detected about a company. */
export type SignalCategory =
  | "Company growth"
  | "Technology change"
  | "Transformation"
  | "Organisation change"
  | "Hiring pattern";

export interface RadarSignal {
  category: SignalCategory;
  /** Short, factual description of the observed evidence. */
  description: string;
  /** Where the evidence was observed (e.g. "Company careers page"). */
  source: string;
  /** ISO date the signal was detected. */
  detected_at: string;
  /** Public URL backing the evidence, when one exists. */
  url?: string;
}

/** A relevant role family this profile could fit. */
export type PotentialRoleCategory =
  | "Business Analyst"
  | "Business Process Analyst"
  | "Requirements Engineer"
  | "Functional Analyst"
  | "Technical Writer"
  | "Documentation / Knowledge"
  | "Knowledge Engineer"
  | "Digital Transformation Analyst"
  | "AI Business / Functional Analyst"
  | "Product / Technology Analyst";

/**
 * 1. Early Jobs — an ACTUAL vacancy found on a company career site / ATS,
 * ideally before it reaches LinkedIn or the major boards.
 */
/** Where a monitored source sits: a direct employer, an agency, or a watch item. */
export type SourceCategory = "Target Employers" | "Recruiters & Staffing" | "Watchlist";

export interface EarlyJob {
  id: string;
  /** The employer/client the role is for; "Not disclosed" for undisclosed agency clients. */
  company: string;
  title: string;
  city: string;
  country: Country;
  /** Which channel the vacancy came through. */
  source_category: SourceCategory;
  /** Contract / Permanent / Temporary / Fixed-term / Interim / Unknown. */
  employment_type: string;
  /** Language requirement as stated; "Unknown" when the advertisement is unclear. */
  language_requirement: string;
  /** 0-100 relevance score behind the High/Medium/Low status. */
  relevance_score: number;
  /** Other channels the same vacancy was seen through. */
  other_sources: { source: string; url?: string }[];
  /** ISO datetime we first saw this vacancy. */
  first_detected_at: string;
  /** ISO date the company published it, when the page states one. */
  published_at: string | null;
  /** e.g. "Company careers page", "Greenhouse", "Workday". */
  source: string;
  url: string;
  relevance: RadarStatus;
  relevance_reason: string;
  matched_skills: string[];
  potential_roles: PotentialRoleCategory[];
  /** null = not seen on LinkedIn yet (as far as we know). */
  seen_on_linkedin_at: string | null;
  /** Days between company posting and LinkedIn appearance, when both are known. */
  lead_time_days: number | null;
  /** True while the record is illustrative example data, not a verified vacancy. */
  is_example: boolean;
}

/**
 * 2. Potential Upcoming Opportunities — evidence that a relevant role MAY be
 * needed soon. Not a vacancy, and never stated as a certainty.
 */
export interface PotentialOpportunity {
  id: string;
  company: string;
  country: Country;
  potential_roles: PotentialRoleCategory[];
  radar_status: RadarStatus;
  signals: RadarSignal[];
  why_relevant: string;
  matched_skills: string[];
  detected_at: string;
  is_example: boolean;
}

/** 3. Target Companies — employers worth monitoring for this profile. */
export interface TargetCompany {
  id: string;
  company: string;
  country: Country;
  industry: string;
  role_categories: PotentialRoleCategory[];
  /** Relevant roles this company has advertised in the past. */
  previous_relevant_hiring: string[];
  current_signals: string[];
  radar_status: RadarStatus;
  last_checked_at: string;
  careers_url: string | null;
  is_example: boolean;
  /** Which channel this monitored source belongs to. */
  source_category: SourceCategory;
  /** verified / site_only / unverified — never presented as more than it is. */
  verification_status: string;
  verification_note: string | null;
}

export const RADAR_STATUS_ORDER: RadarStatus[] = ["High", "Medium", "Low"];

export const radarStatusTone: Record<RadarStatus, string> = {
  High: "bg-success text-success-foreground",
  Medium: "bg-warning text-warning-foreground",
  Low: "bg-muted text-muted-foreground",
};

export const radarStatusHint: Record<RadarStatus, string> = {
  High: "Strong evidence of a relevant current or potential opportunity",
  Medium: "Some meaningful signals, but insufficient evidence",
  Low: "Weak or indirect signals — worth monitoring only",
};
