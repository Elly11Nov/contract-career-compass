import { createServerFn } from "@tanstack/react-start";

import type { SearchEngineResponse } from "./jobSearch.types";

/**
 * Runs the web search engine on the server (API keys never reach the browser)
 * and returns verified, scored candidate records. Persistence is done by the
 * client-side service layer through jobService.
 */
export const searchJobCandidates = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { maxQueries?: number; resultsPerQuery?: number; knownUrls?: string[] } | undefined) =>
      data ?? {},
  )
  .handler(async ({ data }): Promise<SearchEngineResponse> => {
    const { runSearchEngine, SearchProviderNotConfiguredError } = await import(
      "./jobSearch.server"
    );
    try {
      const result = await runSearchEngine(data);
      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job search failed.";
      const providerMissing = error instanceof SearchProviderNotConfiguredError;
      console.error("[jobSearch] run failed:", message);
      return { ok: false, error: message, provider_missing: providerMissing };
    }
  });
