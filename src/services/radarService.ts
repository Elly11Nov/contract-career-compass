/**
 * Early Radar data service layer.
 *
 * Phase 1: all records are clearly-flagged EXAMPLE data (`is_example: true`)
 * held in this module. The UI only ever reads through these functions, so a
 * later phase can swap the bodies for real career-page / ATS monitoring and
 * database persistence without touching any component.
 *
 * Nothing here claims a vacancy will appear. Signals are evidence only.
 */
import type {
  EarlyJob,
  PotentialOpportunity,
  RadarStatus,
  TargetCompany,
} from "@/types/radar";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

const dateAgo = (n: number) => daysAgo(n).slice(0, 10);

const exampleEarlyJobs: EarlyJob[] = [
  {
    id: "example-job-1",
    company: "Northwind Medical Systems (example)",
    title: "Requirements Engineer / Technical Writer",
    city: "Zurich",
    country: "Switzerland",
    first_detected_at: daysAgo(2),
    published_at: dateAgo(2),
    source: "Company careers page",
    url: "https://example.invalid/careers/requirements-engineer",
    relevance: "High",
    relevance_reason:
      "Combined requirements engineering and documentation scope in a regulated environment — close overlap with your core profile.",
    matched_skills: [
      "Requirements engineering",
      "Requirements documentation",
      "Technical writing",
      "Regulated-industry environments",
      "Confluence",
    ],
    potential_roles: ["Requirements Engineer", "Technical Writer"],
    seen_on_linkedin_at: null,
    lead_time_days: null,
    is_example: true,
  },
  {
    id: "example-job-2",
    company: "Aurora Payments (example)",
    title: "Senior Business Analyst — API Platform",
    city: "Dublin",
    country: "Ireland",
    first_detected_at: daysAgo(6),
    published_at: dateAgo(7),
    source: "Greenhouse (ATS)",
    url: "https://example.invalid/careers/senior-business-analyst",
    relevance: "High",
    relevance_reason:
      "Business analysis on an API platform with stakeholder management and API documentation duties.",
    matched_skills: [
      "Business analysis",
      "Stakeholder management",
      "APIs",
      "API documentation",
      "Agile",
    ],
    potential_roles: ["Business Analyst", "Product / Technology Analyst"],
    seen_on_linkedin_at: daysAgo(2),
    lead_time_days: 5,
    is_example: true,
  },
  {
    id: "example-job-3",
    company: "Helvetia Grid Analytics (example)",
    title: "Digital Transformation Analyst",
    city: "Milan",
    country: "Italy",
    first_detected_at: daysAgo(4),
    published_at: dateAgo(4),
    source: "Workday (ATS)",
    url: "https://example.invalid/careers/digital-transformation-analyst",
    relevance: "Medium",
    relevance_reason:
      "Process analysis and requirements gathering are named, but a large part of the role is vendor management — partial overlap only.",
    matched_skills: ["Process analysis", "Requirements elicitation", "Stakeholder management"],
    potential_roles: ["Digital Transformation Analyst", "Business Process Analyst"],
    seen_on_linkedin_at: null,
    lead_time_days: null,
    is_example: true,
  },
];

const examplePotentialOpportunities: PotentialOpportunity[] = [
  {
    id: "example-opp-1",
    company: "Baltic Rail Digital (example)",
    country: "Sweden",
    potential_roles: ["Business Analyst", "Requirements Engineer", "Documentation / Knowledge"],
    radar_status: "High",
    signals: [
      {
        category: "Hiring pattern",
        description: "Three Business Analyst vacancies advertised across two departments this quarter.",
        source: "Company careers page",
        detected_at: daysAgo(3),
      },
      {
        category: "Transformation",
        description: "Publicly announced multi-year digitalisation programme for operations.",
        source: "Company newsroom",
        detected_at: daysAgo(9),
      },
      {
        category: "Hiring pattern",
        description: "Previously advertised a Requirements Engineer role that is no longer listed.",
        source: "Career-page history",
        detected_at: daysAgo(21),
      },
    ],
    why_relevant:
      "Strong overlap with business analysis, requirements engineering and technical documentation in a regulated transport setting.",
    matched_skills: [
      "Business analysis",
      "Requirements engineering",
      "Process documentation",
      "Regulated-industry environments",
    ],
    detected_at: daysAgo(3),
    is_example: true,
  },
  {
    id: "example-opp-2",
    company: "Nordlys Health Cloud (example)",
    country: "Denmark",
    potential_roles: ["AI Business / Functional Analyst", "Documentation / Knowledge"],
    radar_status: "Medium",
    signals: [
      {
        category: "Technology change",
        description: "New public API and developer portal launched.",
        source: "Company product blog",
        detected_at: daysAgo(11),
      },
      {
        category: "Organisation change",
        description: "New Head of Platform Engineering announced.",
        source: "Public company announcement",
        detected_at: daysAgo(14),
      },
    ],
    why_relevant:
      "A new developer portal and API surface is often associated with demand for API documentation and functional analysis, though no relevant vacancy has been found.",
    matched_skills: ["API documentation", "Docs-as-code", "Information architecture", "SaaS"],
    detected_at: daysAgo(11),
    is_example: true,
  },
  {
    id: "example-opp-3",
    company: "Vltava Manufacturing Group (example)",
    country: "Czechia",
    potential_roles: ["Business Process Analyst", "Digital Transformation Analyst"],
    radar_status: "Low",
    signals: [
      {
        category: "Company growth",
        description: "New site opening announced, mostly production roles so far.",
        source: "Regional press",
        detected_at: daysAgo(18),
      },
    ],
    why_relevant:
      "Indirect signal only. Expansion could eventually create process-analysis work, but nothing observed points to a relevant role yet.",
    matched_skills: ["Process analysis", "Process documentation"],
    detected_at: daysAgo(18),
    is_example: true,
  },
];

const exampleTargetCompanies: TargetCompany[] = [
  {
    id: "example-target-1",
    company: "Northwind Medical Systems (example)",
    country: "Switzerland",
    industry: "Medical devices",
    role_categories: ["Requirements Engineer", "Technical Writer", "Documentation / Knowledge"],
    previous_relevant_hiring: ["Technical Writer (2025)", "Requirements Engineer (2024)"],
    current_signals: ["Open requirements/documentation vacancy detected", "Regulatory documentation programme"],
    radar_status: "High",
    last_checked_at: daysAgo(1),
    careers_url: "https://example.invalid/careers",
    is_example: true,
  },
  {
    id: "example-target-2",
    company: "Aurora Payments (example)",
    country: "Ireland",
    industry: "Fintech / payments",
    role_categories: ["Business Analyst", "Product / Technology Analyst"],
    previous_relevant_hiring: ["Business Analyst (2025)", "Product Analyst (2024)"],
    current_signals: ["Repeated business-analysis hiring", "API platform expansion"],
    radar_status: "High",
    last_checked_at: daysAgo(1),
    careers_url: "https://example.invalid/careers",
    is_example: true,
  },
  {
    id: "example-target-3",
    company: "Nordlys Health Cloud (example)",
    country: "Denmark",
    industry: "Health SaaS",
    role_categories: ["AI Business / Functional Analyst", "Documentation / Knowledge"],
    previous_relevant_hiring: ["Documentation Specialist (2024)"],
    current_signals: ["New developer portal", "New engineering leadership"],
    radar_status: "Medium",
    last_checked_at: daysAgo(2),
    careers_url: "https://example.invalid/careers",
    is_example: true,
  },
  {
    id: "example-target-4",
    company: "Seine Analytics Lab (example)",
    country: "France",
    industry: "AI / data services",
    role_categories: ["AI Business / Functional Analyst", "Knowledge Engineer"],
    previous_relevant_hiring: ["Knowledge Engineer (2025)"],
    current_signals: ["AI transformation initiative announced"],
    radar_status: "Medium",
    last_checked_at: daysAgo(4),
    careers_url: null,
    is_example: true,
  },
];

/** Sort helper: High first, then Medium, then Low. */
const statusRank: Record<RadarStatus, number> = { High: 0, Medium: 1, Low: 2 };

export async function getEarlyJobs(): Promise<EarlyJob[]> {
  return [...exampleEarlyJobs].sort(
    (a, b) =>
      statusRank[a.relevance] - statusRank[b.relevance] ||
      b.first_detected_at.localeCompare(a.first_detected_at),
  );
}

export async function getPotentialOpportunities(): Promise<PotentialOpportunity[]> {
  return [...examplePotentialOpportunities].sort(
    (a, b) =>
      statusRank[a.radar_status] - statusRank[b.radar_status] ||
      b.detected_at.localeCompare(a.detected_at),
  );
}

export async function getTargetCompanies(): Promise<TargetCompany[]> {
  return [...exampleTargetCompanies].sort(
    (a, b) =>
      statusRank[a.radar_status] - statusRank[b.radar_status] ||
      a.company.localeCompare(b.company),
  );
}

export const radarService = {
  getEarlyJobs,
  getPotentialOpportunities,
  getTargetCompanies,
};
