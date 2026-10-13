/**
 * Shared, client-safe search criteria and candidate profile.
 * Used by the search engine (server) and by the UI to record search runs.
 */
import type { ContractType, Country } from "@/types/job";

export const TECHNICAL_WRITING_TITLES = [
  "Technical Writer",
  "Senior Technical Writer",
  "Technical Author",
  "Documentation Specialist",
  "Senior Documentation Specialist",
  "Documentation Engineer",
  "Senior Documentation Engineer",
  "Documentation Manager",
  "Documentation Lead",
  "Documentation Architect",
  "Documentation Consultant",
  "Content Engineer",
  "Technical Documentation Specialist",
  "Technical Documentation Manager",
  "Technical Publications Specialist",
  "Technical Publications Manager",
  "Information Developer",
  "Information Architect",
  "Knowledge Specialist",
  "Knowledge Manager",
  "Knowledge Engineer",
  "AI Knowledge Engineer",
  "Content Specialist",
  "Developer Documentation",
  "Developer Documentation Engineer",
  "API Documentation Specialist",
  "API Technical Writer",
  "AI Technical Writer",
  "Product Documentation Specialist",
  "AI Documentation Specialist",
  "Software Documentation Specialist",
  "User Assistance Specialist",
];

export const BUSINESS_ANALYSIS_TITLES = [
  "Requirements Engineer",
  "Senior Requirements Engineer",
  "Requirements Analyst",
  "Requirements Manager",
  "Requirements Specialist",
  "Technical Requirements Engineer",
  "Technical Requirements Analyst",
  "Business Analyst",
  "Senior Business Analyst",
  "IT Business Analyst",
  "Technical Business Analyst",
  "AI Business Analyst",
  "AI Transformation Business Analyst",
  "AI Functional Analyst",
  "AI Transformation Consultant",
  "AI Product Analyst",
  "Systems Analyst",
  "Systems Requirements Analyst",
  "Functional Analyst",
  "Business Systems Analyst",
  "Product Analyst",
];

export const SEARCH_COUNTRIES: Country[] = [
  "Germany",
  "France",
  "Switzerland",
  "Italy",
  "Sweden",
  "Denmark",
  "Finland",
  "Ireland",
  "Czechia",
  "Hungary",
  "Poland",
  "Romania",
  "Spain",
];

/**
 * Countries included for contract-style work only.
 * Permanent employment in these countries is rejected.
 */
export const CONTRACT_ONLY_COUNTRIES: Country[] = [
  "Germany",
  "Czechia",
  "Hungary",
  "Poland",
  "Romania",
  "Spain",
];

/**
 * Job platforms whose apply flow sits behind a paywall or premium
 * subscription. Vacancies from these domains are rejected and hidden.
 */
export const PAYWALL_DOMAINS = [
  "qualysoft.com",
  "jobleads.com",
  "experteer.com",
  "theladders.com",
  "dailyremote.com",
];

export function isPaywalledUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return PAYWALL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Titles that must be covered in every search run, for every country,
 * before the rotating role vocabulary is used.
 */
export const PRIORITY_TITLES = [
  "Requirements Engineer",
  "Requirements Engineering",
];

export const SEARCH_CONTRACT_TYPES: ContractType[] = [
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

export const MAX_AGE_DAYS = 15;

/**
 * Targeted contract/freelance job boards and agencies per country.
 * Used to build `site:` discovery queries in addition to the open web search.
 * Sources only widen discovery — every hit still passes the unchanged
 * qualification, verification and scoring rules.
 */
export const SEARCH_SITES: Record<Country, string[]> = {
  Germany: [
    "freelance.de",
    "freelancermap.de",
    "gulp.de",
    "hays.de",
    "experis.de",
    "stepstone.de",
    "linkedin.com/jobs",
  ],
  France: [
    "malt.fr",
    "free-work.com",
    "freelance-info.fr",
    "welcometothejungle.com",
    "hays.fr",
    "linkedin.com/jobs",
  ],
  Switzerland: ["freelance.ch", "gulp.ch", "hays.ch", "jobs.ch", "experis.ch", "linkedin.com/jobs"],
  Italy: [
    "it.indeed.com",
    "infojobs.it",
    "monster.it",
    "hays.it",
    "freelancermap.com",
    "linkedin.com/jobs",
  ],
  Sweden: ["brainville.com", "onsiter.com", "keyman.se", "emagine.se", "linkedin.com/jobs"],
  Denmark: ["prodata-consult.com", "onsiter.com", "emagine.dk", "ework.dk", "linkedin.com/jobs"],
  Finland: ["onsiter.com", "witted.com", "duunitori.fi", "oikotie.fi", "linkedin.com/jobs"],
  Ireland: ["irishjobs.ie", "jobs.ie", "ie.indeed.com", "hays.ie", "linkedin.com/jobs"],
  Czechia: ["jobs.cz", "startupjobs.cz", "cz.indeed.com", "hays.cz", "linkedin.com/jobs"],
  Hungary: ["profession.hu", "hu.indeed.com", "hays.hu", "cvonline.hu", "linkedin.com/jobs"],
  Poland: ["nofluffjobs.com", "justjoin.it", "pracuj.pl", "hays.pl", "linkedin.com/jobs"],
  Romania: ["ejobs.ro", "bestjobs.eu", "hipo.ro", "ro.indeed.com", "linkedin.com/jobs"],
  Spain: [
    "infojobs.net",
    "es.indeed.com",
    "hays.es",
    "experis.es",
    "malt.es",
    "linkedin.com/jobs",
  ],
};

export const SEARCH_CRITERIA = {
  roles: [...TECHNICAL_WRITING_TITLES, ...BUSINESS_ANALYSIS_TITLES],
  countries: SEARCH_COUNTRIES,
  contract_types: SEARCH_CONTRACT_TYPES,
  language: "English",
  max_age_days: MAX_AGE_DAYS,
  sites: SEARCH_SITES,
};

/** Candidate profile the scoring engine matches vacancies against. */
export const CANDIDATE_PROFILE = `
Requirements Engineer and Technical Documentation Specialist bridging business and engineering stakeholders across pharma, finance and SaaS.
CPRE-certified (IREB, 2025); 16+ years senior Technical Writing experience in enterprise software.

Core experience — Requirements Engineering and Change Management:
- Requirements elicitation, analysis and traceability (CPRE FL, IREB).
- Traceability mechanisms: requirement IDs, linking/traceability matrices, linking stakeholder needs to specifications via Jira artefacts.
- Gap analysis and as-is/to-be process mapping.
- Change control and SOP development in regulated environments.
- Stakeholder alignment across engineering, product, QA and regulatory.
- Jira/Confluence-based epic and requirements development.
- Agile/Scrum requirements lifecycle management.

Core experience — Technical Documentation and Content Architecture:
- DITA/XML structured authoring and single-sourcing.
- Docs-as-code toolchain: Git, Markdown, AsciiDoc, Jenkins, Jekyll.
- Docs-as-code governance: PR review, versioning/releases; lifecycle states draft/review/released.
- API/SDK documentation: REST, Swagger/OpenAPI, JSON.
- CMS authoring environments: Vasont, MadCap Flare, XMetaL, FrameMaker.
- Content governance and knowledge-base architecture.

Additional context: requirements definition, workflow modelling, AI-assisted workflow automation; translating complex technical environments into scalable documentation; SQL; Postman.
Strong English (native-level working language); working knowledge of German (German must never be required).
Target roles: Technical Writer, Lead Technical Writer, Documentation Specialist, Business Analyst, Requirements Engineer.
`.trim();

/**
 * Strict title gate: only the user's target role families are kept.
 */
const TARGET_TITLE_PATTERNS: RegExp[] = [
  /technical\s+(writer|author)/i,
  /documentation\s+(specialist|engineer|lead|manager|writer|consultant)/i,
  /technische[rn]?\s+redakt/i,
  /r[ée]dacteur\s+technique/i,
  /business\s+(systems\s+)?analyst/i,
  /requirements?\s+(engineer|engineering|analyst|specialist)/i,
];

export function isTargetRoleTitle(title: string): boolean {
  return TARGET_TITLE_PATTERNS.some((p) => p.test(title));
}
