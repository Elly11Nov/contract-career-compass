import { runSearchEngine } from "./src/services/jobSearch.server";
const r = await runSearchEngine({ maxQueries: 3, resultsPerQuery: 5 });
console.log("examined", r.examined, "jobs", r.jobs.length, "rejected", r.rejected);
console.log(r.queries);
console.log(JSON.stringify(r.diagnostics?.slice(0,20), null, 1));
