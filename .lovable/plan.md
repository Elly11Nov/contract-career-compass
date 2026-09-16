# Early Radar — Swiss recruiter & staffing channel (Stage 1)

Goal: Early Radar also finds real vacancies advertised by Swiss recruitment agencies on behalf of their clients, clearly labelled by recruiter and client. Job Search stays untouched.

## What I checked first

Existing Early Radar page and its three tabs, the radar data types, the web-scanning and AI-scoring pipeline used by Job Search, and the current database tables. Early Radar today has no data source and no tables of its own — it deliberately shows empty states.

## Recruiter sources verified (live check just now)

Reachable job/company pages found:
Hays Switzerland, Robert Half Switzerland, Coopers Group, Randstad Switzerland, Michael Page Switzerland, Adecco Switzerland, Nordwand Group, IQ Plus, One Agency, Albedis, Finders, SpeciTec, Experis Switzerland, Manpower Switzerland.

Could not reach a working page: IT Di-Visions (site did not respond on either address I tried).

For Experis, Manpower, One Agency, Albedis, Finders and SpeciTec only the main site answered, not a guessed job-listing address — so the exact listing page gets discovered from the site itself during the first run rather than invented. IT Di-Visions will be stored as flagged/unverified and never scanned until a real page is confirmed.

## What gets built

1. Two new database tables:
   - Monitored sources: name, type (Target employer / Recruiter & staffing / Watchlist), country, verified page address, verification status, last checked.
   - Radar vacancies: title, recruiter/source name, client company (or "Not disclosed"), city, country, employment type, language requirement (including "Unknown"), link, source published date, first detected date, relevance score and reason, role category, matching skills, verification status.
2. The recruiter seed list is inserted with the verified addresses above; unverified ones are marked so and excluded from scanning.
3. A recruiter scan that reads the verified recruiter pages with the existing scanning service, keeps only Swiss roles in Basel, Zurich, Bern, Geneva, Lausanne, Zug or Switzerland-wide/remote, and scores each vacancy with the same AI profile matching already used by Job Search (substantive overlap, not keyword hits).
4. Language rules: English-capable roles kept, including English plus Italian or French and German-as-advantage; vacancies where German is genuinely required are rejected; unclear cases stored as "Unknown" and never assumed English.
5. Deduplication on a normalised link plus company + title, so the same vacancy seen via employer site, LinkedIn or a recruiter is one entry with the extra sources kept alongside it. First detected date is always recorded separately from the employer's stated publication date.
6. Early Radar UI: keeps the current design, gains a source filter (All / Target Employers / Recruiters & Staffing / Watchlist) and shows recruiter jobs as `Title — Client X` or `Client: Not disclosed` with `Source: <recruiter>`, location, employment type and language on one compact line. A "Scan recruiters" button runs the scan.
7. Potential Opportunities stays empty — no speculative signals in this stage.
8. No example data anywhere. If a run finds nothing qualifying, the honest empty state stays.

## Testing before expanding

First run limited to three recruiters (Hays, Coopers, Michael Page). I report how many vacancies were read, how many qualified, and how many were rejected and why, then widen to the rest of the list.

## Technical notes

- Reuses `firecrawlRequest`, `scrapeAdvertisement`, `verifyVacancyUrl`, `normalizeVacancyUrl` and the Gemini scoring call from `src/services/jobSearch.server.ts` by extracting them for shared use — no behavioural change to Job Search.
- New `src/services/radarScan.server.ts` + `radarScan.functions.ts` server function; `radarService.ts` switches from empty arrays to reading the new tables.
- New tables `radar_sources` and `radar_vacancies` with authenticated-only policies and grants, matching the existing `jobs` table pattern.
- `src/types/radar.ts` extends `EarlyJob` with recruiter/client/employment type/language/source category fields.
