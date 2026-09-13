-- SKTech Exam Portal V12: Question + Exam + Mock core repair
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_review_status text DEFAULT 'not_reviewed';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_verdict text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_confidence numeric;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.questions'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS %I',c.conname); END LOOP;
END $$;
ALTER TABLE public.questions ADD CONSTRAINT questions_status_check_v12
CHECK(status IN ('pending_review','needs_correction','approved','rejected','draft','pending'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id=auth.uid()
      AND role IN ('admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support')
  );
$$;

DROP POLICY IF EXISTS questions_read_approved_v12 ON public.questions;
CREATE POLICY questions_read_approved_v12 ON public.questions FOR SELECT TO authenticated
USING(status='approved' OR public.is_admin());
DROP POLICY IF EXISTS questions_admin_all_v12 ON public.questions;
CREATE POLICY questions_admin_all_v12 ON public.questions FOR ALL TO authenticated
USING(public.is_admin()) WITH CHECK(public.is_admin());

DROP POLICY IF EXISTS exams_read_published_v12 ON public.exams;
CREATE POLICY exams_read_published_v12 ON public.exams FOR SELECT TO authenticated
USING(status='published' OR public.is_admin());
DROP POLICY IF EXISTS exams_admin_all_v12 ON public.exams;
CREATE POLICY exams_admin_all_v12 ON public.exams FOR ALL TO authenticated
USING(public.is_admin()) WITH CHECK(public.is_admin());

-- Secure bulk import: frontend never needs service-role key.
CREATE OR REPLACE FUNCTION public.admin_import_questions(rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; inserted_count int:=0; needs_count int:=0; dup_count int:=0; qtext text; norm text; exists_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(COALESCE(rows,'[]'::jsonb)) LOOP
    qtext=trim(COALESCE(r->>'question',''));
    IF qtext='' THEN CONTINUE; END IF;
    norm=regexp_replace(lower(qtext),'\s+',' ','g');
    SELECT id INTO exists_id FROM public.questions
      WHERE regexp_replace(lower(trim(question)),'\s+',' ','g')=norm LIMIT 1;
    IF exists_id IS NOT NULL THEN dup_count:=dup_count+1; CONTINUE; END IF;
    INSERT INTO public.questions(
      question,option_a,option_b,option_c,option_d,correct_answer,explanation,
      question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,
      subject,topic,subtopic,difficulty,language,exam,year,source,tags,status,created_by,created_at,updated_at
    ) VALUES (
      qtext, NULLIF(trim(r->>'option_a'),''), NULLIF(trim(r->>'option_b'),''), NULLIF(trim(r->>'option_c'),''), NULLIF(trim(r->>'option_d'),''),
      NULLIF(upper(trim(r->>'correct_answer')),''), NULLIF(trim(r->>'explanation'),''),
      NULLIF(trim(r->>'question_hi'),''),NULLIF(trim(r->>'option_a_hi'),''),NULLIF(trim(r->>'option_b_hi'),''),NULLIF(trim(r->>'option_c_hi'),''),NULLIF(trim(r->>'option_d_hi'),''),
      COALESCE(NULLIF(trim(r->>'subject'),''),'General Awareness'),NULLIF(trim(r->>'topic'),''),NULLIF(trim(r->>'subtopic'),''),
      COALESCE(NULLIF(trim(r->>'difficulty'),''),'Moderate'),COALESCE(NULLIF(trim(r->>'language'),''),'Hindi'),NULLIF(trim(r->>'exam'),''),
      CASE WHEN NULLIF(trim(r->>'year'),'') IS NULL THEN NULL ELSE (r->>'year')::int END,NULLIF(trim(r->>'source'),''),
      CASE WHEN jsonb_typeof(r->'tags')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags')) ELSE '{}'::text[] END,
      CASE WHEN COALESCE(r->>'status','pending_review')='needs_correction' THEN 'needs_correction' ELSE 'pending_review' END,
      auth.uid(),now(),now()
    );
    inserted_count:=inserted_count+1;
    IF COALESCE(r->>'status','')='needs_correction' THEN needs_count:=needs_count+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'inserted',inserted_count,'needs_correction',needs_count,'duplicates',dup_count);
END $$;
REVOKE ALL ON FUNCTION public.admin_import_questions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_questions(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_exam(
  p_title text,
  p_question_count int DEFAULT 25,
  p_duration_minutes int DEFAULT 60,
  p_negative_mark numeric DEFAULT 0.25,
  p_status text DEFAULT 'draft',
  p_created_by uuid DEFAULT NULL
) RETURNS public.exams LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.exams;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  INSERT INTO public.exams(title,exam_name,question_count,duration_minutes,max_marks,negative_mark,randomize,status,created_by)
  VALUES(trim(p_title),trim(p_title),GREATEST(1,p_question_count),GREATEST(1,p_duration_minutes),GREATEST(1,p_question_count),GREATEST(0,p_negative_mark),true,
         CASE WHEN p_status IN ('published','draft') THEN p_status ELSE 'draft' END,COALESCE(p_created_by,auth.uid()))
  RETURNING * INTO e;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.admin_create_exam(text,int,int,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_exam(text,int,int,numeric,text,uuid) TO authenticated;

-- Remove legacy malformed approved rows from the candidate/mock path.
UPDATE public.questions
SET status='needs_correction', ai_review_status='needs_correction', updated_at=now()
WHERE status='approved'
  AND (trim(COALESCE(question,''))='' OR trim(COALESCE(option_a,''))='' OR trim(COALESCE(option_b,''))=''
       OR trim(COALESCE(option_c,''))='' OR trim(COALESCE(option_d,''))=''
       OR upper(trim(COALESCE(correct_answer,''))) NOT IN ('A','B','C','D'));

CREATE INDEX IF NOT EXISTS questions_v12_status_exam_idx ON public.questions(status,exam);
CREATE INDEX IF NOT EXISTS questions_v12_status_subject_idx ON public.questions(status,subject);
CREATE INDEX IF NOT EXISTS exams_v12_status_idx ON public.exams(status);
