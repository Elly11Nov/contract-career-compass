import { runSearchEngine } from "./src/services/jobSearch.server";
const r = await runSearchEngine({ maxQueries: 4, resultsPerQuery: 5 });
console.log("QUERIES", JSON.stringify(r.queries));
console.log("examined", r.examined, "jobs", r.jobs.length, "rejected", r.rejected);
const counts: Record<string, number> = {};
for (const d of r.diagnostics ?? []) counts[d.reason] = (counts[d.reason] ?? 0) + 1;
console.log("REASONS", counts);
console.log(r.jobs.map((j) => `${j.title} | ${j.company} | ${j.country} | ${j.match_score}`));
