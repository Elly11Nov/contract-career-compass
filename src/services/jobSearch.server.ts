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
  const titles = [
    ...TECHNICAL_WRITING_TITLES.slice(0, 5),
    ...BUSINESS_ANALYSIS_TITLES.slice(0, 5),
  ];
  const queries: string[] = [];
  for (const country of SEARCH_COUNTRIES) {
    for (const title of titles) {
      queries.push(`"${title}" ${contractWords} job ${country} English`);
    }
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
): Promise<CandidateJob | null> {
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
    return null;
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed["qualifies"] !== true) return null;

  const url = (parsed["url"] as string) || hit.url;
  return {
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
}

/** Final safety net: re-check hard criteria in code, independent of the model. */
export function passesHardCriteria(job: CandidateJob): boolean {
  if (!job.title || !job.company || !job.url) return false;
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

  for (const hit of hits) {
    const content = hit.markdown ?? (await scrapeAdvertisement(hit.url));
    if (!content) {
      rejected += 1;
      continue;
    }
    const candidate = await extractAndScore(hit, content, todayIso);
    if (!candidate || !passesHardCriteria(candidate)) {
      rejected += 1;
      continue;
    }
    const key = dedupeKey(candidate);
    if (byKey.has(key)) continue;
    byKey.add(key);
    jobs.push(candidate);
  }

  return { jobs, examined: hits.length, rejected, queries };
}
