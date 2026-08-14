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
  SEARCH_CONTRACT_TYPES,
  SEARCH_COUNTRIES,
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
  if (!isPlausibleVacancyUrl(job.url)) return "not_a_vacancy_url";
  if (!SEARCH_COUNTRIES.includes(job.country)) return "country_out_of_scope";
  if (!SEARCH_CONTRACT_TYPES.includes(job.contract_type)) return "permanent_role";
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

function firecrawlRequest(path: string, body: unknown) {
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
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
}

/** Build the provider queries from the configured criteria. */
export function buildQueries(): string[] {
  const contractWords = "contract OR freelance OR interim OR \"fixed-term\" OR consultant";
  // Interleave the two role families so any truncated slice of the query list
  // still covers documentation AND requirements/analysis vocabulary.
  const titles: string[] = [];
  const maxLen = Math.max(TECHNICAL_WRITING_TITLES.length, BUSINESS_ANALYSIS_TITLES.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (TECHNICAL_WRITING_TITLES[i]) titles.push(TECHNICAL_WRITING_TITLES[i]!);
    if (BUSINESS_ANALYSIS_TITLES[i]) titles.push(BUSINESS_ANALYSIS_TITLES[i]!);
  }
  // Rotate countries per title so a truncated slice also spans all countries.
  const queries: string[] = [];
  for (let pass = 0; pass < SEARCH_COUNTRIES.length; pass += 1) {
    titles.forEach((title, index) => {
      const country = SEARCH_COUNTRIES[(index + pass) % SEARCH_COUNTRIES.length]!;
      queries.push(`"${title}" ${contractWords} job ${country} English`);
    });
  }
  return queries;
}



type ProviderHit = { url: string; title?: string; description?: string; markdown?: string };

async function providerSearch(query: string, limit: number): Promise<ProviderHit[]> {
  const res = await firecrawlRequest("/search", {
    query,
    limit,
    tbs: "qdr:m",
    scrapeOptions: { formats: ["markdown"] },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Web search failed [${res.status}]: ${text}`);
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

/** Open the actual advertisement so fields can be verified against the source. */
export async function scrapeAdvertisement(url: string): Promise<string | null> {
  try {
    const res = await firecrawlRequest("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { markdown?: string; data?: { markdown?: string } };
    return json.markdown ?? json.data?.markdown ?? null;
  } catch {
    return null;
  }
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
    let res = await fetch(rawUrl, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(rawUrl, { method: "GET", redirect: "follow" });
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
  return `You verify and score job advertisements. Today is ${todayIso}.

REJECT (qualifies=false) a vacancy when ANY of the following is true:
- it is permanent employment rather than contract/freelance/temporary/fixed-term/project-based/consulting
- the country is not one of ${SEARCH_COUNTRIES.join(", ")}
- the publication date is unknown or older than ${MAX_AGE_DAYS} days
- a local language is mandatory as the primary working language, or English is not a working language.
  Never assume English simply because the company is international — require evidence in the advertisement.
- the page is a search-results/aggregator listing page rather than a single advertisement

SCORING (0-100) against this candidate profile:
${CANDIDATE_PROFILE}

Weigh MANDATORY requirements far more heavily than nice-to-haves. Do not keyword match:
judge whether the candidate genuinely satisfies each stated requirement, and treat
Business Analyst / Requirements Engineering roles as transferable fit.
Bands: 90-100 Excellent, 80-89 Strong, 70-79 Good, 60-69 Possible, below 60 Weak.
recommendation: "Apply" for >=80, "Maybe" for 60-79, "Don't apply" below 60.

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

  const res = await fetch(AI_GATEWAY, {
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
      response_format: { type: "json_object" },
    }),
  });

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
    missing_requirements: (parsed["missing_requirements"] as string[]) ?? [],
    transferable_experience: (parsed["transferable_experience"] as string[]) ?? [],
    red_flags: (parsed["red_flags"] as string[]) ?? [],
    last_verified: new Date().toISOString(),
  };
  return { candidate, title: parsedTitle };
}

/** Final safety net: re-check hard criteria in code, independent of the model. */
export function passesHardCriteria(job: CandidateJob): boolean {
  if (!job.title || !job.company || !job.url) return false;
  if (!isPlausibleVacancyUrl(job.url)) return false;
  if (!SEARCH_COUNTRIES.includes(job.country)) return false;
  if (!SEARCH_CONTRACT_TYPES.includes(job.contract_type)) return false;
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
export async function runSearchEngine(options?: {
  maxQueries?: number;
  resultsPerQuery?: number;
}): Promise<SearchEngineResult> {
  const maxQueries = options?.maxQueries ?? 10;
  const resultsPerQuery = options?.resultsPerQuery ?? 5;
  const todayIso = new Date().toISOString().slice(0, 10);

  const queries = buildQueries().slice(0, maxQueries);
  const seenUrls = new Set<string>();
  const hits: ProviderHit[] = [];

  for (const query of queries) {
    const results = await providerSearch(query, resultsPerQuery);
    for (const hit of results) {
      if (!hit.url || seenUrls.has(hit.url)) continue;
      seenUrls.add(hit.url);
      hits.push(hit);
    }
  }

  const jobs: CandidateJob[] = [];
  const byKey = new Set<string>();
  let rejected = 0;
  const diagnostics: CandidateDiagnostic[] = [];
  const note = (
    hit: ProviderHit,
    reason: RejectionReason,
    title?: string,
    detail?: string,
  ) => {
    diagnostics.push({
      url: hit.url,
      title: title ?? hit.title ?? "",
      role_family: classifyRoleFamily(title, hit.title, hit.description, hit.url),
      reason,
      ...(detail ? { detail } : {}),
    });
  };

  for (const hit of hits) {
    if (!isPlausibleVacancyUrl(hit.url)) {
      rejected += 1;
      note(hit, "not_a_vacancy_url");
      continue;
    }
    // The advertisement must actually be openable before anything is considered.
    const content = await scrapeAdvertisement(hit.url);
    if (!content) {
      rejected += 1;
      note(hit, "page_not_openable");
      continue;
    }
    const outcome = await extractAndScore(hit, content, todayIso);
    const candidate = outcome.candidate;
    if (!candidate) {
      rejected += 1;
      note(hit, outcome.reason ?? "other", outcome.title, outcome.detail);
      continue;
    }
    const hardFail = hardCriteriaReason(candidate);
    if (hardFail) {
      rejected += 1;
      note(hit, hardFail, candidate.title, "failed code-side hard criteria re-check");
      continue;
    }
    // Final gate: the stored URL must resolve to a live page.
    const verifiedUrl = await verifyVacancyUrl(candidate.url);
    if (!verifiedUrl) {
      rejected += 1;
      note(hit, "url_not_verified", candidate.title);
      continue;
    }
    candidate.url = verifiedUrl;
    const key = dedupeKey(candidate);
    if (byKey.has(key)) continue;
    byKey.add(key);
    jobs.push(candidate);
    note(hit, "qualified", candidate.title);
  }

  return { jobs, examined: hits.length, rejected, queries, diagnostics };
}
