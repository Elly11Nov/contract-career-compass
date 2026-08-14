/**
 * Shared, client-safe search criteria and candidate profile.
 * Used by the search engine (server) and by the UI to record search runs.
 */
import type { ContractType, Country } from "@/types/job";

export const TECHNICAL_WRITING_TITLES = [
  "Technical Writer",
  "Senior Technical Writer",
  "Documentation Engineer",
  "Technical Documentation Specialist",
  "API Technical Writer",
  "Developer Documentation Writer",
  "Technical Author",
  "Documentation Specialist",
  "Information Developer",
];

export const BUSINESS_ANALYSIS_TITLES = [
  "Business Analyst",
  "Senior Business Analyst",
  "IT Business Analyst",
  "Technical Business Analyst",
  "Systems Analyst",
  "Requirements Engineer",
  "Requirements Analyst",
  "Technical Requirements Engineer",
  "Requirements Manager",
  "Functional Analyst",
];

export const SEARCH_COUNTRIES: Country[] = [
  "Germany",
  "France",
  "Sweden",
  "Denmark",
  "Finland",
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
];

export const MAX_AGE_DAYS = 15;

export const SEARCH_CRITERIA = {
  roles: [...TECHNICAL_WRITING_TITLES, ...BUSINESS_ANALYSIS_TITLES],
  countries: SEARCH_COUNTRIES,
  contract_types: SEARCH_CONTRACT_TYPES,
  language: "English",
  max_age_days: MAX_AGE_DAYS,
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
