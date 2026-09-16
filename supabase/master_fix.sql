-- SKTech Exam Portal: master DB policy fix
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_settings_admin_all_v17 ON public.automation_settings;
CREATE POLICY automation_settings_admin_all_v17
ON public.automation_settings FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_logs_admin_all_v17 ON public.automation_logs;
CREATE POLICY automation_logs_admin_all_v17
ON public.automation_logs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Published exams only for candidates.
DROP POLICY IF EXISTS exam_questions_candidate_published_v17 ON public.exam_questions;
CREATE POLICY exam_questions_candidate_published_v17
ON public.exam_questions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id=exam_questions.exam_id AND e.published=true AND e.status='published'));


