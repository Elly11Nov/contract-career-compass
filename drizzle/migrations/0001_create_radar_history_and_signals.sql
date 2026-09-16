CREATE TABLE public.radar_hiring_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  source_name text NOT NULL,
  source_category text NOT NULL DEFAULT 'Core Target Employers',
  title text NOT NULL,
  city text,
  country text NOT NULL DEFAULT 'Switzerland',
  employment_type text NOT NULL DEFAULT 'Unknown',
  language_requirement text NOT NULL DEFAULT 'Unknown',
  url text NOT NULL,
  url_key text NOT NULL UNIQUE,
  advertised_at timestamptz,
  relevance text NOT NULL DEFAULT 'Low',
  relevance_score integer NOT NULL DEFAULT 0,
  relevance_reason text,
  role_category text,
  matched_skills text[] NOT NULL DEFAULT '{}'::text[],
  is_current boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'verified',
  first_detected_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_hiring_history TO authenticated;
GRANT ALL ON public.radar_hiring_history TO service_role;
ALTER TABLE public.radar_hiring_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read hiring history" ON public.radar_hiring_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert hiring history" ON public.radar_hiring_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update hiring history" ON public.radar_hiring_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete hiring history" ON public.radar_hiring_history FOR DELETE TO authenticated USING (true);

CREATE TABLE public.radar_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  source_category text NOT NULL DEFAULT 'Core Target Employers',
  country text NOT NULL DEFAULT 'Switzerland',
  category text NOT NULL DEFAULT 'Technology change',
  description text NOT NULL,
  evidence_source text NOT NULL,
  url text NOT NULL,
  url_key text NOT NULL UNIQUE,
  published_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  radar_status text NOT NULL DEFAULT 'Low',
  relevance_score integer NOT NULL DEFAULT 0,
  why_relevant text,
  potential_roles text[] NOT NULL DEFAULT '{}'::text[],
  matched_skills text[] NOT NULL DEFAULT '{}'::text[]
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_signals TO authenticated;
GRANT ALL ON public.radar_signals TO service_role;
ALTER TABLE public.radar_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read radar signals" ON public.radar_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert radar signals" ON public.radar_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update radar signals" ON public.radar_signals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete radar signals" ON public.radar_signals FOR DELETE TO authenticated USING (true);