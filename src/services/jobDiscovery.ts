import { BUSINESS_ANALYSIS_TITLES, MAX_AGE_DAYS, SEARCH_COUNTRIES, SEARCH_SITES, TECHNICAL_WRITING_TITLES } from "./searchCriteria";

export const DEFAULT_MAX_QUERIES = 40;
export const DEFAULT_RESULTS_PER_QUERY = 5;
export type BuiltQuery = { query: string; country: string };

/** Zurich calendar day: stable within a day, independent of server timezone. */
export function discoveryDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return Math.floor(Date.parse(`${value("year")}-${value("month")}-${value("day")}T00:00:00Z`) / 86_400_000);
}

/** Alternate families for each country before moving to another coverage round. */
export function buildQueries(now = new Date()): BuiltQuery[] {
  const day = discoveryDay(now);
  const after = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const families = [
    ["Technical Writer", "Lead Technical Writer", "Documentation Specialist"],
    ["Requirements Engineer", "Business Analyst"],
  ];
  const expanded = [TECHNICAL_WRITING_TITLES, BUSINESS_ANALYSIS_TITLES];
  const queries: BuiltQuery[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 2 * Math.max(...expanded.map((titles) => titles.length)); round += 1) {
    for (let offset = 0; offset < SEARCH_COUNTRIES.length; offset += 1) {
      const country = SEARCH_COUNTRIES[(offset + day) % SEARCH_COUNTRIES.length];
      if (!country) continue;
      for (let slot = 0; slot < 2; slot += 1) {
        const family = (slot + day) % 2;
        const titles = round < 2 ? families[family] : expanded[family];
        if (!titles?.length) continue;
        const title = titles[(day + SEARCH_COUNTRIES.indexOf(country) + Math.floor(round / 2)) % titles.length];
        const sites = SEARCH_SITES[country];
        const useBoards = (round + day) % 2 === 1 && sites.length > 0;
        const employment = country === "Switzerland"
          ? "contract OR freelance OR interim OR permanent"
          : "contract OR freelance OR interim";
        const query = useBoards
          ? `"${title}" (${sites.map((site) => `site:${site}`).join(" OR ")}) after:${after}`
          : `"${title}" job vacancy ${country} (${employment}) after:${after}`;
        if (seen.has(query)) continue;
        seen.add(query);
        queries.push({ query, country });
      }
    }
  }
  return queries;
}