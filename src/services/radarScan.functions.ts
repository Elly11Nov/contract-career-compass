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
      for (const candidate of result.candidates) {
        const { data: sameVacancy } = await supabase
          .from("radar_vacancies")
          .select("id, extra_sources")
          .eq("dedupe_key", candidate.dedupe_key)
          .maybeSingle();

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
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Recruiter scan failed.";
      const providerMissing =
        error instanceof Error && error.name === "SearchProviderNotConfiguredError";
      console.error("[radarScan] failed:", message);
      return { ok: false, error: message, provider_missing: providerMissing };
    }
  });
