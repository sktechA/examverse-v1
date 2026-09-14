-- ============================================================================
-- SKTech Exam Portal Schema V15: Daily Automation, AI Validation & Mock Engine
-- Provides SQL migration for daily 00:00 automation, quotas, idempotency,
-- and rotation-safe mock generation using existing approved questions.
-- Safe to run repeatedly. Does NOT delete data, drop tables, or disable RLS.
-- ============================================================================

-- 1) Automation Configuration Table
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id text PRIMARY KEY DEFAULT 'default_config',
  daily_question_target integer NOT NULL DEFAULT 1000,
  current_affairs_target integer NOT NULL DEFAULT 150,
  auto_approval_threshold numeric(4,3) NOT NULL DEFAULT 0.930,
  gemini_ai_enabled boolean NOT NULL DEFAULT false,
  daily_automation_enabled boolean NOT NULL DEFAULT true,
  default_mock_questions integer NOT NULL DEFAULT 80,
  default_mock_count integer NOT NULL DEFAULT 5,
  difficulty_ratio jsonb NOT NULL DEFAULT '{"easy": 30, "moderate": 50, "hard": 20}'::jsonb,
  subject_quotas jsonb NOT NULL DEFAULT '{
    "Reasoning": 250,
    "Mathematics": 250,
    "General Awareness": 150,
    "Current Affairs": 150,
    "Computer": 100,
    "English": 50,
    "Hindi": 50
  }'::jsonb,
  exam_quotas jsonb NOT NULL DEFAULT '{
    "IBPS RRB PO": 300,
    "IBPS RRB Clerk": 300,
    "MP Sub Engineer": 150,
    "MPPSC State Service": 150,
    "General Practice": 100
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_settings_read ON public.automation_settings;
CREATE POLICY automation_settings_read ON public.automation_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS automation_settings_write ON public.automation_settings;
CREATE POLICY automation_settings_write ON public.automation_settings
  FOR ALL TO authenticated USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed initial row if absent
INSERT INTO public.automation_settings (id)
VALUES ('default_config')
ON CONFLICT (id) DO NOTHING;

-- 2) Daily Automation Job History (Idempotency Tracking)
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE, -- e.g. "daily_sync_2026-09-14_asia_kolkata"
  job_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  target_total integer NOT NULL DEFAULT 1000,
  processed_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  current_affairs_count integer NOT NULL DEFAULT 0,
  sources_synced jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS automation_logs_job_date_idx ON public.automation_logs(job_date);
CREATE INDEX IF NOT EXISTS automation_logs_status_idx ON public.automation_logs(status);
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_logs_admin ON public.automation_logs;
CREATE POLICY automation_logs_admin ON public.automation_logs
  FOR ALL TO authenticated USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Ensure current_affairs has external_id unique constraint and metadata
ALTER TABLE public.current_affairs ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.current_affairs ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.current_affairs ADD COLUMN IF NOT EXISTS verified_source boolean DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS current_affairs_external_id_uidx ON public.current_affairs(external_id) WHERE external_id IS NOT NULL;

-- 4) Add Question Source and Hash Tracking for Deduplication & Traceability
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS daily_job_key text;
CREATE INDEX IF NOT EXISTS questions_content_hash_idx ON public.questions(content_hash);
CREATE INDEX IF NOT EXISTS questions_daily_job_idx ON public.questions(daily_job_key);

-- 5) Stored Procedure: Get Unused Approved Questions for Mock Generation
CREATE OR REPLACE FUNCTION public.admin_get_blueprint_questions(
  p_exam_title text,
  p_subject text DEFAULT NULL,
  p_limit integer DEFAULT 40,
  p_exclude_exam_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  explanation text,
  question_hi text,
  subject text,
  topic text,
  difficulty text,
  exam text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
         q.correct_answer, q.explanation, q.question_hi, q.subject, q.topic,
         q.difficulty, q.exam
  FROM public.questions q
  WHERE q.status = 'approved'
    AND trim(coalesce(q.question,'')) <> ''
    AND trim(coalesce(q.option_a,'')) <> '' AND trim(coalesce(q.option_b,'')) <> ''
    AND trim(coalesce(q.option_c,'')) <> '' AND trim(coalesce(q.option_d,'')) <> ''
    AND upper(trim(coalesce(q.correct_answer,''))) IN ('A','B','C','D')
    AND (
      p_subject IS NULL 
      OR lower(trim(q.subject)) = lower(trim(p_subject))
    )
    AND (
      p_exam_title IS NULL
      OR lower(q.exam) LIKE '%' || lower(p_exam_title) || '%'
      OR lower(p_exam_title) LIKE '%' || lower(q.exam) || '%'
      OR q.exam IS NULL
      OR q.exam = ''
    )
    AND (
      p_exclude_exam_id IS NULL
      OR q.id NOT IN (
        SELECT eq.question_id 
        FROM public.exam_questions eq 
        WHERE eq.exam_id = p_exclude_exam_id
      )
    )
  ORDER BY 
    -- Prefer questions that have not been assigned to any other exam
    (SELECT count(*) FROM public.exam_questions eq WHERE eq.question_id = q.id) ASC,
    q.created_at DESC
  LIMIT greatest(coalesce(p_limit, 40), 1);
$$;

REVOKE ALL ON FUNCTION public.admin_get_blueprint_questions(text, text, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_blueprint_questions(text, text, integer, uuid) TO authenticated;
