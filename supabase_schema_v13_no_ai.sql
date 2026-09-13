-- SKTech Exam Portal V13 No-AI Smart Import + Live Exam Schema Repair
-- Run after your existing V12/V12.1 SQL.
-- AI/OpenAI is NOT required for this version.

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_question_no integer;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS import_batch text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS validation_notes text;

-- Keep only the statuses used by the no-AI pipeline.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.questions'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_status_check_v13
  CHECK (status IN ('pending_review','needs_correction','approved','rejected','draft','pending'));

-- Import function: the frontend may send normalized data in any source format.
-- Clean records are approved immediately; incomplete/invalid records are quarantined.
CREATE OR REPLACE FUNCTION public.admin_import_questions(rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  r jsonb;
  uid uuid := auth.uid();
  inserted_count integer := 0;
  approved_count integer := 0;
  needs_count integer := 0;
  dup_count integer := 0;
  qtext text;
  qa text;
  qb text;
  qc text;
  qd text;
  ans text;
  norm text;
  existing_id uuid;
  final_status text;
  notes text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF jsonb_typeof(rows) <> 'array' THEN
    RAISE EXCEPTION 'rows must be a JSON array';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(COALESCE(rows,'[]'::jsonb)) LOOP
    qtext := trim(COALESCE(r->>'question',''));
    qa := trim(COALESCE(r->>'option_a',''));
    qb := trim(COALESCE(r->>'option_b',''));
    qc := trim(COALESCE(r->>'option_c',''));
    qd := trim(COALESCE(r->>'option_d',''));
    ans := upper(trim(COALESCE(r->>'correct_answer','')));
    norm := regexp_replace(lower(qtext),'\s+',' ','g');
    notes := NULL;

    IF qtext = '' THEN CONTINUE; END IF;

    SELECT id INTO existing_id
    FROM public.questions
    WHERE regexp_replace(lower(trim(question)),'\s+',' ','g') = norm
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      dup_count := dup_count + 1;
      CONTINUE;
    END IF;

    IF qa='' OR qb='' OR qc='' OR qd='' THEN
      final_status := 'needs_correction';
      notes := 'Missing one or more options.';
    ELSIF ans NOT IN ('A','B','C','D') THEN
      final_status := 'needs_correction';
      notes := 'Invalid correct answer; expected A, B, C or D.';
    ELSIF lower(qa)=lower(qb) OR lower(qa)=lower(qc) OR lower(qa)=lower(qd)
       OR lower(qb)=lower(qc) OR lower(qb)=lower(qd) OR lower(qc)=lower(qd) THEN
      final_status := 'needs_correction';
      notes := 'Duplicate option text detected.';
    ELSE
      final_status := 'approved';
    END IF;

    INSERT INTO public.questions(
      question, option_a, option_b, option_c, option_d,
      correct_answer, explanation,
      question_hi, option_a_hi, option_b_hi, option_c_hi, option_d_hi,
      subject, topic, subtopic, difficulty, language, exam, year, source, tags,
      status, created_by, created_at, updated_at,
      source_question_no, import_batch, validation_notes
    ) VALUES (
      qtext,
      NULLIF(qa,''), NULLIF(qb,''), NULLIF(qc,''), NULLIF(qd,''),
      NULLIF(ans,''), NULLIF(trim(COALESCE(r->>'explanation','')),''),
      NULLIF(trim(COALESCE(r->>'question_hi','')),''),
      NULLIF(trim(COALESCE(r->>'option_a_hi','')),''),
      NULLIF(trim(COALESCE(r->>'option_b_hi','')),''),
      NULLIF(trim(COALESCE(r->>'option_c_hi','')),''),
      NULLIF(trim(COALESCE(r->>'option_d_hi','')),''),
      COALESCE(NULLIF(trim(r->>'subject'),''),'General Awareness'),
      NULLIF(trim(r->>'topic'),''),
      NULLIF(trim(r->>'subtopic'),''),
      COALESCE(NULLIF(trim(r->>'difficulty'),''),'Moderate'),
      COALESCE(NULLIF(trim(r->>'language'),''),'Hindi'),
      NULLIF(trim(r->>'exam'),''),
      CASE WHEN NULLIF(trim(r->>'year'),'') IS NULL THEN NULL ELSE (r->>'year')::integer END,
      NULLIF(trim(r->>'source'),''),
      CASE WHEN jsonb_typeof(r->'tags')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags')) ELSE '{}'::text[] END,
      final_status, uid, now(), now(),
      CASE WHEN NULLIF(trim(r->>'number'),'') IS NULL THEN NULL ELSE (r->>'number')::integer END,
      NULLIF(trim(r->>'import_batch'),''),
      notes
    );

    inserted_count := inserted_count + 1;
    IF final_status='approved' THEN approved_count := approved_count + 1;
    ELSE needs_count := needs_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', inserted_count,
    'approved', approved_count,
    'needs_correction', needs_count,
    'duplicates', dup_count
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_import_questions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_questions(jsonb) TO authenticated;

-- Candidate/mock safety: only structurally valid approved questions are readable.
DROP POLICY IF EXISTS questions_read_approved_v13 ON public.questions;
CREATE POLICY questions_read_approved_v13 ON public.questions
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    status='approved'
    AND trim(COALESCE(question,''))<>''
    AND trim(COALESCE(option_a,''))<>''
    AND trim(COALESCE(option_b,''))<>''
    AND trim(COALESCE(option_c,''))<>''
    AND trim(COALESCE(option_d,''))<>''
    AND upper(trim(COALESCE(correct_answer,''))) IN ('A','B','C','D')
  )
);

CREATE INDEX IF NOT EXISTS questions_v13_import_batch_idx ON public.questions(import_batch);
CREATE INDEX IF NOT EXISTS questions_v13_source_number_idx ON public.questions(source_question_no);
