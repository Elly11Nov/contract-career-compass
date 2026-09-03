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
  "Content Specialist",
  "Developer Documentation",
  "Developer Documentation Engineer",
  "API Documentation Specialist",
  "API Technical Writer",
  "Product Documentation Specialist",
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
];

/**
 * Countries included for contract-style work only.
 * Permanent employment in these countries is rejected.
 */
export const CONTRACT_ONLY_COUNTRIES: Country[] = ["Czechia", "Hungary", "Poland", "Romania"];

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
16+ years senior Technical Writing experience.
Enterprise software documentation; API documentation.
DITA/XML; docs-as-code; Git; Confluence; Jira; Agile; CI/CD exposure.
Swagger/OpenAPI; Postman; SQL and database knowledge.
Requirements Engineering and requirements documentation.
Software engineering environments; AI-assisted documentation.
Strong English (native-level working language); working knowledge of German.
Business Analyst and Requirements Engineering roles should be assessed for transferable fit
(requirements elicitation, specification writing, stakeholder work, systems analysis).
`.trim();
