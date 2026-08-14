DROP POLICY IF EXISTS "Jobs are publicly readable" ON public.jobs;
DROP POLICY IF EXISTS "Jobs are publicly writable" ON public.jobs;
DROP POLICY IF EXISTS "Jobs are publicly updatable" ON public.jobs;
DROP POLICY IF EXISTS "Jobs are publicly deletable" ON public.jobs;
DROP POLICY IF EXISTS "Search runs are publicly readable" ON public.search_runs;
DROP POLICY IF EXISTS "Search runs are publicly writable" ON public.search_runs;

REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.search_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
GRANT SELECT, INSERT ON public.search_runs TO authenticated;
GRANT ALL ON public.search_runs TO service_role;

CREATE POLICY "Signed-in users can read jobs" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update jobs" ON public.jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete jobs" ON public.jobs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Signed-in users can read search runs" ON public.search_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can insert search runs" ON public.search_runs FOR INSERT TO authenticated WITH CHECK (true);