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
  /** True only when the source still presents the vacancy as open/active. */
  is_open: boolean;
  /** Closing/expiry date stated on the page, when there is one. */
  closing_date: string | null;
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

/**
 * Web search used only as a fallback when a source publishes no usable job list.
 * Deliberately does NOT ask Firecrawl to read the result pages: page reading is
 * charged per result, and individual vacancies are read later, only for the
 * strongest candidates.
 */
async function providerSearch(query: string, limit: number): Promise<ProviderHit[]> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let res: Response;
    try {
      res = await firecrawlRequest("/search", {
        query,
        limit,
        sources: ["web"],
        location: "Switzerland",
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
 * Stage 1 of discovery: read the source's own job-list/careers page once and
 * collect the individual vacancy links it publishes, together with the link
 * text and surrounding line, which usually already exposes role, location and
 * employment type. That metadata is used as a free preliminary filter so that
 * only strong candidates are opened individually in stage 2.
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
  const markdown = typeof data["markdown"] === "string" ? (data["markdown"] as string) : "";
  const listingHost = hostOf(listing);

  /** Link text + the line it appeared on, per absolute URL found in the markdown. */
  const context = new Map<string, { title: string; line: string }>();
  for (const line of markdown.split("\n")) {
    const linkRe = /\[([^\]]{2,160})\]\(([^)\s]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(line))) {
      const text = match[1]?.trim() ?? "";
      const href = match[2] ?? "";
      let abs: string;
      try {
        abs = new URL(href, listing).toString();
      } catch {
        continue;
      }
      const key = normalizeVacancyUrl(abs);
      if (!context.has(key)) context.set(key, { title: text, line: line.trim().slice(0, 400) });
    }
  }

  const raw = data["links"];
  const urls: string[] = Array.isArray(raw)
    ? raw
        .map((entry) => (typeof entry === "string" ? entry : (entry as { url?: string })?.url))
        .filter((u): u is string => typeof u === "string")
    : [];
  // Markdown-only links (relative hrefs) still count as discovered vacancies.
  const seen = new Set<string>();
  const hits: ProviderHit[] = [];
  const consider = (url: string) => {
    if (hostOf(url) !== listingHost) return;
    if (!isPlausibleVacancyUrl(url)) return;
    const key = normalizeVacancyUrl(url);
    if (seen.has(key)) return;
    seen.add(key);
    const meta = context.get(key);
    hits.push({
      url,
      ...(meta?.title ? { title: meta.title } : {}),
      ...(meta?.line ? { description: meta.line } : {}),
    });
  };
  for (const url of urls) consider(url);
  for (const [key] of context) {
    if (!seen.has(key)) consider(key);
  }
  return hits;
}

/** Terms used only to rank listing candidates cheaply — never to qualify a role. */
const PRELIM_ROLE_WORDS = [
  "technical writer",
  "technical author",
  "documentation",
  "docs",
  "information architect",
  "knowledge manager",
  "knowledge engineer",
  "content engineer",
  "business analyst",
  "requirements engineer",
  "requirements analyst",
  "functional analyst",
  "process analyst",
  "systems analyst",
  "business process",
  "transformation",
  "business analysis",
  "product analyst",
];

const PRELIM_SOFT_WORDS = [
  "analyst",
  "analysis",
  "writer",
  "technical",
  "digital",
  "ai ",
  "knowledge",
  "requirements",
  "specification",
  "product owner",
];

const PRELIM_NEGATIVE_WORDS = [
  "apprentice",
  "praktikum",
  "internship",
  "lehrstelle",
  "student",
  "cleaner",
  "nurse",
  "chef",
  "driver",
  "sales representative",
  "account executive",
  "electrician",
  "mechanic",
  "welder",
  "security guard",
];

const PRELIM_GERMAN_HINTS = [
  "deutschsprachig",
  "deutsch erforderlich",
  "german required",
  "(m/w/d) deutsch",
];

/**
 * Free preliminary relevance score for a listing entry, based only on metadata
 * already present on the job-list page (title, link line, URL slug).
 * Nothing qualifies here: this only decides the ORDER in which vacancy pages
 * are opened, and which obvious non-matches are never opened at all.
 */
export function prelimScore(hit: ProviderHit): number {
  const text = `${hit.title ?? ""} ${hit.description ?? ""} ${decodeURIComponent(hit.url).replace(/[-_/]+/g, " ")}`.toLowerCase();
  let score = 0;
  if (PRELIM_ROLE_WORDS.some((w) => text.includes(w))) score += 60;
  else if (PRELIM_SOFT_WORDS.some((w) => text.includes(w))) score += 20;
  if (PRIORITY_LOCATIONS.some((l) => text.includes(l.toLowerCase()))) score += 15;
  if (/(schweiz|suisse|svizzera|\bch\b|z(ü|u)rich|gen(è|e)ve)/i.test(text)) score += 5;
  if (/(contract|freelance|interim|temporary|fixed[- ]term|befristet|mandat)/i.test(text))
    score += 10;
  if (/\benglish\b/i.test(text)) score += 5;
  if (PRELIM_GERMAN_HINTS.some((w) => text.includes(w))) score -= 40;
  if (PRELIM_NEGATIVE_WORDS.some((w) => text.includes(w))) score -= 50;
  return score;
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
  "vacancy_status": "Open" | "Closed" | "Unknown",
  "closing_date": string,
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
- the page is a listing/search page or not a single vacancy advertisement
- the location is not Switzerland
- German is explicitly required and genuinely necessary for the role
- the actual responsibilities and required skills do not substantively overlap the candidate profile below.
  Never qualify a role merely because it contains words like "digital transformation", "AI",
  "technology" or "analyst". Judge the real duties and requirements.

LANGUAGE RULES:
- Accept English-sufficient roles, English + French, English + Italian, and roles where German is
  only preferred/an advantage (language_requirement "English (German an advantage)").
- Reject (language_requirement "German required") whenever the page makes German mandatory in any
  wording: "German required", "fluent German", "German-speaking", "German proficiency",
  "German C1/C2/B2", "German and English required", or any equivalent.
- Do NOT reject when German is only preferred, an advantage, advantageous, desirable, nice to have
  or a plus.
- If the requirement is not stated, use "Unknown". Never assume English because the company is
  Swiss or international.

${clientRule}

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

VACANCY STATUS RULES (report, do not reject):
- vacancy_status "Closed" when the page states the vacancy is closed, filled, expired, no longer
  available, no longer accepting applications, or shows a closing/expiry date already in the past
  relative to ${todayIso}.
- vacancy_status "Open" only when the page still presents the role as open and applicable, e.g. it
  shows an apply option and no closing statement.
- vacancy_status "Unknown" when the page gives no usable indication either way.
- Never infer "Closed" from an old publication date alone; only the page's own wording or a stated
  past closing date counts.
- closing_date: ISO date of the stated application deadline/closing date, or "" when none is stated.

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

/** Wording that makes German only desirable, never mandatory. */
const GERMAN_SOFT =
  /(preferred|an advantage|advantageous|desirable|nice to have|a plus|beneficial|welcome|would be|optional|von vorteil|w(ü|u)nschenswert|erw(ü|u)nscht|ein plus)/i;

/** Wording that makes German a genuine requirement. */
const GERMAN_HARD = [
  /(german|deutsch)[^.;\n]{0,80}\b(required|mandatory|essential|must|obligatory|necessary|fluency|fluent|proficiency|proficient|native|business level|c1|c2|b2|b1)\b/i,
  /\b(required|requirement|must have|must be|fluent|fluency|proficient|proficiency|native|excellent|very good|verhandlungssicher)\b[^.;\n]{0,80}(german|deutsch)/i,
  /(german|deutsch)\s*(and|und|&|\+|\/)\s*english[^.;\n]{0,60}\b(required|mandatory|fluent|fluency|essential|must)\b/i,
  /(sehr gute|flie(ß|ss)ende|verhandlungssichere|gute)\s+deutschkenntnisse/i,
  /deutsch(kenntnisse)?[^.;\n]{0,40}(zwingend|erforderlich|voraussetzung|notwendig|muss)/i,
  /(german|deutsch)[- ]?(speaking|sprachig)[^.;\n]{0,40}\b(required|mandatory|must|erforderlich)\b/i,
];

/**
 * Safety net over the AI language verdict: German must never be a requirement.
 * Only sentences that actually make German mandatory exclude a vacancy;
 * sentences where German is preferred/an advantage are ignored.
 */
export function requiresGerman(content: string): boolean {
  const sentences = content.split(/(?<=[.;!?\n])/);
  for (const sentence of sentences) {
    if (!/german|deutsch/i.test(sentence)) continue;
    if (GERMAN_SOFT.test(sentence)) continue;
    if (GERMAN_HARD.some((re) => re.test(sentence))) return true;
  }
  return false;
}

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
          {
            role: "system",
            content: radarPrompt(
              source.name,
              todayIso,
              isRecruiterCategory(source.source_category),
            ),
          },
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
  if (/german required/i.test(language) || requiresGerman(content)) {
    return { candidate: null, reason: "german_required" };
  }
  const country = str(parsed["country"], "Switzerland");
  if (!/switzerland|schweiz|suisse|svizzera|^ch$/i.test(country)) {
    return { candidate: null, reason: "not_switzerland", detail: country };
  }

  const title = str(parsed["title"], hit.title ?? "");
  if (!title) return { candidate: null, reason: "extraction_failed" };

  const clientRaw = str(parsed["client_company"], "Not disclosed");
  const client = isRecruiterCategory(source.source_category)
    ? /^(not disclosed|undisclosed|unknown|n\/?a|confidential)$/i.test(clientRaw)
      ? "Not disclosed"
      : clientRaw
    : // An employer advertises for itself: the monitored company IS the employer.
      source.name;
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

  const closingRaw = str(parsed["closing_date"]);
  const closingDate = closingRaw && !Number.isNaN(Date.parse(closingRaw)) ? closingRaw : null;
  const statedStatus = str(parsed["vacancy_status"], "Unknown");
  const closedByDate = closingDate ? Date.parse(closingDate) < Date.parse(todayIso) : false;
  // Safety net: the page's own wording, never the publication date.
  // Swiss sources publish in German, French and Italian as well as English.
  const closedByWording =
    /\b(this (vacancy|position|job|role) (is|has been) (now )?(closed|filled|expired))\b|\bno longer (available|accepting applications|open)\b|\bapplications (are )?closed\b|\bvacancy (expired|closed)\b|\bposition has been filled\b/i.test(
      content,
    ) ||
    /(bereits geschlossen|stelle (ist|wurde) (bereits )?(geschlossen|besetzt)|inserat (ist )?(nicht mehr|abgelaufen)|nicht mehr verf(ü|ue)gbar|nicht mehr ausgeschrieben|bewerbungsfrist (ist )?abgelaufen|vakanz (ist )?geschlossen)/i.test(
      content,
    ) ||
    /(cette (offre|annonce|vacance) (est|a été) (d[ée]j[àa] )?(clôtur[ée]e|ferm[ée]e|pourvue)|n'est plus disponible|offre expir[ée]e)/i.test(
      content,
    ) ||
    /(questa (offerta|posizione) (è|e') (già )?(chiusa|coperta)|non (è|e') pi(ù|u) disponibile)/i.test(
      content,
    );
  const isOpen = !(/^closed$/i.test(statedStatus) || closedByDate || closedByWording);

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
      is_open: isOpen,
      closing_date: closingDate,
    },
    reason: isOpen ? "qualified" : "qualified_closed",
  };
}

/**
 * Scan the given sources and return verified, scored vacancies.
 *
 * Two-stage discovery, to keep provider usage low:
 *   Stage 1 — read the source's own job-list page ONCE and use the titles,
 *             lines and URL slugs it exposes as a free preliminary filter.
 *   Stage 2 — open individual vacancy pages only for the strongest candidates,
 *             best-first, within a per-source page-read budget, and apply the
 *             unchanged full relevance/language/status analysis to them.
 *
 * Web search is a fallback used only when stage 1 yields no candidates, and it
 * never asks the provider to read the result pages.
 */
export async function runRecruiterScan(options: {
  sources: RadarSourceInput[];
  knownUrlKeys?: string[];
  maxPerSource?: number;
  /** Max individual vacancy pages opened per source (provider budget). */
  maxPageReadsPerSource?: number;
}): Promise<RadarScanResult> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const known = new Set(options.knownUrlKeys ?? []);
  const maxPerSource = options.maxPerSource ?? 6;
  const maxPageReads = options.maxPageReadsPerSource ?? 8;

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

    // Stage 1: the source's own job list (one page read).
    let hits = await discoverFromListing(source);
    if (hits.length === 0) {
      // Fallback only: the job list gave nothing usable.
      for (const query of queries) {
        hits.push(...(await providerSearch(query, 8)));
        await sleep(600);
      }
    }

    // Rank candidates best-first and drop obvious non-matches entirely.
    hits = hits
      .map((hit) => ({ hit, score: prelimScore(hit) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.hit);

    let acceptedForSource = 0;
    let pageReads = 0;
    for (const hit of hits) {
      if (acceptedForSource >= maxPerSource) break;
      // Budget stop: keep reading beyond the budget only if nothing qualified yet.
      if (pageReads >= maxPageReads && acceptedForSource > 0) break;
      if (pageReads >= maxPageReads * 2) break;
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
      pageReads += 1;
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

/** Employers use the same verified pipeline; only the prompt's employer rule differs. */
export const runSourceScan = runRecruiterScan;

/* ------------------------------------------------------------------ *
 * Business & transformation signals
 * ------------------------------------------------------------------ */

export interface RadarSignalCandidate {
  company: string;
  source_category: string;
  country: string;
  category: string;
  description: string;
  evidence_source: string;
  url: string;
  url_key: string;
  published_at: string | null;
  radar_status: "High" | "Medium" | "Low";
  relevance_score: number;
  why_relevant: string;
  potential_roles: string[];
  matched_skills: string[];
}

export interface RadarSignalScanResult {
  sources_scanned: string[];
  examined: number;
  qualified: number;
  rejected: number;
  signals: RadarSignalCandidate[];
  diagnostics: RadarScanDiagnostic[];
}

const SIGNAL_SCHEMA = `{
  "qualifies": boolean,
  "rejection_reason": string,
  "category": "Company growth" | "Technology change" | "Transformation" | "Organisation change" | "Hiring pattern",
  "description": string,
  "published_at": string,
  "radar_status": "High" | "Medium" | "Low",
  "relevance_score": number,
  "why_relevant": string,
  "potential_roles": string[],
  "matched_skills": string[]
}`;

function signalPrompt(company: string, todayIso: string) {
  return `You assess a public web page for evidence of business or technology activity at the Swiss
company "${company}" that could later create work suited to the candidate profile below.
Today is ${todayIso}.

QUALIFY (qualifies=true) ONLY when the page contains concrete, checkable public evidence of:
technology or digital transformation, an AI programme, a major technology project or platform,
an acquisition, expansion, a new team or a major technology investment at this company.

REJECT when the page is: generic marketing with no specific initiative, a vacancy advertisement,
about a different company, undated speculation, or a press aggregation with no substance.

RULES:
- description: what the evidence actually says, in one or two factual sentences. Never speculate.
- This is a SIGNAL TO MONITOR, never a prediction that a role will be advertised. why_relevant must
  be phrased cautiously ("may", "could") and must reference the candidate profile.
- published_at: the ISO date stated on the page, or "" when the page states none. Never guess.
- relevance_score 0-100 on how plausibly this activity relates to the profile.
  radar_status: "High" >=80, "Medium" 60-79, "Low" below 60.

CANDIDATE PROFILE:
${CANDIDATE_PROFILE}

Reply with JSON only, matching exactly:
${SIGNAL_SCHEMA}`;
}

const SIGNAL_TERMS = [
  '"digital transformation"',
  '"technology transformation"',
  '"AI programme" OR "AI program" OR "artificial intelligence"',
  '"new platform" OR "platform migration"',
  '"acquisition" OR "acquires"',
  '"expansion" OR "new team" OR "new hub"',
];

/**
 * Reads public pages about a monitored company and keeps only signals backed by a
 * page that actually opens. Nothing is inferred or invented.
 */
export async function runSignalScan(options: {
  sources: RadarSourceInput[];
  knownUrlKeys?: string[];
  maxPerSource?: number;
}): Promise<RadarSignalScanResult> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const known = new Set(options.knownUrlKeys ?? []);
  const maxPerSource = options.maxPerSource ?? 3;
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new SearchProviderNotConfiguredError(
      "LOVABLE_API_KEY is missing on the server, so signals cannot be assessed.",
    );
  }

  const result: RadarSignalScanResult = {
    sources_scanned: [],
    examined: 0,
    qualified: 0,
    rejected: 0,
    signals: [],
    diagnostics: [],
  };
  const seen = new Set<string>();

  for (const source of options.sources) {
    result.sources_scanned.push(source.name);
    const hits: ProviderHit[] = [];
    for (const term of SIGNAL_TERMS.slice(0, 3)) {
      hits.push(...(await providerSearch(`"${source.name}" Switzerland ${term}`, 5)));
      await sleep(600);
    }

    let accepted = 0;
    for (const hit of hits) {
      if (accepted >= maxPerSource) break;
      const key = normalizeVacancyUrl(hit.url);
      if (seen.has(key) || known.has(key)) continue;
      seen.add(key);

      result.examined += 1;
      const content = hit.markdown ?? (await scrapeAdvertisement(hit.url, hit.markdown));
      if (!content) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: hit.url,
          title: hit.title ?? "",
          reason: "page_not_openable",
        });
        continue;
      }

      const res = await fetchWithTimeout(
        AI_GATEWAY,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: signalPrompt(source.name, todayIso) },
              {
                role: "user",
                content: `URL: ${hit.url}\nPage title: ${hit.title ?? "unknown"}\n\nPAGE:\n${content.slice(0, 14_000)}`,
              },
            ],
          }),
        },
        60_000,
      );
      if (!res.ok) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: hit.url,
          title: hit.title ?? "",
          reason: "scoring_failed",
          detail: `AI gateway ${res.status}`,
        });
        continue;
      }
      const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = parseJsonReply(payload.choices?.[0]?.message?.content ?? "");
      if (!parsed || parsed["qualifies"] !== true) {
        result.rejected += 1;
        result.diagnostics.push({
          source: source.name,
          url: hit.url,
          title: hit.title ?? "",
          reason: parsed ? str(parsed["rejection_reason"], "no_evidence") : "extraction_failed",
        });
        continue;
      }

      const description = str(parsed["description"]);
      if (!description) {
        result.rejected += 1;
        continue;
      }
      const publishedRaw = str(parsed["published_at"]);
      const score = Math.max(0, Math.min(100, Number(parsed["relevance_score"]) || 0));
      const statusRaw = str(parsed["radar_status"], "Low");
      const status =
        statusRaw === "High" || statusRaw === "Medium" || statusRaw === "Low"
          ? statusRaw
          : score >= 80
            ? "High"
            : score >= 60
              ? "Medium"
              : "Low";

      result.signals.push({
        company: source.name,
        source_category: source.source_category,
        country: "Switzerland",
        category: str(parsed["category"], "Technology change"),
        description,
        evidence_source: hostOf(hit.url) ?? "public web page",
        url: hit.url,
        url_key: key,
        published_at:
          publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? publishedRaw : null,
        radar_status: status,
        relevance_score: score,
        why_relevant: str(parsed["why_relevant"]),
        potential_roles: Array.isArray(parsed["potential_roles"])
          ? (parsed["potential_roles"] as unknown[]).map(String).slice(0, 6)
          : [],
        matched_skills: Array.isArray(parsed["matched_skills"])
          ? (parsed["matched_skills"] as unknown[]).map(String).slice(0, 12)
          : [],
      });
      result.qualified += 1;
      accepted += 1;
    }
  }

  return result;
}
