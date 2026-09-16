/**
 * Early Radar recruiter scan (Stage 1 — real vacancies only).
 *
 * Reads the verified job pages of monitored Swiss recruitment agencies with the
 * same Firecrawl provider and the same Lovable AI scoring gateway already used
 * by the Job Search engine, then keeps only vacancies that:
 *   - open on a real, single-advertisement URL (verified before storage),
 *   - are located in Switzerland (priority hubs or Switzerland-wide/remote),
 *   - substantively overlap the candidate profile (not keyword matching),
 *   - do not require German as a genuine working language.
 *
 * Nothing is ever invented: a vacancy that cannot be opened and verified is
 * rejected rather than stored.
 */
import { CANDIDATE_PROFILE } from "@/services/searchCriteria";
import {
  isPlausibleVacancyUrl,
  normalizeVacancyUrl,
  scrapeAdvertisement,
  verifyVacancyUrl,
  SearchProviderNotConfiguredError,
} from "@/services/jobSearch.server";

const FIRECRAWL_DIRECT = "https://api.firecrawl.dev/v2";
const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

/** Swiss locations we prioritise, plus nationwide/remote coverage. */
export const PRIORITY_LOCATIONS = [
  "Zurich",
  "Basel",
  "Bern",
  "Geneva",
  "Lausanne",
  "Zug",
  "Switzerland",
];

/** Role vocabulary used only to widen discovery — never to qualify a role. */
const RADAR_ROLE_TERMS = [
  '"Business Analyst"',
  '"Technical Business Analyst"',
  '"Requirements Engineer"',
  '"Requirements Analyst"',
  '"Functional Analyst"',
  '"Business Process Analyst"',
  '"Technical Writer"',
  '"Documentation Specialist"',
  '"Documentation Engineer"',
  '"Knowledge Engineer"',
  '"Digital Transformation Analyst"',
  '"AI Business Analyst"',
];

export interface RadarSourceInput {
  id: string;
  name: string;
  source_category: string;
  site_url: string | null;
  jobs_url: string | null;
}

export interface RadarCandidate {
  title: string;
  source_name: string;
  source_category: string;
  client_company: string;
  city: string | null;
  country: string;
  employment_type: string;
  language_requirement: string;
  url: string;
  url_key: string;
  dedupe_key: string;
  source_published_at: string | null;
  relevance: "High" | "Medium" | "Low";
  relevance_score: number;
  relevance_reason: string;
  role_category: string | null;
  matched_skills: string[];
  verification_status: string;
}

export interface RadarScanDiagnostic {
  source: string;
  url: string;
  title: string;
  reason: string;
  detail?: string;
}

export interface RadarScanResult {
  sources_scanned: string[];
  sources_skipped: { name: string; reason: string }[];
  examined: number;
  qualified: number;
  rejected: number;
  candidates: RadarCandidate[];
  diagnostics: RadarScanDiagnostic[];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function firecrawlRequest(path: string, body: unknown, timeoutMs = 45_000) {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) {
    throw new SearchProviderNotConfiguredError(
      "No web-search provider is configured. Connect the Firecrawl connector so that FIRECRAWL_API_KEY is available to the server, then run the scan again.",
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
  return fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify(body) }, timeoutMs);
}

type ProviderHit = {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  markdown?: string | undefined;
};

function normalizeHits(payload: unknown): ProviderHit[] {
  const root = payload as Record<string, unknown> | null;
  if (!root) return [];
  const data = root["data"] as Record<string, unknown> | unknown[] | undefined;
  const buckets: unknown[] = [];
  if (Array.isArray(data)) buckets.push(...data);
  else if (data && typeof data === "object") {
    for (const key of ["web", "news", "results"]) {
      const bucket = (data as Record<string, unknown>)[key];
      if (Array.isArray(bucket)) buckets.push(...bucket);
    }
  }
  for (const key of ["web", "results"]) {
    const bucket = root[key];
    if (Array.isArray(bucket)) buckets.push(...bucket);
  }
  return buckets
    .map((item) => item as Record<string, unknown>)
    .filter((item) => typeof item?.["url"] === "string")
    .map((item) => ({
      url: item["url"] as string,
      title: typeof item["title"] === "string" ? item["title"] : undefined,
      description: typeof item["description"] === "string" ? item["description"] : undefined,
      markdown: typeof item["markdown"] === "string" ? item["markdown"] : undefined,
    }));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function providerSearch(query: string, limit: number): Promise<ProviderHit[]> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let res: Response;
    try {
      res = await firecrawlRequest("/search", {
        query,
        limit,
        sources: ["web"],
        location: "Switzerland",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      });
    } catch (error) {
      if (error instanceof SearchProviderNotConfiguredError) throw error;
      if (attempt === 3) return [];
      await sleep(attempt * 2_000);
      continue;
    }
    if (res.ok) return normalizeHits(await res.json());
    if (res.status !== 429 && res.status < 500) return [];
    if (attempt === 3) return [];
    await sleep(attempt * 3_000);
  }
  return [];
}

/**
 * Read a recruiter's own job-listing page and collect the individual vacancy
 * links it publishes. Search engines mostly index the listing page itself, so
 * without this step no single vacancy is ever reached.
 */
async function discoverFromListing(source: RadarSourceInput): Promise<ProviderHit[]> {
  const listing = source.jobs_url ?? source.site_url;
  if (!listing) return [];
  let res: Response;
  try {
    res = await firecrawlRequest(
      "/scrape",
      { url: listing, formats: ["markdown", "links"], onlyMainContent: true },
      60_000,
    );
  } catch (error) {
    if (error instanceof SearchProviderNotConfiguredError) throw error;
    return [];
  }
  if (!res.ok) return [];
  const payload = (await res.json()) as Record<string, unknown>;
  const data = (payload["data"] as Record<string, unknown> | undefined) ?? payload;
  const raw = data["links"];
  if (!Array.isArray(raw)) return [];
  const listingHost = hostOf(listing);
  const seen = new Set<string>();
  const hits: ProviderHit[] = [];
  for (const entry of raw) {
    const url = typeof entry === "string" ? entry : (entry as { url?: string })?.url;
    if (!url || hostOf(url) !== listingHost) continue;
    if (!isPlausibleVacancyUrl(url)) continue;
    const key = normalizeVacancyUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ url });
  }
  return hits;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Discovery queries for one recruiter: its own domain + relevant roles + Swiss locations. */
export function buildSourceQueries(source: RadarSourceInput): string[] {
  const host = hostOf(source.jobs_url) ?? hostOf(source.site_url);
  if (!host) return [];
  const roles = RADAR_ROLE_TERMS.join(" OR ");
  return [
    `site:${host} (${roles}) Switzerland`,
    `site:${host} (${roles}) (Zurich OR Basel OR Bern OR Geneva OR Lausanne OR Zug) (contract OR freelance OR interim OR permanent)`,
  ];
}

const RADAR_SCHEMA = `{
  "qualifies": boolean,
  "rejection_reason": string,
  "title": string,
  "client_company": string,
  "city": string,
  "country": string,
  "employment_type": "Contract" | "Permanent" | "Temporary" | "Fixed-term" | "Interim" | "Unknown",
  "language_requirement": "English" | "English + French" | "English + Italian" | "English (German an advantage)" | "German required" | "Unknown",
  "source_published_at": string,
  "relevance": "High" | "Medium" | "Low",
  "relevance_score": number,
  "relevance_reason": string,
  "role_category": string,
  "matched_skills": string[]
}`;

export function isRecruiterCategory(category: string): boolean {
  return /recruiter/i.test(category);
}

function radarPrompt(recruiter: string, todayIso: string, isRecruiter = true) {
  const clientRule = isRecruiter
    ? `CLIENT RULE:
- The advertising agency is the SOURCE, never the employer. If the end client/hiring company is
  named in the advertisement, put it in client_company. If it is not named, return exactly
  "Not disclosed". Never infer or guess the client from hints.`
    : `EMPLOYER RULE:
- The advertisement is published by the employer itself. Put the employing company in
  client_company exactly as the page names it. Never invent a different company.`;
  return `You verify vacancies advertised ${isRecruiter ? `by the Swiss recruitment agency "${recruiter}"` : `on the careers site of the Swiss employer "${recruiter}"`}. Today is ${todayIso}.

REJECT (qualifies=false) when ANY of the following is true:
- the page is a listing/search page, an expired vacancy, or not a single vacancy advertisement
- the location is not Switzerland
- German is explicitly required and genuinely necessary for the role
- the actual responsibilities and required skills do not substantively overlap the candidate profile below.
  Never qualify a role merely because it contains words like "digital transformation", "AI",
  "technology" or "analyst". Judge the real duties and requirements.

LANGUAGE RULES:
- Accept English-sufficient roles, English + French, English + Italian, and roles where German is
  only preferred/an advantage (language_requirement "English (German an advantage)").
- Reject when German is mandatory for doing the job.
- If the requirement is not stated, use "Unknown". Never assume English because the company is
  Swiss or international.

CLIENT RULE:
- The advertising agency is the SOURCE, never the employer. If the end client/hiring company is
  named in the advertisement, put it in client_company. If it is not named, return exactly
  "Not disclosed". Never infer or guess the client from hints.

CANDIDATE PROFILE:
${CANDIDATE_PROFILE}
Also relevant: technical documentation, API documentation, docs-as-code, DITA/XML, requirements
engineering, business/functional/process analysis, stakeholder management, Agile, Jira, Confluence,
ServiceNow, APIs, JSON, Swagger/OpenAPI, Postman, SDK documentation, knowledge management, content
governance, information architecture, single sourcing, digital transformation, AI-assisted
workflows, regulated-industry environments.

relevance_score 0-100 on substantive overlap. relevance: "High" >=80, "Medium" 60-79, "Low" below 60.
relevance_reason: one or two sentences explaining WHY, referring to actual advertisement content.
source_published_at: ISO date stated on the page, or "" when the page states none.
city: the Swiss location, or "Switzerland" when nationwide/remote.

Reply with JSON only, matching exactly:
${RADAR_SCHEMA}`;
}

function parseJsonReply(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

const str = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

async function scoreAdvertisement(
  source: RadarSourceInput,
  hit: ProviderHit,
  content: string,
  verifiedUrl: string,
  todayIso: string,
): Promise<{ candidate: RadarCandidate | null; reason: string; detail?: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new SearchProviderNotConfiguredError(
      "LOVABLE_API_KEY is missing on the server, so vacancies cannot be verified or scored.",
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
          { role: "system", content: radarPrompt(source.name, todayIso) },
          {
            role: "user",
            content: `URL: ${verifiedUrl}\nPage title: ${hit.title ?? "unknown"}\n\nADVERTISEMENT:\n${content.slice(0, 18_000)}`,
          },
        ],
      }),
    },
    60_000,
  );
  if (!res.ok) {
    return { candidate: null, reason: "scoring_failed", detail: `AI gateway ${res.status}` };
  }
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonReply(raw);
  if (!parsed) return { candidate: null, reason: "extraction_failed" };

  if (parsed["qualifies"] !== true) {
    return {
      candidate: null,
      reason: str(parsed["rejection_reason"], "not_relevant"),
    };
  }

  const language = str(parsed["language_requirement"], "Unknown");
  if (/german required/i.test(language)) {
    return { candidate: null, reason: "german_required" };
  }
  const country = str(parsed["country"], "Switzerland");
  if (!/switzerland|schweiz|suisse|svizzera|^ch$/i.test(country)) {
    return { candidate: null, reason: "not_switzerland", detail: country };
  }

  const title = str(parsed["title"], hit.title ?? "");
  if (!title) return { candidate: null, reason: "extraction_failed" };

  const clientRaw = str(parsed["client_company"], "Not disclosed");
  const client = /^(not disclosed|undisclosed|unknown|n\/?a|confidential)$/i.test(clientRaw)
    ? "Not disclosed"
    : clientRaw;
  const publishedRaw = str(parsed["source_published_at"]);
  const published = publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? publishedRaw : null;
  const score = Math.max(0, Math.min(100, Number(parsed["relevance_score"]) || 0));
  const relevanceRaw = str(parsed["relevance"], "Low");
  const relevance =
    relevanceRaw === "High" || relevanceRaw === "Medium" || relevanceRaw === "Low"
      ? relevanceRaw
      : score >= 80
        ? "High"
        : score >= 60
          ? "Medium"
          : "Low";
  const city = str(parsed["city"], "Switzerland");
  const skills = Array.isArray(parsed["matched_skills"])
    ? (parsed["matched_skills"] as unknown[]).map((s) => String(s)).slice(0, 12)
    : [];

  const urlKey = normalizeVacancyUrl(verifiedUrl);
  const dedupeKey = `${client.toLowerCase()}|${title.toLowerCase().replace(/\s+/g, " ").trim()}`;

  return {
    candidate: {
      title,
      source_name: source.name,
      source_category: source.source_category,
      client_company: client,
      city,
      country: "Switzerland",
      employment_type: str(parsed["employment_type"], "Unknown"),
      language_requirement: language,
      url: verifiedUrl,
      url_key: urlKey,
      dedupe_key: dedupeKey,
      source_published_at: published,
      relevance,
      relevance_score: score,
      relevance_reason: str(parsed["relevance_reason"]),
      role_category: str(parsed["role_category"]) || null,
      matched_skills: skills,
      verification_status: "verified",
    },
    reason: "qualified",
  };
}

/** Scan the given recruiter sources and return verified, scored vacancies. */
export async function runRecruiterScan(options: {
  sources: RadarSourceInput[];
  knownUrlKeys?: string[];
  maxPerSource?: number;
}): Promise<RadarScanResult> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const known = new Set(options.knownUrlKeys ?? []);
  const maxPerSource = options.maxPerSource ?? 6;

  const result: RadarScanResult = {
    sources_scanned: [],
    sources_skipped: [],
    examined: 0,
    qualified: 0,
    rejected: 0,
    candidates: [],
    diagnostics: [],
  };

  const seenKeys = new Set<string>();

  for (const source of options.sources) {
    const queries = buildSourceQueries(source);
    if (queries.length === 0) {
      result.sources_skipped.push({ name: source.name, reason: "no verified page to read" });
      continue;
    }
    result.sources_scanned.push(source.name);

    const hits: ProviderHit[] = [];
    for (const query of queries) {
      hits.push(...(await providerSearch(query, 8)));
      await sleep(600);
    }
    hits.push(...(await discoverFromListing(source)));

    let acceptedForSource = 0;
    for (const hit of hits) {
      if (acceptedForSource >= maxPerSource) break;
      if (!isPlausibleVacancyUrl(hit.url)) continue;
      const key = normalizeVacancyUrl(hit.url);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      if (known.has(key)) continue;

      result.examined += 1;
      const verifiedUrl = await verifyVacancyUrl(hit.url);
      if (!verifiedUrl) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: hit.url,
          title: hit.title ?? "",
          reason: "page_not_openable",
        });
        continue;
      }
      const content = await scrapeAdvertisement(verifiedUrl, hit.markdown);
      if (!content) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: verifiedUrl,
          title: hit.title ?? "",
          reason: "extraction_failed",
        });
        continue;
      }

      const scored = await scoreAdvertisement(source, hit, content, verifiedUrl, todayIso);
      if (!scored.candidate) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: verifiedUrl,
          title: hit.title ?? "",
          reason: scored.reason,
          ...(scored.detail ? { detail: scored.detail } : {}),
        });
        continue;
      }
      // Same vacancy already collected in this run through another URL form.
      if (result.candidates.some((c) => c.dedupe_key === scored.candidate!.dedupe_key)) {
        result.diagnostics.push({
          source: source.name,
          url: verifiedUrl,
          title: scored.candidate.title,
          reason: "duplicate",
        });
        continue;
      }
      result.candidates.push(scored.candidate);
      result.qualified += 1;
      acceptedForSource += 1;
    }
  }

  return result;
}
