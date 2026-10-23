export type VacancyIdentity = {
  company: string; title: string; city: string; country: string; url: string;
  contract_type?: string;
};

const textKey = (value: string) => value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");

/** Verified aliases only; no fuzzy company matching or generic suffix stripping. */
export function companyKey(company: string): string {
  const key = textKey(company).replace(/[.,]/g, "");
  return key === "six group ag" ? "six" : key;
}

const TRACKING_PARAMS = /^(utm_|gclid|fbclid|mc_cid|mc_eid|_ga|trk|trackingid|src|source|campaign)/i;
export function normalizeVacancyUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const base = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
    const params = [...parsed.searchParams.entries()]
      .filter(([key, value]) => value !== "" && !TRACKING_PARAMS.test(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    return `${base}${params.length ? `?${params.join("&")}` : ""}`.toLowerCase();
  } catch {
    return rawUrl.toLowerCase();
  }
}

function identityKey(job: VacancyIdentity): string {
  return [companyKey(job.company), textKey(job.title), textKey(job.city), textKey(job.country), job.contract_type ?? ""].join("|");
}

function distinctRequisitions(a: string, b: string): boolean {
  try {
    const left = new URL(a), right = new URL(b);
    if (left.hostname !== right.hostname) return false;
    for (const [key, value] of left.searchParams) {
      if (!/^(refcode|job_?id|requisition_?id|req_?id|vacancy_?id|id)$/i.test(key)) continue;
      const other = right.searchParams.get(key);
      if (other && other !== value) return true;
    }
  } catch { /* Invalid URLs cannot provide requisition evidence. */ }
  return false;
}

export function isSameVacancy(a: VacancyIdentity, b: VacancyIdentity): boolean {
  if (normalizeVacancyUrl(a.url) === normalizeVacancyUrl(b.url)) return true;
  return identityKey(a) === identityKey(b) && !distinctRequisitions(a.url, b.url);
}