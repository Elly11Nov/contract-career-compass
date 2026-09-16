import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExampleBadge, RadarStatusBadge, SkillChips } from "@/components/radar/RadarBadges";
import { formatDate, relativeDays } from "@/lib/job-utils";
import { supabase } from "@/integrations/supabase/client";
import {
  scanBusinessSignals,
  scanEmployerSources,
  scanRecruiterSources,
} from "@/services/radarScan.functions";
import type { SourceCategory } from "@/types/radar";
import {
  getEarlyJobs,
  getHiringHistory,
  getPotentialOpportunities,
  getTargetCompanies,
  isRealPublicUrl,
} from "@/services/radarService";

type SourceFilter = "All" | SourceCategory;

const SOURCE_FILTERS: SourceFilter[] = [
  "All",
  "Core Target Employers",
  "Target Employers",
  "Recruiters & Staffing",
  "Watchlist Employers",
];

export const Route = createFileRoute("/_authenticated/early-radar")({
  head: () => ({
    meta: [
      { title: "Early Radar — Hiring Signals & Early Vacancies" },
      {
        name: "description",
        content:
          "Early Radar surfaces relevant vacancies found on company career sites before the major job boards, plus companies showing hiring signals worth monitoring.",
      },
      { property: "og:title", content: "Early Radar — Hiring Signals & Early Vacancies" },
      {
        property: "og:description",
        content:
          "Early vacancies from company career pages, potential upcoming opportunities and target companies worth monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarlyRadarPage,
});

function Card({ children }: { children: React.ReactNode }) {
  return (
    <article className="bg-card border-border hover:border-primary/40 flex flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors">
      {children}
    </article>
  );
}

function Empty({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="bg-card border-border rounded-lg border border-dashed p-10 text-center">
      <p className="text-sm font-medium">{message}</p>
      {detail && <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">{detail}</p>}
    </div>
  );
}

function EarlyRadarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runScan = useServerFn(scanRecruiterSources);
  const runEmployerScan = useServerFn(scanEmployerSources);
  const runSignalScan = useServerFn(scanBusinessSignals);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All");
  const [scanning, setScanning] = useState<null | "recruiters" | "employers" | "signals">(null);

  const { data: allEarlyJobs = [] } = useQuery({
    queryKey: ["radar-early-jobs"],
    queryFn: getEarlyJobs,
  });
  const { data: opportunities = [] } = useQuery({
    queryKey: ["radar-opportunities"],
    queryFn: getPotentialOpportunities,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["radar-companies"],
    queryFn: getTargetCompanies,
  });
  const { data: allHistory = [] } = useQuery({
    queryKey: ["radar-history"],
    queryFn: getHiringHistory,
  });


  const earlyJobs = allEarlyJobs.filter(
    (job) => sourceFilter === "All" || job.source_category === sourceFilter,
  );
  const allCompanies = companies;
  const filteredCompanies = allCompanies.filter(
    (c) => sourceFilter === "All" || c.source_category === sourceFilter,
  );

  const handleScan = async () => {
    setScanning(true);
    try {
      const summary = await runScan({ data: {} });
      if (!summary.ok) {
        toast.error(summary.error ?? "The recruiter scan could not be completed.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["radar-early-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["radar-companies"] });
      toast.success(
        `Checked ${summary.sources_scanned?.length ?? 0} agencies · read ${summary.examined ?? 0} vacancies · ${summary.stored ?? 0} added · ${summary.rejected ?? 0} not relevant`,
      );
    } catch {
      toast.error("The recruiter scan could not be completed.");
    } finally {
      setScanning(false);
    }
  };

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-surface-header text-surface-header-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Early Radar</h1>
            <p className="text-surface-header-foreground/70 mt-0.5 text-sm">
              Vacancies spotted on company career sites before the big boards, plus companies
              showing hiring signals worth monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              <Button size="sm" variant="ghost" asChild>
                <Link to="/">Job dashboard</Link>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link to="/early-radar">Early Radar</Link>
              </Button>
            </nav>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 lg:px-8">
        <div className="bg-card border-warning/40 rounded-lg border p-4 text-sm">
          <p className="font-medium">Real data only</p>
          <p className="text-muted-foreground mt-1">
            Only vacancies that were actually opened and verified on a public source appear here.
            Recruitment agencies are shown as the <em>source</em>, never as the employer. Potential
            opportunities stay empty until real hiring-signal detection is added — nothing here
            claims that a company will advertise a role.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {SOURCE_FILTERS.map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={sourceFilter === filter ? "secondary" : "ghost"}
                onClick={() => setSourceFilter(filter)}
              >
                {filter}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={handleScan} disabled={scanning}>
            {scanning ? "Checking agencies…" : "Scan recruiters"}
          </Button>
        </div>


        <Tabs defaultValue="early-jobs">
          <TabsList className="flex-wrap">
            <TabsTrigger value="early-jobs">🔥 Early jobs ({earlyJobs.length})</TabsTrigger>
            <TabsTrigger value="opportunities">
              🚨 Potential opportunities ({opportunities.length})
            </TabsTrigger>
            <TabsTrigger value="companies">
              ⭐ Monitored sources ({filteredCompanies.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="early-jobs">
              {earlyJobs.length === 0 ? (
                <Empty
                  message="No verified Early Radar vacancies yet."
                  detail="Use “Scan recruiters” to read the verified Swiss agency job pages. Only vacancies that open on a real page, are located in Switzerland and genuinely overlap your profile are added."
                />
              ) : (
                <div className="grid gap-3">
                  {earlyJobs.map((job) => (
                    <Card key={job.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold leading-tight">
                              {job.title}
                              {job.source_category === "Recruiters & Staffing" &&
                                ` — ${job.company === "Not disclosed" ? "Client undisclosed" : job.company}`}
                            </h2>
                            {job.is_example && <ExampleBadge />}
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {job.source_category === "Recruiters & Staffing"
                              ? `Client: ${job.company}`
                              : job.company}{" "}
                            · 📍 {job.city}, {job.country}
                          </p>
                        </div>
                        <RadarStatusBadge status={job.relevance} label="Relevance" />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.potential_roles.map((r) => (
                          <Badge key={r} variant="outline">
                            {r}
                          </Badge>
                        ))}
                        <Badge variant="outline">{job.employment_type}</Badge>
                        <Badge variant="outline">{job.language_requirement}</Badge>
                        <Badge variant="secondary">Source: {job.source}</Badge>
                        {job.other_sources.map((s) => (
                          <Badge key={s.source} variant="outline">
                            Also via {s.source}
                          </Badge>
                        ))}
                        {job.source_category === "Recruiters & Staffing" ? null : job
                            .seen_on_linkedin_at === null ? (
                          <Badge className="bg-primary text-primary-foreground">
                            Not seen on LinkedIn yet
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            On LinkedIn after{" "}
                            {job.lead_time_days === null ? "?" : job.lead_time_days} day(s)
                          </Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {job.relevance_reason}
                      </p>
                      <SkillChips skills={job.matched_skills} />

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <span className="text-muted-foreground text-xs">
                          First detected {formatDate(job.first_detected_at)} ·{" "}
                          {relativeDays(job.first_detected_at)}
                          {job.published_at && ` · company posted ${formatDate(job.published_at)}`}
                        </span>
                        {isRealPublicUrl(job.url) ? (
                          <Button size="sm" asChild>
                            <a href={job.url} target="_blank" rel="noopener noreferrer">
                              Open vacancy
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No verified link</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="opportunities">
              {opportunities.length === 0 ? (
                <Empty
                  message="No hiring signals detected yet."
                  detail="When public signals are found — repeated analysis or documentation hiring, transformation or AI programmes, new products or reorganisations — the company appears here as a possible upcoming role worth monitoring."
                />
              ) : (
                <div className="grid gap-3">
                  {opportunities.map((opp) => (
                    <Card key={opp.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold leading-tight">{opp.company}</h2>
                            {opp.is_example && <ExampleBadge />}
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {opp.country} · possible upcoming role, no vacancy found
                          </p>
                        </div>
                        <RadarStatusBadge status={opp.radar_status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {opp.potential_roles.map((r) => (
                          <Badge key={r} variant="outline">
                            {r}
                          </Badge>
                        ))}
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide">
                          Signals detected
                        </p>
                        <ul className="text-muted-foreground mt-1.5 space-y-1.5 text-sm">
                          {opp.signals.map((s, i) => (
                            <li key={i} className="flex flex-wrap items-baseline gap-2">
                              <Badge variant="secondary">{s.category}</Badge>
                              <span>{s.description}</span>
                              <span className="text-xs">
                                ({s.source} · {formatDate(s.detected_at)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide">
                          Why it may be relevant
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {opp.why_relevant}
                        </p>
                      </div>
                      <SkillChips skills={opp.matched_skills} />

                      <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <span className="text-muted-foreground text-xs">
                          Detected {formatDate(opp.detected_at)} · {relativeDays(opp.detected_at)}
                        </span>
                        <Badge variant="outline">Worth monitoring</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="companies">
              {filteredCompanies.length === 0 ? (
                <Empty
                  message="No monitored sources in this view."
                  detail="Swiss recruitment agencies and employers being monitored appear here with their real job page link and whether that page has been confirmed reachable."
                />
              ) : (
                <div className="grid gap-3">
                  {filteredCompanies.map((c) => (
                    <Card key={c.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold leading-tight">{c.company}</h2>
                            {c.is_example && <ExampleBadge />}
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {c.country} · {c.industry}
                          </p>
                        </div>
                        <Badge
                          variant={c.verification_status === "verified" ? "secondary" : "outline"}
                        >
                          {c.verification_status === "verified"
                            ? "Job page confirmed"
                            : c.verification_status === "site_only"
                              ? "Site only"
                              : "Not reachable"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{c.source_category}</Badge>
                      </div>

                      {c.verification_note && (
                        <p className="text-muted-foreground text-sm">{c.verification_note}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <span className="text-muted-foreground text-xs">
                          Last checked {formatDate(c.last_checked_at)} ·{" "}
                          {relativeDays(c.last_checked_at)}
                        </span>
                        {isRealPublicUrl(c.careers_url) ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={c.careers_url!} target="_blank" rel="noopener noreferrer">
                              Job page
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">No verified page</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
