/**
 * Early Radar data service layer.
 *
 * There is no verified Early Radar data source connected yet, so these
 * functions return NOTHING rather than illustrative companies. All previous
 * example records (invented companies, hiring history, signals and
 * example.invalid careers URLs) have been removed so the page can never
 * present fabricated information as real.
 *
 * When real monitoring is added (career-page / ATS crawling via the existing
 * Firecrawl connector plus LLM relevance scoring, persisted in the database),
 * only the bodies of these functions change — the UI already reads through
 * them.
 *
 * Nothing here ever claims a vacancy will appear. Signals are evidence only.
 */
import type {
  EarlyJob,
  PotentialOpportunity,
  RadarStatus,
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

/** Real early vacancies found on company career pages / ATS. */
export async function getEarlyJobs(): Promise<EarlyJob[]> {
  const jobs: EarlyJob[] = [];
  return jobs
    .filter((j) => !j.is_example && isRealPublicUrl(j.url))
    .sort(
      (a, b) =>
        statusRank[a.relevance] - statusRank[b.relevance] ||
        b.first_detected_at.localeCompare(a.first_detected_at),
    );
}

/** Real companies showing publicly observable hiring signals. */
export async function getPotentialOpportunities(): Promise<PotentialOpportunity[]> {
  const opportunities: PotentialOpportunity[] = [];
  return opportunities
    .filter((o) => !o.is_example)
    .sort(
      (a, b) =>
        statusRank[a.radar_status] - statusRank[b.radar_status] ||
        b.detected_at.localeCompare(a.detected_at),
    );
}

/** Real employers worth monitoring for this profile. */
export async function getTargetCompanies(): Promise<TargetCompany[]> {
  const companies: TargetCompany[] = [];
  return companies
    .filter((c) => !c.is_example)
    .sort(
      (a, b) =>
        statusRank[a.radar_status] - statusRank[b.radar_status] ||
        a.company.localeCompare(b.company),
    );
}

export const radarService = {
  getEarlyJobs,
  getPotentialOpportunities,
  getTargetCompanies,
  isRealPublicUrl,
};
