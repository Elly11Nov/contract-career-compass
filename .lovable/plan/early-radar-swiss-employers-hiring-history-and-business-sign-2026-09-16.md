# Early Radar — Swiss employers, hiring history and business signals

## What already exists (kept exactly as it is)

- Recruiter scanning that works end to end: Swiss location handling, reading each agency's own job page to find individual vacancy links, opening and verifying every link, and scoring each advertisement against your profile.
- All 15 Swiss agencies already stored with their real status (confirmed job page / site only / not reachable), including the two real Hays vacancies found in the live test.
- The Early Radar page with its filters, cards, honest empty states, and the "Scan recruiters" button.
- Job Search is untouched.

None of this gets rebuilt or duplicated.

## Conflicts I need to flag before changing anything

1. **Category names.** Today Early Radar has three groups: Target Employers, Recruiters & Staffing, Watchlist. Your new list has four: Core Target Employers, Target Employers, Watchlist Employers, Recruiters & Staffing. I will add "Core Target Employers" and rename the display label "Watchlist" to "Watchlist Employers", keeping the stored values compatible so nothing already saved breaks.
2. **Potential Opportunities was agreed to stay empty.** Your new point D asks for business and transformation signals, which is exactly that tab. So this reverses the earlier decision — I will now fill that tab with real, sourced public evidence only, each item labelled as a signal to monitor, never as a prediction or a vacancy.
3. **Cost.** Hiring history over 12 months plus signals across 37 new companies means many more page reads and AI checks than the recruiter scan. Each full pass will use a noticeable amount of credit and takes several minutes. I will therefore run employers in small batches with separate buttons rather than one giant scan.
4. **Your message was cut off** at "If a recruiter does not have a usable public source that Firecrawl can access, mark". I will keep the existing behaviour: such a source is stored as not reachable, is never scanned, and no URL is ever invented. Tell me if you meant something else.

## What gets built

1. **Employer seed lists** stored as monitored sources: 25 Core Target Employers and 12 Watchlist Employers, each with its real verified careers page. Every company is checked live first; anything unreachable is stored as unverified and excluded from scanning. No invented addresses.
2. **Employer vacancy scan** reusing the recruiter pipeline unchanged: read the careers page, discover individual vacancy links, open and verify each one, score it substantively. The employer is the company itself, not a client. Same Swiss location and language rules (English-sufficient kept; genuinely German-required rejected; unclear stays "Unknown").
3. **Hiring history (15 Sep 2025 – 16 Sep 2026):** a new record type storing relevant roles a company advertised in that window — title, employment type, location, language, source link, publication date. Permanent, contract, freelance, interim, temporary and fixed-term all count. Only entries backed by a real page are stored; expired advertisements are kept as history, clearly marked as past, never shown as current vacancies.
4. **Business and transformation signals:** for each monitored company, public evidence of transformation, AI programmes, major technology projects, new platforms, acquisitions, expansion or new teams. Each signal stores what was found, where, its date and its link, and is presented as evidence worth monitoring with cautious wording. Anything without a working public source is discarded.
5. **Early Radar UI additions**, in the existing design: the four source filters, a "Hiring history" tab showing past relevant roles per company with dates and links, signals filling the Potential Opportunities tab, and separate scan buttons for recruiters, employers and signals so you control what you spend.
6. **Fides** stays on the watchlist with a neutral note that its past adverts combined requirements engineering and technical writing with English and German, and that each future vacancy is judged individually. Nothing is stated as company policy.
7. Deduplication stays as it is: one entry per vacancy across employer, agency and other channels, with alternate sources kept and first-detected date separate from the company's stated publication date.

## Testing

I verify every employer URL live, then run the employer scan and the signal scan on a small batch first, and report how many pages were read, how many vacancies and signals qualified, and what was rejected and why — before widening to the whole list.

## Technical notes

- New tables `radar_hiring_history` and `radar_signals` with authenticated-only policies and grants, matching the existing radar tables.
- `radarScan.server.ts` gains an employer mode and a signals mode reusing `firecrawlRequest`, `discoverFromListing`, `verifyVacancyUrl`, `normalizeVacancyUrl` and the existing AI scoring; recruiter behaviour is unchanged.
- `radar_sources.source_category` accepts "Core Target Employers" and "Watchlist Employers"; `radarService.ts` and `src/types/radar.ts` extend the category union, with existing values mapped so stored rows keep working.
- No change to Job Search, its criteria, scoring, schema or authentication.
