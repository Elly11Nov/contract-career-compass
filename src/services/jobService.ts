/**
 * Job data service layer.
 *
 * This is the ONLY place the UI touches job data. Swap the mock source below
 * for a real AI/search backend (fetch / server function) without touching any
 * component: keep the exported function signatures identical.
 */
import { mockJobs, mockSearchHistory } from "@/data/mockJobs";
import type { Job, JobStatus, SearchRun } from "@/types/job";

const STATUS_KEY = "cjf.job-status.v1";
const VISIT_KEY = "cjf.last-visit.v1";

const isBrowser = () => typeof window !== "undefined";

function readStatusMap(): Record<string, JobStatus> {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(STATUS_KEY) ?? "{}") as Record<
      string,
      JobStatus
    >;
  } catch {
    return {};
  }
}

function writeStatusMap(map: Record<string, JobStatus>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STATUS_KEY, JSON.stringify(map));
}

function withStatus(job: Job): Job {
  const status = readStatusMap()[job.id];
  return status ? { ...job, status } : job;
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function getJobs(): Promise<Job[]> {
  await delay();
  return mockJobs.map(withStatus);
}

export async function getJob(id: string): Promise<Job | null> {
  await delay(60);
  const job = mockJobs.find((j) => j.id === id);
  return job ? withStatus(job) : null;
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
  const map = readStatusMap();
  map[id] = status;
  writeStatusMap(map);
  return getJob(id);
}

export async function getSearchHistory(): Promise<SearchRun[]> {
  await delay(60);
  return mockSearchHistory;
}

export function getLastVisit(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(VISIT_KEY);
}

export function markVisit() {
  if (!isBrowser()) return;
  window.localStorage.setItem(VISIT_KEY, new Date().toISOString());
}

export const jobService = {
  getJobs,
  getJob,
  updateJobStatus,
  getSearchHistory,
};