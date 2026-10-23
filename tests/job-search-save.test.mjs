import { expect, mock, test } from "bun:test";

const stored = { company: "SIX", title: "Senior Requirements Engineer (80-100%)", city: "Zurich", country: "Switzerland", contract_type: "Permanent", url: "https://jobs.ch/vacancies/first", status: "Applied" };
const inserted = [];
mock.module("../src/services/jobService.ts", () => ({
  getJobs: async () => [stored],
  createJob: async (job) => { inserted.push(job); return job; },
  createSearchRun: async () => {},
}));
mock.module("../src/services/jobSearch.functions.ts", () => ({
  searchJobCandidates: async () => { throw new Error("Paid search forbidden in offline tests"); },
}));
const { saveJobs } = await import("../src/services/jobSearchService.ts");

test("save path skips cross-site duplicates, preserves Applied, and stores distinct requisitions", async () => {
  const result = await saveJobs([
    { ...stored, company: "SIX Group AG", url: "https://ch.trabajo.org/job/second" },
    { ...stored, company: "Another company", url: "https://careers.ch/detail.php?jobId=ONE" },
    { ...stored, company: "Another company", url: "https://careers.ch/detail.php?jobId=TWO" },
  ]);
  expect(result.duplicates).toBe(1);
  expect(result.added).toHaveLength(2);
  expect(inserted).toHaveLength(2);
  expect(stored.status).toBe("Applied");
});