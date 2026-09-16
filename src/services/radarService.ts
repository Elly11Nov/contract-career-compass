/**
 * Early Radar data service layer.
 *
 * Stage 1: real vacancies only. Early Jobs and Target Companies are read from
 * the database, populated exclusively by verified scans (recruiter job pages
 * today, employer career pages later). Potential Opportunities stays empty
 * until Stage 2 signal detection exists — no speculative records are invented.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Country } from "@/types/job";
import type {
  EarlyJob,
  PotentialOpportunity,
  PotentialRoleCategory,
  RadarStatus,
  SourceCategory,
  TargetCompany,
} from "@/types/radar";

/**
 * True only for a usable, non-placeholder public http(s) link.
 * Used by the UI so a Careers page / vacancy button is never rendered for a
 * missing, relative or placeholder URL.
 */
export function isRealPublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes(".")) return false;
    const blocked = ["example.invalid", "example.com", "example.org", "example.net", "localhost"];
    return !blocked.some((b) => host === b || host.endsWith(`.${b}`));
  } catch {
    return false;
  }
}

/** Sort helper: High first, then Medium, then Low. */
const statusRank: Record<RadarStatus, number> = { High: 0, Medium: 1, Low: 2 };

function toStatus(value: string | null): RadarStatus {
  return value === "High" || value === "Medium" ? value : "Low";
}

function toCategory(value: string | null): SourceCategory {
  if (value === "Recruiter & Staffing" || value === "Recruiters & Staffing")
    return "Recruiters & Staffing";
  if (value === "Watchlist" || value === "Watchlist Employers") return "Watchlist Employers";
  if (value === "Core Target Employers") return "Core Target Employers";
  return "Target Employers";
}

function toRoleCategories(value: string | null): PotentialRoleCategory[] {
  const known: PotentialRoleCategory[] = [
    "Business Analyst",
    "Business Process Analyst",
    "Requirements Engineer",
    "Functional Analyst",
    "Technical Writer",
    "Documentation / Knowledge",
    "Knowledge Engineer",
    "Digital Transformation Analyst",
    "AI Business / Functional Analyst",
    "Product / Technology Analyst",
  ];
  if (!value) return [];
  const match = known.find((k) => k.toLowerCase() === value.toLowerCase());
  return match ? [match] : [];
}

/** Real vacancies found through monitored sources (recruiter pages, career pages). */
export async function getEarlyJobs(): Promise<EarlyJob[]> {
  const { data, error } = await supabase
    .from("radar_vacancies")
    .select("*")
    .order("first_detected_at", { ascending: false });
  if (error) throw error;

  const jobs: EarlyJob[] = (data ?? [])
    .filter((row) => isRealPublicUrl(row.url))
    .map((row) => {
      const extras = Array.isArray(row.extra_sources)
        ? (row.extra_sources as { source?: string; url?: string }[])
        : [];
      return {
        id: row.id,
        company: row.client_company,
        title: row.title,
        city: row.city ?? "Switzerland",
        country: row.country as Country,
        source_category: toCategory(row.source_category),
        employment_type: row.employment_type,
        language_requirement: row.language_requirement,
        relevance_score: row.relevance_score,
        other_sources: extras
          .filter((e) => typeof e.source === "string")
          .map((e) => ({ source: e.source as string, ...(e.url ? { url: e.url } : {}) })),
        first_detected_at: row.first_detected_at,
        published_at: row.source_published_at,
        source: row.source_name,
        url: row.url,
        relevance: toStatus(row.relevance),
        relevance_reason: row.relevance_reason ?? "",
        matched_skills: row.matched_skills ?? [],
        potential_roles: toRoleCategories(row.role_category),
        seen_on_linkedin_at: null,
        lead_time_days: null,
        is_example: false,
      };
    });

  return jobs.sort(
    (a, b) =>
      statusRank[a.relevance] - statusRank[b.relevance] ||
      b.first_detected_at.localeCompare(a.first_detected_at),
  );
}

/** Stage 2 feature — deliberately empty until real signal detection exists. */
export async function getPotentialOpportunities(): Promise<PotentialOpportunity[]> {
  return [];
}

/** Monitored sources: employers, recruitment agencies and watchlist entries. */
export async function getTargetCompanies(): Promise<TargetCompany[]> {
  const { data, error } = await supabase.from("radar_sources").select("*").order("name");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    company: row.name,
    country: row.country as Country,
    industry:
      toCategory(row.source_category) === "Recruiters & Staffing"
        ? "Recruitment / staffing agency"
        : "Employer",
    role_categories: [],
    previous_relevant_hiring: [],
    current_signals: [],
    radar_status: "Low" as RadarStatus,
    last_checked_at: row.last_checked_at ?? row.created_at,
    careers_url: row.jobs_url ?? row.site_url,
    is_example: false,
    source_category: toCategory(row.source_category),
    verification_status: row.verification_status,
    verification_note: row.verification_note,
  }));
}

export const radarService = {
  getEarlyJobs,
  getPotentialOpportunities,
  getTargetCompanies,
  isRealPublicUrl,
};
