/**
 * Server-only job search engine.
 *
 * Responsibilities:
 *  - query a web search provider (Firecrawl) for candidate vacancies
 *  - open/scrape the actual advertisement
 *  - extract + verify structured fields with an LLM (Lovable AI Gateway)
 *  - eliminate non-qualifying vacancies and score the rest
 *
 * NO database access happens here: the engine returns structured records and
 * the service layer (jobSearchService -> jobService) performs all persistence.
 */
import {
  BUSINESS_ANALYSIS_TITLES,
  CANDIDATE_PROFILE,
  MAX_AGE_DAYS,
  PRIORITY_TITLES,
  SEARCH_CONTRACT_TYPES,
  SEARCH_COUNTRIES,
  CONTRACT_ONLY_COUNTRIES,
  isPaywalledUrl,
  SEARCH_SITES,
  TECHNICAL_WRITING_TITLES,
} from "./searchCriteria";
import type { CandidateJob, SearchEngineResult } from "./jobSearch.types";
import type { CandidateDiagnostic, RejectionReason, RoleFamily } from "./jobSearch.types";

/* ------------------------------------------------------------------ */
/* Diagnostics helpers (classification only — no criteria are applied) */
/* ------------------------------------------------------------------ */

const DOC_WORDS = [
  "technical writer",
  "technical author",
  "documentation",
  "technical publications",
  "information developer",
  "information architect",
  "knowledge specialist",
  "knowledge manager",
  "knowledge engineer",
  "content engineer",
  "content specialist",
  "user assistance",
  "redakteur",
  "redaktör",
];

const BA_WORDS = [
  "requirements",
  "business analyst",
  "business analysis",
  "systems analyst",
  "system analyst",
  "functional analyst",
  "business systems analyst",
  "product analyst",
  "kravanalytiker",
  "kravhantering",
  "analyste",
];

export function classifyRoleFamily(...texts: (string | undefined)[]): RoleFamily {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  const ba = BA_WORDS.some((w) => t.includes(w));
  const doc = DOC_WORDS.some((w) => t.includes(w));
  if (ba && !doc) return "requirements_analysis";
  if (ba && doc) return "requirements_analysis";
  if (doc) return "documentation";
  return "other";
}

/** Map a free-text model rejection reason onto a diagnostic bucket. */
export function classifyRejectionReason(text: string): RejectionReason {
  const t = text.toLowerCase();
  if (/permanent|unbefristet|festanstellung|full[- ]time employment|cdi\b|tillsvidare/.test(t))
    return "permanent_role";
  if (/language|german|french|swedish|danish|finnish|deutsch|english is not/.test(t))
    return "local_language_required";
  if (/date|older than|publication|posted|stale|unknown age/.test(t))
    return "publication_date_out_of_range";
  if (/country|location|outside|not in (germany|france|switzerland|sweden|denmark|finland)/.test(t))
    return "country_out_of_scope";
  if (/search[- ]results|aggregator|listing page|not a single advert/.test(t))
    return "not_a_vacancy_url";
  if (/relevant|不|mismatch|different field|not related|profile|experience|scope of work/.test(t))
    return "role_not_relevant";
  return "other";
}

/** Which hard criterion did a model-approved candidate fail? */
function hardCriteriaReason(job: CandidateJob): RejectionReason | null {
  if (!job.title || !job.company || !job.url) return "extraction_failed";
  if (isPaywalledUrl(job.url)) return "paywalled_platform";
  if (!isPlausibleVacancyUrl(job.url)) return "not_a_vacancy_url";
  if (!SEARCH_COUNTRIES.includes(job.country)) return "country_out_of_scope";
  if (!SEARCH_CONTRACT_TYPES.includes(job.contract_type)) return "permanent_role";
  if (CONTRACT_ONLY_COUNTRIES.includes(job.country) && job.contract_type === "Permanent")
    return "permanent_role";
  const published = Date.parse(job.publication_date);
  if (Number.isNaN(published)) return "publication_date_out_of_range";
  const ageDays = (Date.now() - published) / 86_400_000;
  if (ageDays < 0 || ageDays > MAX_AGE_DAYS) return "publication_date_out_of_range";
  if (job.language?.local_language_required === true) return "local_language_required";
  if (job.language && job.language.english_required === false) return "local_language_required";
  return null;
}

const FIRECRAWL_DIRECT = "https://api.firecrawl.dev/v2";
const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

export class SearchProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchProviderNotConfiguredError";
  }
}

function firecrawlRequest(path: string, body: unknown, timeoutMs = 45_000) {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) {
    throw new SearchProviderNotConfiguredError(
      "No web-search provider is configured. Connect the Firecrawl connector so that FIRECRAWL_API_KEY is available to the server, then run the search again.",
    );
  }
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const isGatewayKey = key.startsWith("lovc_");

  if (isGatewayKey && !lovableKey) {
    throw new SearchProviderNotConfiguredError(
      "The Firecrawl connection is gateway-backed but LOVABLE_API_KEY is missing on the server.",
    );
  }

  const url = `${isGatewayKey ? FIRECRAWL_GATEWAY : FIRECRAWL_DIRECT}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isGatewayKey) {
    headers["Authorization"] = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = key;
  } else {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return fetchWithTimeout(
    url,
    { method: "POST", headers, body: JSON.stringify(body) },
    timeoutMs,
  );
}

/** ISO country codes so the provider can geo-target each query. */
const COUNTRY_CODES: Record<string, string> = {
  Germany: "DE",
  France: "FR",
  Switzerland: "CH",
  Italy: "IT",
  Sweden: "SE",
  Denmark: "DK",
  Finland: "FI",
  Ireland: "IE",
  Czechia: "CZ",
  Hungary: "HU",
  Poland: "PL",
  Romania: "RO",
};

export type BuiltQuery = { query: string; country: string };

/** Build the provider queries from the configured criteria. */
export function buildQueries(): BuiltQuery[] {
  // Short, precise queries: long OR-chains dilute the ranking and return
  // unrelated aggregator pages. Geo-targeting is handled by the provider
  // `location` option instead of stuffing the country into the query.
  const contractWords = (country: string) =>
    CONTRACT_ONLY_COUNTRIES.includes(country as (typeof CONTRACT_ONLY_COUNTRIES)[number])
      ? "contract OR freelance OR interim"
      : "contract OR freelance OR interim OR permanent";

  // Only target vacancies published within the MAX_AGE_DAYS window. The
  // `after:` operator tells the search index to drop older pages before they
  // cost us an open/extract; the code-side hard gate still double-checks the
  // parsed publication date of every candidate.
  const afterDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const open = (title: string, country: string) => ({
    query: `"${title}" job vacancy ${country} (${contractWords(country)}) after:${afterDate}`,
    country,
  });
  const board = (title: string, country: string): BuiltQuery | null => {
    const sites = SEARCH_SITES[country as keyof typeof SEARCH_SITES] ?? [];
    if (sites.length === 0) return null;
    const siteFilter = sites.map((s) => `site:${s}`).join(" OR ");
    return { query: `"${title}" (${siteFilter}) after:${afterDate}`, country };
  };

  // Priority vocabulary: guaranteed coverage for every country on every run,
  // ordered country-round-robin so a truncated budget never starves a country.
  const priorityQueries: BuiltQuery[] = [];
  for (const title of PRIORITY_TITLES) {
    for (const country of SEARCH_COUNTRIES) priorityQueries.push(open(title, country));
  }
  for (const country of SEARCH_COUNTRIES) {
    const q = board(PRIORITY_TITLES[0]!, country);
    if (q) priorityQueries.push(q);
  }

  // Interleave the two role families so any truncated slice of the query list
  // still covers documentation AND requirements/analysis vocabulary.
  const titles: string[] = [];
  const maxLen = Math.max(TECHNICAL_WRITING_TITLES.length, BUSINESS_ANALYSIS_TITLES.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (TECHNICAL_WRITING_TITLES[i]) titles.push(TECHNICAL_WRITING_TITLES[i]!);
    if (BUSINESS_ANALYSIS_TITLES[i]) titles.push(BUSINESS_ANALYSIS_TITLES[i]!);
  }
  // Rotate countries per title so a truncated slice also spans all countries.
  const openQueries: BuiltQuery[] = [];
  const siteQueries: BuiltQuery[] = [];
  for (let pass = 0; pass < SEARCH_COUNTRIES.length; pass += 1) {
    titles.forEach((title, index) => {
      const country = SEARCH_COUNTRIES[(index + pass) % SEARCH_COUNTRIES.length]!;
      openQueries.push(open(title, country));
      const q = board(title, country);
      if (q) siteQueries.push(q);
    });
  }
  // Interleave so any truncated slice still hits both open web and boards.
  const queries: BuiltQuery[] = [];
  const longest = Math.max(openQueries.length, siteQueries.length);
  for (let i = 0; i < longest; i += 1) {
    if (openQueries[i]) queries.push(openQueries[i]!);
    if (siteQueries[i]) queries.push(siteQueries[i]!);
  }
  return [...priorityQueries, ...queries];
}




type ProviderHit = { url: string; title?: string; description?: string; markdown?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetch with an explicit upper bound so one stuck site cannot stall a run. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Small worker pool: bounded parallelism without uncontrolled API fan-out. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}


/** Rate limits (429) and upstream blips (5xx) are transient — retry with backoff. */
async function providerSearch(
  built: BuiltQuery,
  limit: number,
): Promise<ProviderHit[]> {
  const query = built.query;
  const countryCode = COUNTRY_CODES[built.country];
  const MAX_ATTEMPTS = 4;
  let res: Response | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    res = await firecrawlRequest(
      "/search",
      {
        query,
        limit,
        sources: ["web"],
        // Sort by date, then constrain to the provider's one-month window; the
        // code-side hard gate below enforces the configured 15-day age limit.
        tbs: "sbd:1,qdr:m",
        ...(countryCode ? { country: countryCode, location: built.country } : {}),
        timeout: 45_000,
        ignoreInvalidURLs: true,
        // DISCOVERY ONLY — deliberately no scrapeOptions here. Requesting
        // markdown made the provider read every returned page (including
        // multi-hundred-page annual report PDFs) before we had any chance to
        // screen it. Pages are read later, only for plausible candidates.
      },
      60_000,
    );

    if (res.ok) break;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2_000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
    await res.text().catch(() => undefined);
    await sleep(Math.min(waitMs, 15_000));
  }
  if (!res || !res.ok) {
    const text = res ? await res.text() : "no response";
    throw new Error(`Web search failed [${res?.status ?? 0}]: ${text}`);
  }
  // Firecrawl v2 returns { success, data: { web: [...], news?: [...] } }.
  // Older/direct shapes return a flat array in `data` or a top-level `web` array.
  const json = (await res.json()) as {
    data?: ProviderHit[] | { web?: ProviderHit[]; news?: ProviderHit[]; images?: ProviderHit[] };
    web?: ProviderHit[];
    results?: ProviderHit[];
  };
  const data = json.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    return [...(data.web ?? []), ...(data.news ?? [])];
  }
  return json.web ?? json.results ?? [];
}

/**
 * Direct-fetch fallback for advertisements the scrape provider refuses
 * (LinkedIn and similar). Returns readable text extracted from the live page,
 * including the JSON-LD JobPosting payload when the page exposes one, so the
 * verification step still judges the real advertisement content.
 */
export async function fetchAdvertisementText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en",
        },
      },
      25_000,
    );
    if (!res.ok) return null;
    const html = await res.text();
    if (!html) return null;

    const parts: string[] = [];
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
    if (title) parts.push(title.trim());

    // JSON-LD JobPosting carries datePosted / hiringOrganization / employmentType.
    const ldMatches = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );
    for (const m of ldMatches) {
      const raw = m[1]?.trim();
      if (!raw || !/JobPosting/i.test(raw)) continue;
      parts.push(raw.slice(0, 20_000));
    }

    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&rsquo;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (body.length > 200) parts.push(body.slice(0, 30_000));

    const text = parts.join("\n\n").trim();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Sentinel returned instead of paying for a document that is far too large to
 * be a single advertisement. The URL is never silently discarded: the caller
 * records a diagnostic so it can be inspected manually later.
 */
export const DOCUMENT_TOO_LARGE = "__document_too_large__";

/** Hard byte ceiling for one advertisement read (a job ad is never this big). */
const MAX_DOCUMENT_BYTES = 2_000_000;

/**
 * Free HEAD probe: refuse obviously oversized documents (annual/ESG reports,
 * brochures) BEFORE any paid read. Unknown size is allowed through — the guard
 * must never reject a vacancy just because a server omits content-length.
 */
async function isOversizedDocument(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, 12_000);
    const length = Number(res.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) return false;
    return length > MAX_DOCUMENT_BYTES;
  } catch {
    return false;
  }
}

/** Open the actual advertisement so fields can be verified against the source. */
export async function scrapeAdvertisement(
  url: string,
  prefetchedMarkdown?: string,
): Promise<string | null> {
  // Reuse substantive content that was already obtained for this URL instead of
  // opening the same advertisement a second time.
  if (prefetchedMarkdown && prefetchedMarkdown.trim().length >= 400) {
    return prefetchedMarkdown.trim();
  }

  if (await isOversizedDocument(url)) {
    console.warn(`[jobSearch] skipped oversized document (not read, preserved): ${url}`);
    return DOCUMENT_TOO_LARGE;
  }

  try {
    const res = await firecrawlRequest(
      "/scrape",
      {
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 35_000,
        // Reuse a recent provider-cached copy when one exists (24h). Vacancy
        // pages do not change materially within a day and this avoids paying
        // twice for the same advertisement across runs.
        maxAge: 86_400_000,
      },
      45_000,
    );
    if (!res.ok) return fetchAdvertisementText(url);
    const json = (await res.json()) as { markdown?: string; data?: { markdown?: string } };
    return json.markdown ?? json.data?.markdown ?? (await fetchAdvertisementText(url));
  } catch {
    return fetchAdvertisementText(url);
  }
}

/**
 * FREE preliminary screening on discovery metadata only (URL + title +
 * description). This is deliberately a small denylist of clearly non-vacancy
 * material — never a role-title allowlist — so unusual job titles, unknown
 * paths and ambiguous documents remain eligible for paid reading.
 */
const NON_VACANCY_URL_PATTERNS = [
  /\/(news|newsroom|press|press-releases?|pressemitteilung|medien|media|blog|blogs|stories|story|insights?|events?|webinars?)(\/|$)/i,
  /\/(investors?|investor-relations|ir|financials?|annual-?report|interim-?report|quarterly|results|shareholders?)(\/|$)/i,
  /\/(newsletter|subscribe|imprint|impressum|legal|privacy|terms|cookie)(\/|$)/i,
  /\/(about|about-us|company|contact|kontakt|team|leadership|management|locations?)(\/|$)/i,
  /annual[-_ ]?report|jahresbericht|geschaftsbericht|rapport[-_ ]?annuel|sustainability[-_ ]?report|esg[-_ ]?report|factsheet|brochure|whitepaper|presentation/i,
];

/** Careers/overview landing pages: real vacancies live one level deeper. */
const CAREERS_LANDING_PATTERNS = [
  /\/(careers?|karriere|carrieres?|jobs|stellen|vacancies|offres|working-at-us|life-at)\/?$/i,
  /\/(careers?|karriere|jobs|stellen)\/(overview|why-us|culture|benefits|students?|graduates?|internships?|stories|blog)(\/|$)/i,
];

const NON_VACANCY_TEXT_PATTERNS = [
  /annual report|interim report|quarterly report|half[- ]year report|financial statements/i,
  /jahresbericht|geschäftsbericht|rapport annuel|relazione annuale/i,
  /press release|pressemitteilung|communiqué de presse|newsletter|media kit/i,
  /sustainability report|esg report|investor presentation|whitepaper/i,
];

export type ScreenResult = { keep: true } | { keep: false; detail: string };

export function screenHit(hit: {
  url: string;
  title?: string;
  description?: string;
}): ScreenResult {
  let parsed: URL;
  try {
    parsed = new URL(hit.url);
  } catch {
    return { keep: false, detail: "unparseable url" };
  }
  const path = `${parsed.pathname}${parsed.search}`;

  for (const re of NON_VACANCY_URL_PATTERNS) {
    if (re.test(path)) return { keep: false, detail: `non-vacancy url pattern: ${re.source}` };
  }
  for (const re of CAREERS_LANDING_PATTERNS) {
    if (re.test(parsed.pathname)) return { keep: false, detail: "careers landing page" };
  }

  // PDFs and other documents are NOT rejected as a class — a genuine job
  // description is often a PDF. They are only rejected when the URL, title or
  // description clearly names a report/newsletter/presentation.
  const text = `${hit.title ?? ""} ${hit.description ?? ""}`;
  for (const re of NON_VACANCY_TEXT_PATTERNS) {
    if (re.test(text)) return { keep: false, detail: `non-vacancy document title: ${re.source}` };
  }

  return { keep: true };
}


const PLACEHOLDER_HOSTS = [
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "test.com",
  "mock.com",
  "placeholder.com",
];

/** Aggregator/search-result paths that are not a single advertisement. */
const SEARCH_PATH_PATTERNS = [
  /\/search\b/i,
  /\/jobs\/?$/i,
  /\/browse\b/i,
  /\/results\b/i,
  /\/emplois\/?$/i,
  /\/stellenangebote\/?$/i,
];

/** Structural check: is this a plausible, non-placeholder, single-advertisement URL? */
export function isPlausibleVacancyUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".")) return false;
  if (PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  if (parsed.pathname === "/" || parsed.pathname === "") return false;
  if (parsed.searchParams.has("q") || parsed.searchParams.has("query")) return false;
  if (SEARCH_PATH_PATTERNS.some((re) => re.test(parsed.pathname))) return false;
  return true;
}

// Statuses that mean "the page exists but the site blocks automated clients".
// The advertisement was already scraped successfully at this point, so these
// must not disqualify a genuine vacancy.
const BOT_PROTECTED_STATUSES = new Set([401, 403, 405, 429, 999]);

/**
 * Confirm the advertisement URL actually resolves to a live page.
 * Returns the final (redirect-resolved) URL, or null when it cannot be opened.
 */
export async function verifyVacancyUrl(rawUrl: string): Promise<string | null> {
  if (!isPlausibleVacancyUrl(rawUrl)) return null;
  try {
    let res = await fetchWithTimeout(rawUrl, { method: "HEAD", redirect: "follow" }, 15_000);
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetchWithTimeout(rawUrl, { method: "GET", redirect: "follow" }, 20_000);
    }
    if (!res.ok && !BOT_PROTECTED_STATUSES.has(res.status)) return null;
    const finalUrl = res.url || rawUrl;
    return isPlausibleVacancyUrl(finalUrl) ? finalUrl : null;
  } catch {
    return null;
  }
}

const EXTRACTION_SCHEMA = `{
  "qualifies": boolean,
  "rejection_reason": string,
  "title": string,
  "company": string,
  "country": one of ${JSON.stringify(SEARCH_COUNTRIES)},
  "city": string,
  "role_category": "Technical Writer" | "Business Analyst" | "Related",
  "role_title_group": string,
  "contract_type": one of ${JSON.stringify(SEARCH_CONTRACT_TYPES)},
  "duration": string | null,
  "work_model": "Remote" | "Hybrid" | "Onsite",
  "publication_date": ISO date string,
  "source": string,
  "url": string,
  "language": {
    "working_language": string,
    "english_required": boolean,
    "local_language_required": boolean,
    "additional_languages": string[],
    "assessment": string
  },
  "match_score": integer 0-100,
  "recommendation": "Apply" | "Maybe" | "Don't apply",
  "match_summary": string,
  "strong_matches": string[],
  "partial_matches": string[],
  "missing_requirements": string[],
  "transferable_experience": string[],
  "red_flags": string[]
}`;

function verificationPrompt(todayIso: string) {
  return buildPrompt(todayIso);
}

/** Skills the candidate already has — never valid as "missing requirements". */
const PROFILE_SKILLS = [
  "dita",
  "xml",
  "docs-as-code",
  "docs as code",
  "git",
  "confluence",
  "jira",
  "agile",
  "ci/cd",
  "swagger",
  "openapi",
  "postman",
  "sql",
  "api documentation",
  "technical writing",
  "enterprise software documentation",
  "database",
  "ai-assisted",
];

function sanitizeMissing(items: string[]): string[] {
  return items.filter((item) => {
    const t = String(item).toLowerCase();
    return !PROFILE_SKILLS.some((skill) => t.includes(skill));
  });
}

function buildPrompt(todayIso: string) {
  return `You verify and score job advertisements. Today is ${todayIso}.

CONTRACT TYPE RULE — apply before any other judgement:
- For contract-only countries (${CONTRACT_ONLY_COUNTRIES.join(", ")}), PERMANENT employment (unbefristet / Festanstellung / CDI / tillsvidare / indefinite) is NEVER in scope. Reject these vacancies immediately, regardless of title or match.
- For all other countries (${SEARCH_COUNTRIES.filter((c) => !CONTRACT_ONLY_COUNTRIES.includes(c)).join(", ")}), permanent employment IS accepted and should be classified as contract_type "Permanent". Contract/freelance/interim/fixed-term work is still preferred.

REJECT (qualifies=false) a vacancy when ANY of the following is true:
- the country is not one of ${SEARCH_COUNTRIES.join(", ")}
- the vacancy is permanent employment AND the country is one of ${CONTRACT_ONLY_COUNTRIES.join(", ")}
- the publication date is unknown or older than ${MAX_AGE_DAYS} days
- English is not a working language of the role. Only include jobs where English is explicitly a working language; it is fine if additional local languages are also required.
  Never assume English simply because the company is international — require evidence in the advertisement.
- the page is a search-results/aggregator listing page rather than a single advertisement

SCORING (0-100) against this candidate profile:
${CANDIDATE_PROFILE}

Weigh MANDATORY requirements far more heavily than nice-to-haves. Do not keyword match:
judge whether the candidate genuinely satisfies each stated requirement, and treat
Business Analyst / Requirements Engineering roles as transferable fit.
Bands: 90-100 Excellent, 80-89 Strong, 70-79 Good, 60-69 Possible, below 60 Weak.
recommendation: "Apply" for >=80, "Maybe" for 60-79, "Don't apply" below 60.

FIELD SEMANTICS — follow exactly, these are judged FROM THE CANDIDATE'S POINT OF VIEW:
- strong_matches: requirements stated in the ADVERTISEMENT that the candidate clearly meets.
- partial_matches: advertisement requirements the candidate partly or indirectly meets.
- missing_requirements: ONLY requirements stated in the ADVERTISEMENT that the candidate
  does NOT have. Never list a skill that appears in the candidate profile above
  (e.g. DITA, Git, Swagger/OpenAPI, SQL, API documentation) as missing — the candidate has it.
  Never copy the candidate profile into this field. If the candidate meets every stated
  requirement, return an empty array.
- transferable_experience: candidate experience that substitutes for a stated requirement.
- red_flags: concerns in the advertisement itself (unclear scope, language, rate, seniority mismatch).

Reply with JSON only, matching exactly:
${EXTRACTION_SCHEMA}`;
}

async function extractAndScore(
  hit: ProviderHit,
  content: string,
  todayIso: string,
): Promise<{
  candidate: CandidateJob | null;
  reason?: RejectionReason | undefined;
  detail?: string | undefined;
  title?: string | undefined;
}> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new SearchProviderNotConfiguredError(
      "LOVABLE_API_KEY is missing on the server, so advertisements cannot be verified or scored.",
    );
  }

  const res = await fetchWithTimeout(
    AI_GATEWAY,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: verificationPrompt(todayIso) },
          {
            role: "user",
            content: `URL: ${hit.url}\nListing title: ${hit.title ?? ""}\n\nAdvertisement content:\n${content.slice(0, 18000)}`,
          },
        ],
      }),
    },
    90_000,
  );

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429 || res.status === 402) {
      throw new Error(`AI verification unavailable [${res.status}]: ${text}`);
    }
    return { candidate: null, reason: "extraction_failed", detail: `AI error ${res.status}` };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return { candidate: null, reason: "extraction_failed", detail: "empty AI response" };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as Record<string, unknown>;
  } catch {
    return { candidate: null, reason: "extraction_failed", detail: "unparseable AI response" };
  }

  const parsedTitle = typeof parsed["title"] === "string" ? (parsed["title"] as string) : undefined;
  if (parsed["qualifies"] !== true) {
    const detail = String(parsed["rejection_reason"] ?? "");
    return {
      candidate: null,
      reason: classifyRejectionReason(detail),
      detail,
      title: parsedTitle,
    };
  }

  // The URL must come from the actual search hit that was opened and analysed.
  // A model-supplied URL is only accepted when it is a plausible vacancy URL on
  // the same host (e.g. a cleaner employer application link on the same site).
  let url = hit.url;
  const modelUrl = typeof parsed["url"] === "string" ? (parsed["url"] as string) : "";
  if (modelUrl && modelUrl !== hit.url && isPlausibleVacancyUrl(modelUrl)) {
    try {
      if (new URL(modelUrl).hostname === new URL(hit.url).hostname) url = modelUrl;
    } catch {
      /* keep hit.url */
    }
  }
  if (!isPlausibleVacancyUrl(url)) {
    return { candidate: null, reason: "not_a_vacancy_url", title: parsedTitle };
  }
  const candidate: CandidateJob = {
    title: String(parsed["title"] ?? ""),
    company: String(parsed["company"] ?? ""),
    country: parsed["country"] as CandidateJob["country"],
    city: String(parsed["city"] ?? ""),
    role_category: (parsed["role_category"] ?? "Related") as CandidateJob["role_category"],
    role_title_group: String(parsed["role_title_group"] ?? parsed["title"] ?? ""),
    contract_type: parsed["contract_type"] as CandidateJob["contract_type"],
    duration: (parsed["duration"] as string | null) ?? null,
    work_model: (parsed["work_model"] ?? "Onsite") as CandidateJob["work_model"],
    publication_date: String(parsed["publication_date"] ?? ""),
    source: String(parsed["source"] ?? new URL(url).hostname),
    url,
    language: parsed["language"] as CandidateJob["language"],
    match_score: Number(parsed["match_score"] ?? 0),
    recommendation: (parsed["recommendation"] ?? "Maybe") as CandidateJob["recommendation"],
    match_summary: String(parsed["match_summary"] ?? ""),
    strong_matches: (parsed["strong_matches"] as string[]) ?? [],
    partial_matches: (parsed["partial_matches"] as string[]) ?? [],
    missing_requirements: sanitizeMissing((parsed["missing_requirements"] as string[]) ?? []),
    transferable_experience: (parsed["transferable_experience"] as string[]) ?? [],
    red_flags: (parsed["red_flags"] as string[]) ?? [],
    last_verified: new Date().toISOString(),
  };
  return { candidate, title: parsedTitle };
}

/** Final safety net: re-check hard criteria in code, independent of the model. */
export function passesHardCriteria(job: CandidateJob): boolean {
  if (!job.title || !job.company || !job.url) return false;
  if (isPaywalledUrl(job.url)) return false;
  if (!isPlausibleVacancyUrl(job.url)) return false;
  if (!SEARCH_COUNTRIES.includes(job.country)) return false;
  if (!SEARCH_CONTRACT_TYPES.includes(job.contract_type)) return false;
  if (CONTRACT_ONLY_COUNTRIES.includes(job.country) && job.contract_type === "Permanent")
    return false;
  const published = Date.parse(job.publication_date);
  if (Number.isNaN(published)) return false;
  const ageDays = (Date.now() - published) / 86_400_000;
  if (ageDays < 0 || ageDays > MAX_AGE_DAYS) return false;
  if (job.language?.local_language_required === true) return false;
  if (job.language && job.language.english_required === false) return false;
  return true;
}

function dedupeKey(job: CandidateJob) {
  return `${job.company}|${job.title}|${job.city}|${job.country}`.toLowerCase().trim();
}

/**
 * Full engine pass: search -> open advertisement -> verify -> score.
 * Returns verified, scored, de-duplicated candidate records (never persisted here).
 */
/** Stable key used to recognise a vacancy URL that is already stored. */
/** Query keys that never identify a specific vacancy (tracking / analytics only). */
const TRACKING_PARAMS = /^(utm_|gclid|fbclid|mc_cid|mc_eid|_ga|trk|trackingid|src|source|campaign)/i;

export function normalizeVacancyUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const base = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
    // Many career sites identify the vacancy in the query string
    // (e.g. detail.php?refCode=RU0R87). Dropping it would merge every
    // vacancy on that site into a single key.
    const params = [...parsed.searchParams.entries()]
      .filter(([key, value]) => value !== "" && !TRACKING_PARAMS.test(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    const suffix = params.length ? `?${params.join("&")}` : "";
    return `${base}${suffix}`.toLowerCase();
  } catch {
    return rawUrl.toLowerCase();
  }
}

export async function runSearchEngine(options?: {
  maxQueries?: number;
  resultsPerQuery?: number;
  knownUrls?: string[];
}): Promise<SearchEngineResult> {
  // Must be >= the number of priority queries (2 titles x 11 countries + 11 site
  // queries = 33) so every country, including the contract-only ones, is searched.
  const maxQueries = options?.maxQueries ?? 40;

  const resultsPerQuery = options?.resultsPerQuery ?? 5;
  const todayIso = new Date().toISOString().slice(0, 10);

  const queries = buildQueries().slice(0, maxQueries);
  const seenUrls = new Set<string>();
  const hits: ProviderHit[] = [];
  const queryFailures: string[] = [];

  // Provider calls are independent. Four workers keep the run responsive while
  // leaving headroom for the connected provider's rate limits.
  const queryOutcomes = await mapWithConcurrency(queries, 4, async (query) => {
    try {
      return { results: await providerSearch(query, resultsPerQuery) };
    } catch (error) {
      // A single query failing (rate limit, upstream blip) must not abort the run.
      const message = error instanceof Error ? error.message : String(error);
      console.error("[jobSearch] query failed:", query, error);
      return { failure: message };
    } finally {
      await sleep(300);
    }
  });

  for (const outcome of queryOutcomes) {
    if ("failure" in outcome) {
      queryFailures.push(outcome.failure);
      continue;
    }
    for (const hit of outcome.results) {
      if (!hit.url || seenUrls.has(hit.url)) continue;
      seenUrls.add(hit.url);
      hits.push(hit);
    }
  }
  if (hits.length === 0 && queryFailures.length > 0) {
    throw new Error(queryFailures[0]!);
  }

  const toDiagnostic = (
    hit: ProviderHit,
    reason: RejectionReason,
    title?: string,
    detail?: string,
  ): CandidateDiagnostic => ({
    url: hit.url,
    title: title ?? hit.title ?? "",
    role_family: classifyRoleFamily(title, hit.title, hit.description, hit.url),
    reason,
    ...(detail ? { detail } : {}),
  });

  type HitOutcome = {
    diagnostic?: CandidateDiagnostic;
    job?: CandidateJob;
  };

  // Each hit performs scrape -> LLM verification -> final URL check. Six workers
  // substantially reduce wall-clock time without changing the order of results.
  // Vacancies already stored are skipped before any page fetch or AI call:
  // re-analysing them costs credits and can never produce a new job.
  const knownUrls = new Set((options?.knownUrls ?? []).map(normalizeVacancyUrl));

  const outcomes = await mapWithConcurrency(hits, 6, async (hit): Promise<HitOutcome> => {
    if (knownUrls.has(normalizeVacancyUrl(hit.url))) {
      return { diagnostic: toDiagnostic(hit, "already_known") };
    }
    if (!isPlausibleVacancyUrl(hit.url)) {
      return { diagnostic: toDiagnostic(hit, "not_a_vacancy_url") };
    }
    // The advertisement must actually be openable before anything is considered.
    const content = await scrapeAdvertisement(hit.url, hit.markdown);
    if (!content) {
      return { diagnostic: toDiagnostic(hit, "page_not_openable") };
    }
    const outcome = await extractAndScore(hit, content, todayIso);
    const candidate = outcome.candidate;
    if (!candidate) {
      return {
        diagnostic: toDiagnostic(hit, outcome.reason ?? "other", outcome.title, outcome.detail),
      };
    }
    const hardFail = hardCriteriaReason(candidate);
    if (hardFail) {
      return {
        diagnostic: toDiagnostic(hit, hardFail, candidate.title, "failed code-side hard criteria re-check"),
      };
    }
    // Final gate: the stored URL must resolve to a live page.
    const verifiedUrl = await verifyVacancyUrl(candidate.url);
    if (!verifiedUrl) {
      return { diagnostic: toDiagnostic(hit, "url_not_verified", candidate.title) };
    }
    candidate.url = verifiedUrl;
    return {
      job: candidate,
      diagnostic: toDiagnostic(hit, "qualified", candidate.title),
    };
  });

  const jobs: CandidateJob[] = [];
  const byKey = new Set<string>();
  const diagnostics: CandidateDiagnostic[] = [];
  let rejected = 0;

  for (const outcome of outcomes) {
    if (outcome.diagnostic) {
      diagnostics.push(outcome.diagnostic);
      if (
        outcome.diagnostic.reason !== "qualified" &&
        outcome.diagnostic.reason !== "already_known"
      )
        rejected += 1;
    }
    if (!outcome.job) continue;
    const key = dedupeKey(outcome.job);
    if (byKey.has(key)) continue;
    byKey.add(key);
    jobs.push(outcome.job);
  }

  const alreadyKnown = diagnostics.filter((d) => d.reason === "already_known").length;

  return {
    jobs,
    examined: hits.length,
    already_known: alreadyKnown,
    rejected,
    queries: queries.map((q) => q.query),
    diagnostics,
  };
}

