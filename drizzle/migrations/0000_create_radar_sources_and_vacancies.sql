CREATE TABLE public.radar_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_category TEXT NOT NULL DEFAULT 'Recruiter & Staffing',
  country TEXT NOT NULL DEFAULT 'Switzerland',
  site_url TEXT,
  jobs_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verification_note TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_sources TO authenticated;
GRANT ALL ON public.radar_sources TO service_role;
ALTER TABLE public.radar_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read radar sources" ON public.radar_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert radar sources" ON public.radar_sources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update radar sources" ON public.radar_sources FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete radar sources" ON public.radar_sources FOR DELETE TO authenticated USING (true);

CREATE TABLE public.radar_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_category TEXT NOT NULL DEFAULT 'Recruiter & Staffing',
  client_company TEXT NOT NULL DEFAULT 'Not disclosed',
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Switzerland',
  employment_type TEXT NOT NULL DEFAULT 'Unknown',
  language_requirement TEXT NOT NULL DEFAULT 'Unknown',
  url TEXT NOT NULL,
  url_key TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  extra_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_published_at TIMESTAMPTZ,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  relevance TEXT NOT NULL DEFAULT 'Low',
  relevance_score INTEGER NOT NULL DEFAULT 0,
  relevance_reason TEXT,
  role_category TEXT,
  matched_skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  verification_status TEXT NOT NULL DEFAULT 'verified',
  UNIQUE (url_key)
);

CREATE INDEX radar_vacancies_dedupe_key_idx ON public.radar_vacancies (dedupe_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_vacancies TO authenticated;
GRANT ALL ON public.radar_vacancies TO service_role;
ALTER TABLE public.radar_vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read radar vacancies" ON public.radar_vacancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert radar vacancies" ON public.radar_vacancies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update radar vacancies" ON public.radar_vacancies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete radar vacancies" ON public.radar_vacancies FOR DELETE TO authenticated USING (true);
