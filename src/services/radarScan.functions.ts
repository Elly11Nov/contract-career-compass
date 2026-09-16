import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RecruiterScanSummary {
  ok: boolean;
  error?: string;
  provider_missing?: boolean;
  sources_scanned?: string[];
  sources_skipped?: { name: string; reason: string }[];
  examined?: number;
  qualified?: number;
  rejected?: number;
  stored?: number;
  duplicates?: number;
  /** Adverts found but already closed: kept as hiring history, not current jobs. */
  closed_kept?: number;
}

/**
 * Reads the verified recruiter job pages, scores each real vacancy against the
 * candidate profile and stores only verified results. Nothing is fabricated:
 * a vacancy that cannot be opened or verified is rejected.
 */
export const scanRecruiterSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; sourceNames?: string[] } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<RecruiterScanSummary> => {
    const { runRecruiterScan } = await import("./radarScan.server");
    const supabase = context.supabase;

    try {
      let sourceQuery = supabase
        .from("radar_sources")
        .select("id, name, source_category, site_url, jobs_url")
        .eq("source_category", "Recruiters & Staffing")
        .eq("enabled", true)
        .in("verification_status", ["verified", "site_only"]);
      if (data.sourceNames?.length) sourceQuery = sourceQuery.in("name", data.sourceNames);

      const { data: sources, error: sourceError } = await sourceQuery;
      if (sourceError) throw sourceError;
      if (!sources || sources.length === 0) {
        return { ok: false, error: "No verified recruiter sources are available to scan." };
      }

      const selected = sources.slice(0, data.limit ?? sources.length);

      const { data: existing } = await supabase.from("radar_vacancies").select("url_key");
      const knownUrlKeys = (existing ?? []).map((row) => row.url_key);

      const result = await runRecruiterScan({ sources: selected, knownUrlKeys });

      let stored = 0;
      let duplicates = 0;
      let closedKept = 0;
      for (const candidate of result.candidates) {
        const { data: sameVacancy } = await supabase
          .from("radar_vacancies")
          .select("id, extra_sources")
          .eq("dedupe_key", candidate.dedupe_key)
          .maybeSingle();

        if (!candidate.is_open) {
          // Closed/expired advert: keep it as hiring-history evidence only and
          // make sure it is not shown (or left) as a current vacancy.
          if (sameVacancy) await supabase.from("radar_vacancies").delete().eq("id", sameVacancy.id);
          await supabase.from("radar_hiring_history").upsert(
            {
              company: candidate.client_company,
              source_name: candidate.source_name,
              source_category: candidate.source_category,
              title: candidate.title,
              city: candidate.city,
              country: candidate.country,
              employment_type: candidate.employment_type,
              language_requirement: candidate.language_requirement,
              url: candidate.url,
              url_key: candidate.url_key,
              advertised_at: candidate.source_published_at,
              relevance: candidate.relevance,
              relevance_score: candidate.relevance_score,
              relevance_reason: candidate.relevance_reason,
              role_category: candidate.role_category,
              matched_skills: candidate.matched_skills,
              is_current: false,
              verification_status: candidate.verification_status,
            },
            { onConflict: "url_key" },
          );
          closedKept += 1;
          continue;
        }

        if (sameVacancy) {
          // Same vacancy already known through another source: record the extra
          // source instead of creating a second Early Radar entry.
          const extras = Array.isArray(sameVacancy.extra_sources)
            ? (sameVacancy.extra_sources as unknown[])
            : [];
          const already = extras.some(
            (e) => (e as { source?: string })?.source === candidate.source_name,
          );
          await supabase
            .from("radar_vacancies")
            .update({
              last_seen_at: new Date().toISOString(),
              extra_sources: already
                ? (extras as never)
                : ([
                    ...extras,
                    { source: candidate.source_name, url: candidate.url },
                  ] as never),
            })
            .eq("id", sameVacancy.id);
          duplicates += 1;
          continue;
        }

        const { error: insertError } = await supabase.from("radar_vacancies").insert({
          title: candidate.title,
          source_name: candidate.source_name,
          source_category: candidate.source_category,
          client_company: candidate.client_company,
          city: candidate.city,
          country: candidate.country,
          employment_type: candidate.employment_type,
          language_requirement: candidate.language_requirement,
          url: candidate.url,
          url_key: candidate.url_key,
          dedupe_key: candidate.dedupe_key,
          source_published_at: candidate.source_published_at,
          relevance: candidate.relevance,
          relevance_score: candidate.relevance_score,
          relevance_reason: candidate.relevance_reason,
          role_category: candidate.role_category,
          matched_skills: candidate.matched_skills,
          verification_status: candidate.verification_status,
        });
        if (insertError) {
          if (insertError.code === "23505") {
            duplicates += 1;
            continue;
          }
          throw insertError;
        }
        stored += 1;
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from("radar_sources")
        .update({ last_checked_at: nowIso })
        .in(
          "name",
          selected.map((s) => s.name),
        );

      await supabase.from("search_runs").insert({
        search_criteria: {
          scan_type: "early_radar_recruiters",
          source_category: "Recruiters & Staffing",
          companies: selected.map((s) => s.name),
        },
        jobs_found: result.examined,
        jobs_added: stored,
        jobs_removed: closedKept,
      });


      console.log("[radarScan] diagnostics:", JSON.stringify(result.diagnostics).slice(0, 4_000));

      return {
        ok: true,
        sources_scanned: result.sources_scanned,
        sources_skipped: result.sources_skipped,
        examined: result.examined,
        qualified: result.qualified,
        rejected: result.rejected,
        stored,
        duplicates,
        closed_kept: closedKept,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recruiter scan failed.";
      const providerMissing =
        error instanceof Error && error.name === "SearchProviderNotConfiguredError";
      console.error("[radarScan] failed:", message);
      return { ok: false, error: message, provider_missing: providerMissing };
    }
  });

export interface SignalScanSummary {
  ok: boolean;
  error?: string;
  provider_missing?: boolean;
  sources_scanned?: string[];
  examined?: number;
  qualified?: number;
  rejected?: number;
  stored?: number;
  duplicates?: number;
}

/**
 * Scans monitored employers (core targets or watchlist) for real, currently
 * advertised vacancies, and records every qualifying advert in the hiring
 * history so recent hiring patterns become visible. Nothing is invented.
 */
export const scanEmployerSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { category?: string; limit?: number; sourceNames?: string[] } | undefined) => data ?? {},
  )
  .handler(async ({ data, context }): Promise<RecruiterScanSummary> => {
    const { runSourceScan } = await import("./radarScan.server");
    const supabase = context.supabase;
    const category = data.category ?? "Core Target Employers";

    try {
      let sourceQuery = supabase
        .from("radar_sources")
        .select("id, name, source_category, site_url, jobs_url, last_checked_at")
        .eq("source_category", category)
        .eq("enabled", true)
        .in("verification_status", ["verified", "site_only"])
        // Rotate: companies never checked (or checked longest ago) come first,
        // so repeated scans move through the employer list instead of
        // re-reading the same three companies every time.
        .order("last_checked_at", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true });
      if (data.sourceNames?.length) sourceQuery = sourceQuery.in("name", data.sourceNames);

      const { data: sources, error: sourceError } = await sourceQuery;
      if (sourceError) throw sourceError;
      if (!sources?.length) {
        return { ok: false, error: `No monitored sources available in "${category}".` };
      }
      // Spend the small per-scan budget on companies with a real job page first.
      const ordered = [
        ...sources.filter((s) => s.jobs_url),
        ...sources.filter((s) => !s.jobs_url),
      ];
      const selected = ordered.slice(0, data.limit ?? 3);


      const { data: existing } = await supabase.from("radar_vacancies").select("url_key");
      const knownUrlKeys = (existing ?? []).map((r) => r.url_key);

      const result = await runSourceScan({ sources: selected, knownUrlKeys });

      let stored = 0;
      let duplicates = 0;
      let closedKept = 0;
      for (const candidate of result.candidates) {
        const { data: same } = await supabase
          .from("radar_vacancies")
          .select("id")
          .eq("dedupe_key", candidate.dedupe_key)
          .maybeSingle();

        if (!candidate.is_open) {
          // Closed/expired: never a current vacancy. Remove any stale current
          // entry, but keep the advert as hiring-history evidence below.
          if (same) await supabase.from("radar_vacancies").delete().eq("id", same.id);
          closedKept += 1;
        } else if (same) {
          await supabase
            .from("radar_vacancies")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", same.id);
          duplicates += 1;
        } else {
          const { error: insertError } = await supabase.from("radar_vacancies").insert({
            title: candidate.title,
            source_name: candidate.source_name,
            source_category: candidate.source_category,
            client_company: candidate.client_company,
            city: candidate.city,
            country: candidate.country,
            employment_type: candidate.employment_type,
            language_requirement: candidate.language_requirement,
            url: candidate.url,
            url_key: candidate.url_key,
            dedupe_key: candidate.dedupe_key,
            source_published_at: candidate.source_published_at,
            relevance: candidate.relevance,
            relevance_score: candidate.relevance_score,
            relevance_reason: candidate.relevance_reason,
            role_category: candidate.role_category,
            matched_skills: candidate.matched_skills,
            verification_status: candidate.verification_status,
          });
          if (insertError && insertError.code !== "23505") throw insertError;
          if (insertError) duplicates += 1;
          else stored += 1;
        }

        // Hiring-history evidence: this company really advertised this role.
        await supabase.from("radar_hiring_history").upsert(
          {
            company: candidate.client_company,
            source_name: candidate.source_name,
            source_category: candidate.source_category,
            title: candidate.title,
            city: candidate.city,
            country: candidate.country,
            employment_type: candidate.employment_type,
            language_requirement: candidate.language_requirement,
            url: candidate.url,
            url_key: candidate.url_key,
            advertised_at: candidate.source_published_at,
            relevance: candidate.relevance,
            relevance_score: candidate.relevance_score,
            relevance_reason: candidate.relevance_reason,
            role_category: candidate.role_category,
            matched_skills: candidate.matched_skills,
            is_current: candidate.is_open,
            verification_status: candidate.verification_status,
          },
          { onConflict: "url_key" },
        );
      }

      await supabase
        .from("radar_sources")
        .update({ last_checked_at: new Date().toISOString() })
        .in(
          "name",
          selected.map((s) => s.name),
        );

      // Record which scan type ran, over which companies, so employer runs are
      // distinguishable from recruiter runs in the history.
      await supabase.from("search_runs").insert({
        search_criteria: {
          scan_type: "early_radar_employers",
          source_category: category,
          companies: selected.map((s) => s.name),
        },
        jobs_found: result.examined,
        jobs_added: stored,
        jobs_removed: closedKept,
      });


      return {
        ok: true,
        sources_scanned: result.sources_scanned,
        sources_skipped: result.sources_skipped,
        examined: result.examined,
        qualified: result.qualified,
        rejected: result.rejected,
        stored,
        duplicates,
        closed_kept: closedKept,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Employer scan failed.";
      const providerMissing =
        error instanceof Error && error.name === "SearchProviderNotConfiguredError";
      console.error("[radarScan:employer] failed:", message);
      return { ok: false, error: message, provider_missing: providerMissing };
    }
  });

/**
 * Collects public business and transformation evidence for monitored companies.
 * Signals are things to monitor — never a prediction that a role will appear.
 */
export const scanBusinessSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { category?: string; limit?: number; sourceNames?: string[] } | undefined) => data ?? {},
  )
  .handler(async ({ data, context }): Promise<SignalScanSummary> => {
    const { runSignalScan } = await import("./radarScan.server");
    const supabase = context.supabase;

    try {
      let sourceQuery = supabase
        .from("radar_sources")
        .select("id, name, source_category, site_url, jobs_url")
        .eq("enabled", true);
      if (data.category) sourceQuery = sourceQuery.eq("source_category", data.category);
      if (data.sourceNames?.length) sourceQuery = sourceQuery.in("name", data.sourceNames);

      const { data: sources, error: sourceError } = await sourceQuery;
      if (sourceError) throw sourceError;
      if (!sources?.length) return { ok: false, error: "No monitored companies to check." };
      const selected = sources.slice(0, data.limit ?? 3);

      const { data: existing } = await supabase.from("radar_signals").select("url_key");
      const result = await runSignalScan({
        sources: selected,
        knownUrlKeys: (existing ?? []).map((r) => r.url_key),
      });

      let stored = 0;
      let duplicates = 0;
      for (const signal of result.signals) {
        const { error: insertError } = await supabase.from("radar_signals").insert(signal);
        if (insertError) {
          if (insertError.code === "23505") {
            duplicates += 1;
            continue;
          }
          throw insertError;
        }
        stored += 1;
      }

      await supabase
        .from("radar_sources")
        .update({ last_checked_at: new Date().toISOString() })
        .in(
          "name",
          selected.map((s) => s.name),
        );

      return {
        ok: true,
        sources_scanned: result.sources_scanned,
        examined: result.examined,
        qualified: result.qualified,
        rejected: result.rejected,
        stored,
        duplicates,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signal scan failed.";
      const providerMissing =
        error instanceof Error && error.name === "SearchProviderNotConfiguredError";
      console.error("[radarScan:signals] failed:", message);
      return { ok: false, error: message, provider_missing: providerMissing };
    }
  });
