import { buildQueries } from "./src/services/jobSearch.server";
const q = buildQueries();
console.log(q.length);
console.log(q.slice(0,12).join("\n"));
