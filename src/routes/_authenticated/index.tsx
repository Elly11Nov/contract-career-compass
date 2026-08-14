import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DashboardStats } from "@/components/jobs/DashboardStats";
import { FilterBar } from "@/components/jobs/FilterBar";
import { JobDetail } from "@/components/jobs/JobDetail";
import { SavedJobs } from "@/components/jobs/SavedJobs";
import { SearchHistory } from "@/components/jobs/SearchHistory";
import {
  getJobs,
  getSearchHistory,
  getLastVisit,
  markVisit,
  updateJobStatus,
} from "@/services/jobService";
import { filterJobs, isNewSince, isQualifying } from "@/lib/job-utils";
import { runJobSearch } from "@/services/jobSearchService";
import type { Job, JobFilters, JobStatus } from "@/types/job";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Contract Job Finder — Daily Contract Vacancy Dashboard" },
      {
        name: "description",
        content:
          "Daily dashboard of English-language contract, freelance and interim Technical Writer and Business Analyst vacancies across Germany, France, Sweden, Denmark and Finland.",
      },
      { property: "og:title", content: "Contract Job Finder" },
      {
        property: "og:description",
        content:
          "Scored, filtered contract vacancies for technical writing and business analysis roles across the Nordics, Germany and France.",
      },
    ],
  }),
  component: Dashboard,
});

const defaultFilters: JobFilters = {
  roles: [],
  countries: [],
  contract_types: [],
  work_models: [],
  max_age_days: 15,
  min_match_score: 0,
};

function Dashboard() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<JobFilters>(defaultFilters);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  useEffect(() => {
    setLastVisit(getLastVisit());
    markVisit();
  }, []);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["jobs"], queryFn: getJobs });
  const { data: history = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: getSearchHistory,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) => updateJobStatus(id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      if (updated) setSelected((cur) => (cur && cur.id === updated.id ? updated : cur));
    },
  });

  const onStatusChange = (id: string, status: JobStatus) => statusMutation.mutate({ id, status });

  const searchMutation = useMutation({
    mutationFn: () => runJobSearch(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.provider_missing ? "Web search provider not configured" : "Search failed",
          { description: result.error },
        );
        return;
      }
      toast.success(`Search complete — ${result.jobs_added} new job(s) added`, {
        description: `${result.examined} advertisements examined · ${result.jobs_found} qualifying · ${result.duplicates} duplicate(s) skipped`,
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
    onError: (error: Error) => toast.error("Search failed", { description: error.message }),
  });

  const visible = useMemo(() => filterJobs(jobs, filters, query), [jobs, filters, query]);
  const qualifying = useMemo(() => visible.filter(isQualifying), [visible]);
  const newJobs = useMemo(
    () => visible.filter((j) => isNewSince(j, lastVisit)),
    [visible, lastVisit],
  );

  const byStatus = (s: JobStatus) => visible.filter((j) => j.status === s);

  const stats = useMemo(() => {
    const qualifyingAll = jobs.filter(isQualifying);
    return {
      newCount: jobs.filter((j) => isNewSince(j, lastVisit)).length,
      qualifyingCount: qualifyingAll.length,
      tw: qualifyingAll.filter((j) => j.role_category === "Technical Writer").length,
      ba: qualifyingAll.filter((j) => j.role_category === "Business Analyst").length,
      countries: [...new Set(qualifyingAll.map((j) => j.country))].sort(),
    };
  }, [jobs, lastVisit]);

  const lastUpdated = history[0]?.run_date ?? new Date().toISOString();

  const sortByScore = (list: Job[]) => [...list].sort((a, b) => b.match_score - a.match_score);

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-surface-header text-surface-header-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Contract Job Finder</h1>
            <p className="text-surface-header-foreground/70 mt-0.5 text-sm">
              Contract, freelance and interim documentation & analysis roles — Germany, France,
              Sweden, Denmark, Finland
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">English working language · last 15 days</Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending}
            >
              {searchMutation.isPending ? "Searching…" : "Run search"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 lg:px-8">
        <DashboardStats
          lastUpdated={lastUpdated}
          newCount={stats.newCount}
          qualifyingCount={stats.qualifyingCount}
          technicalWriterCount={stats.tw}
          businessAnalystCount={stats.ba}
          countries={stats.countries}
        />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          query={query}
          onQueryChange={setQuery}
          resultCount={visible.length}
        />

        <Tabs defaultValue="new">
          <TabsList className="flex-wrap">
            <TabsTrigger value="new">New today ({newJobs.length})</TabsTrigger>
            <TabsTrigger value="all">Last 15 days ({qualifying.length})</TabsTrigger>
            <TabsTrigger value="saved">Saved ({byStatus("Interested").length})</TabsTrigger>
            <TabsTrigger value="applied">Applied ({byStatus("Applied").length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({byStatus("Rejected").length})</TabsTrigger>
            <TabsTrigger value="history">Search history</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {isLoading ? (
              <div className="text-muted-foreground bg-card rounded-lg border p-10 text-center text-sm">
                Loading jobs…
              </div>
            ) : (
              <>
                <TabsContent value="new">
                  <SavedJobs
                    jobs={sortByScore(newJobs)}
                    emptyMessage="No new jobs since your previous visit."
                    onOpen={setSelected}
                    onStatusChange={onStatusChange}
                    isNew={() => true}
                  />
                </TabsContent>
                <TabsContent value="all">
                  <SavedJobs
                    jobs={sortByScore(qualifying)}
                    emptyMessage="No qualifying jobs match the current filters."
                    onOpen={setSelected}
                    onStatusChange={onStatusChange}
                    isNew={(job) => isNewSince(job, lastVisit)}
                  />
                </TabsContent>
                <TabsContent value="saved">
                  <SavedJobs
                    jobs={sortByScore(byStatus("Interested"))}
                    emptyMessage="Mark jobs as Interested to save them here."
                    onOpen={setSelected}
                    onStatusChange={onStatusChange}
                  />
                </TabsContent>
                <TabsContent value="applied">
                  <SavedJobs
                    jobs={sortByScore([...byStatus("Applied"), ...byStatus("Interview")])}
                    emptyMessage="No applications yet."
                    onOpen={setSelected}
                    onStatusChange={onStatusChange}
                  />
                </TabsContent>
                <TabsContent value="rejected">
                  <SavedJobs
                    jobs={sortByScore([...byStatus("Rejected"), ...byStatus("Closed")])}
                    emptyMessage="Nothing rejected yet."
                    onOpen={setSelected}
                    onStatusChange={onStatusChange}
                  />
                </TabsContent>
                <TabsContent value="history">
                  <SearchHistory runs={history} />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </main>

      <JobDetail
        job={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
