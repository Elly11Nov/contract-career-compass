import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExampleBadge, RadarStatusBadge, SkillChips } from "@/components/radar/RadarBadges";
import { formatDate, relativeDays } from "@/lib/job-utils";
import { supabase } from "@/integrations/supabase/client";
import {
  getEarlyJobs,
  getPotentialOpportunities,
  getTargetCompanies,
  isRealPublicUrl,
} from "@/services/radarService";

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

  const { data: earlyJobs = [] } = useQuery({
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
          <p className="font-medium">Phase 1 — illustrative example data</p>
          <p className="text-muted-foreground mt-1">
            Everything on this page is marked <strong>Example data</strong> and is separate from
            your real job list. Signals are evidence that a relevant role <em>may</em> be needed —
            never a statement that a company will advertise a role.
          </p>
        </div>

        <Tabs defaultValue="early-jobs">
          <TabsList className="flex-wrap">
            <TabsTrigger value="early-jobs">🔥 Early jobs ({earlyJobs.length})</TabsTrigger>
            <TabsTrigger value="opportunities">
              🚨 Potential opportunities ({opportunities.length})
            </TabsTrigger>
            <TabsTrigger value="companies">⭐ Target companies ({companies.length})</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="early-jobs">
              {earlyJobs.length === 0 ? (
                <Empty message="No early vacancies detected yet." />
              ) : (
                <div className="grid gap-3">
                  {earlyJobs.map((job) => (
                    <Card key={job.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold leading-tight">{job.title}</h2>
                            {job.is_example && <ExampleBadge />}
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {job.company} · {job.city}, {job.country}
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
                        <Badge variant="outline">{job.source}</Badge>
                        {job.seen_on_linkedin_at === null ? (
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
                        <Button size="sm" asChild>
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            Open vacancy
                          </a>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="opportunities">
              {opportunities.length === 0 ? (
                <Empty message="No hiring signals detected yet." />
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
              {companies.length === 0 ? (
                <Empty message="No target companies yet." />
              ) : (
                <div className="grid gap-3">
                  {companies.map((c) => (
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
                        <RadarStatusBadge status={c.radar_status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.role_categories.map((r) => (
                          <Badge key={r} variant="outline">
                            {r}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide">
                            Previous relevant hiring
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {c.previous_relevant_hiring.join(" · ") || "None recorded"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide">
                            Current signals
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {c.current_signals.join(" · ") || "None detected"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <span className="text-muted-foreground text-xs">
                          Last checked {formatDate(c.last_checked_at)} ·{" "}
                          {relativeDays(c.last_checked_at)}
                        </span>
                        {c.careers_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={c.careers_url} target="_blank" rel="noopener noreferrer">
                              Careers page
                            </a>
                          </Button>
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
