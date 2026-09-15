-- SKTech Exam Portal V17 Master Bug Fix
-- Run this migration ONCE after the clean V17 deployment.
-- Non-destructive to candidates/exams/vacancies. It tightens question publishing and candidate isolation.

-- 1) Required traceability fields
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_question_no integer;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS import_batch text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS validation_notes text;

-- 2) Universal question validation helper
CREATE OR REPLACE FUNCTION public.question_is_publishable(p public.questions)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a text; b text; c text; d text; ans text; qtext text;
BEGIN
  qtext := trim(coalesce(p.question,''));
  a := trim(coalesce(p.option_a,'')); b := trim(coalesce(p.option_b,''));
  c := trim(coalesce(p.option_c,'')); d := trim(coalesce(p.option_d,''));
  ans := upper(trim(coalesce(p.correct_answer,'')));
  IF qtext='' OR length(regexp_replace(qtext,'\\s+','','g')) < 8 THEN RETURN false; END IF;
  IF a='' OR b='' OR c='' OR d='' THEN RETURN false; END IF;
  IF ans NOT IN ('A','B','C','D') THEN RETURN false; END IF;
  IF lower(regexp_replace(a,'\\s+',' ','g')) = lower(regexp_replace(b,'\\s+',' ','g'))
     OR lower(regexp_replace(a,'\\s+',' ','g')) = lower(regexp_replace(c,'\\s+',' ','g'))
     OR lower(regexp_replace(a,'\\s+',' ','g')) = lower(regexp_replace(d,'\\s+',' ','g'))
     OR lower(regexp_replace(b,'\\s+',' ','g')) = lower(regexp_replace(c,'\\s+',' ','g'))
     OR lower(regexp_replace(b,'\\s+',' ','g')) = lower(regexp_replace(d,'\\s+',' ','g'))
     OR lower(regexp_replace(c,'\\s+',' ','g')) = lower(regexp_replace(d,'\\s+',' ','g')) THEN RETURN false; END IF;
  -- Dependent arrangement questions cannot be published without their context in the same row.
  IF qtext ~* '(उसी व्यवस्था|उक्त व्यवस्था|उपरोक्त व्यवस्था|उपरोक्त जानकारी|same arrangement|above arrangement|following arrangement|given arrangement)' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- 3) Rebuild import RPC: numbered source fields are preserved; nothing incomplete is published.
CREATE OR REPLACE FUNCTION public.admin_import_questions(rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  r jsonb; uid uuid := auth.uid();
  inserted_count int:=0; approved_count int:=0; needs_count int:=0; dup_count int:=0;
  qtext text; qa text; qb text; qc text; qd text; ans text; norm text; existing_id uuid;
  final_status text; notes text; subj text; topic text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF jsonb_typeof(rows) <> 'array' THEN RAISE EXCEPTION 'rows must be a JSON array'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
    qtext:=trim(coalesce(r->>'question','')); qa:=trim(coalesce(r->>'option_a','')); qb:=trim(coalesce(r->>'option_b','')); qc:=trim(coalesce(r->>'option_c','')); qd:=trim(coalesce(r->>'option_d','')); ans:=upper(trim(coalesce(r->>'correct_answer','')));
    norm:=regexp_replace(lower(qtext),'\\s+',' ','g'); subj:=nullif(trim(r->>'subject'),''); topic:=nullif(trim(r->>'topic'),''); notes:=null;
    IF qtext='' THEN CONTINUE; END IF;
    SELECT id INTO existing_id FROM public.questions WHERE regexp_replace(lower(trim(question)),'\\s+',' ','g')=norm LIMIT 1;
    IF existing_id IS NOT NULL THEN dup_count:=dup_count+1; CONTINUE; END IF;
    final_status:='approved';
    IF qa='' OR qb='' OR qc='' OR qd='' THEN final_status:='needs_correction'; notes:='Incomplete options';
    ELSIF ans NOT IN ('A','B','C','D') THEN final_status:='needs_correction'; notes:='Invalid correct answer';
    ELSIF lower(regexp_replace(qa,'\\s+',' ','g')) IN (lower(regexp_replace(qb,'\\s+',' ','g')),lower(regexp_replace(qc,'\\s+',' ','g')),lower(regexp_replace(qd,'\\s+',' ','g'))) OR lower(regexp_replace(qb,'\\s+',' ','g')) IN (lower(regexp_replace(qc,'\\s+',' ','g')),lower(regexp_replace(qd,'\\s+',' ','g'))) OR lower(regexp_replace(qc,'\\s+',' ','g'))=lower(regexp_replace(qd,'\\s+',' ','g')) THEN final_status:='needs_correction'; notes:='Duplicate option text';
    ELSIF length(regexp_replace(qtext,'\\s+','','g'))<8 THEN final_status:='needs_correction'; notes:='Question too short';
    ELSIF qtext ~* '(उसी व्यवस्था|उक्त व्यवस्था|उपरोक्त व्यवस्था|उपरोक्त जानकारी|same arrangement|above arrangement|following arrangement|given arrangement)' THEN final_status:='needs_correction'; notes:='Dependent question has no embedded context';
    END IF;
    INSERT INTO public.questions(question,option_a,option_b,option_c,option_d,correct_answer,explanation,question_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,subject,topic,subtopic,difficulty,language,exam,year,source,tags,status,created_by,created_at,updated_at,source_question_no,import_batch,validation_notes)
    VALUES(qtext,NULLIF(qa,''),NULLIF(qb,''),NULLIF(qc,''),NULLIF(qd,''),NULLIF(ans,''),NULLIF(trim(coalesce(r->>'explanation','')),''),NULLIF(trim(coalesce(r->>'question_hi','')),''),NULLIF(trim(coalesce(r->>'option_a_hi','')),''),NULLIF(trim(coalesce(r->>'option_b_hi','')),''),NULLIF(trim(coalesce(r->>'option_c_hi','')),''),NULLIF(trim(coalesce(r->>'option_d_hi','')), ''),coalesce(subj,'General Awareness'),topic,NULLIF(trim(r->>'subtopic'),''),coalesce(nullif(trim(r->>'difficulty'),''),'Moderate'),coalesce(nullif(trim(r->>'language'),''),'Hindi'),nullif(trim(r->>'exam'),''),CASE WHEN nullif(trim(r->>'year'),'') IS NULL THEN NULL ELSE (r->>'year')::integer END,nullif(trim(r->>'source'),''),CASE WHEN jsonb_typeof(r->'tags')='array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags')) ELSE '{}'::text[] END,final_status,uid,now(),now(),CASE WHEN nullif(trim(r->>'number'),'') IS NULL THEN NULL ELSE (r->>'number')::integer END,nullif(trim(r->>'import_batch'),''),notes);
    inserted_count:=inserted_count+1; IF final_status='approved' THEN approved_count:=approved_count+1; ELSE needs_count:=needs_count+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'inserted',inserted_count,'approved',approved_count,'needs_correction',needs_count,'duplicates',dup_count);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_import_questions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_questions(jsonb) TO authenticated;

-- 4) Never bulk-publish dependent/incomplete rows.
CREATE OR REPLACE FUNCTION public.admin_bulk_approve_review()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int:=0; remaining int:=0;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 UPDATE public.questions q SET status='approved',validation_notes=NULL,updated_at=now()
 WHERE q.status IN ('pending_review','needs_correction') AND public.question_is_publishable(q);
 GET DIAGNOSTICS n=row_count;
 SELECT count(*) INTO remaining FROM public.questions WHERE status IN ('pending_review','needs_correction');
 RETURN jsonb_build_object('ok',true,'approved',n,'remaining_review',remaining);
END $$;
REVOKE ALL ON FUNCTION public.admin_bulk_approve_review() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_approve_review() TO authenticated;

-- 5) Quarantine currently approved rows that fail universal integrity rules.
UPDATE public.questions q SET status='needs_correction',validation_notes=coalesce(q.validation_notes,'Failed V17 publish integrity check'),updated_at=now()
WHERE q.status='approved' AND NOT public.question_is_publishable(q);

-- 6) Secure exam_questions: candidates can read only mappings belonging to published exams.
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_questions_read_v14 ON public.exam_questions;
DROP POLICY IF EXISTS exam_questions_read_v17 ON public.exam_questions;
CREATE POLICY exam_questions_read_v17 ON public.exam_questions FOR SELECT TO authenticated
USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id=exam_id AND e.status='published' AND coalesce(e.published,false)=true));

-- 7) Secure exam question RPC as well.
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id uuid,p_limit integer default 100)
RETURNS TABLE(id uuid,question text,option_a text,option_b text,option_c text,option_d text,correct_answer text,explanation text,question_hi text,option_a_hi text,option_b_hi text,option_c_hi text,option_d_hi text,subject text,topic text,difficulty text,exam text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT q.id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.explanation,q.question_hi,q.option_a_hi,q.option_b_hi,q.option_c_hi,q.option_d_hi,q.subject,q.topic,q.difficulty,q.exam
 FROM public.exam_questions eq JOIN public.questions q ON q.id=eq.question_id JOIN public.exams e ON e.id=eq.exam_id
 WHERE eq.exam_id=p_exam_id AND e.status='published' AND e.published=true AND q.status='approved' AND public.question_is_publishable(q)
 ORDER BY eq.question_order NULLS LAST,q.created_at,q.id LIMIT greatest(coalesce(p_limit,100),1);
$$;
REVOKE ALL ON FUNCTION public.get_exam_questions(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(uuid,integer) TO authenticated;

-- 8) Correct exam mapping: derive subject from exam title if admin left subject blank, and respect exact total_questions.
CREATE OR REPLACE FUNCTION public.admin_map_exam_questions(p_exam_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.exams; v_subject text; n int:=0; existing int:=0;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO e FROM public.exams WHERE id=p_exam_id; IF e.id IS NULL THEN RAISE EXCEPTION 'Exam not found'; END IF;
 v_subject:=nullif(trim(e.subject),'');
 IF v_subject IS NULL THEN
   IF lower(e.title) ~ '(reasoning|general intelligence)' THEN v_subject:='Reasoning';
   ELSIF lower(e.title) ~ '(math|quantitative|aptitude|mathematics)' THEN v_subject:='Mathematics';
   ELSIF lower(e.title) ~ '(banking)' THEN v_subject:='Banking Awareness';
   ELSIF lower(e.title) ~ '(computer)' THEN v_subject:='Computer';
   ELSIF lower(e.title) ~ '(english)' THEN v_subject:='English';
   ELSIF lower(e.title) ~ '(hindi)' THEN v_subject:='Hindi';
   ELSIF lower(e.title) ~ '(current affairs)' THEN v_subject:='Current Affairs';
   ELSIF lower(e.title) ~ '(general awareness|gk)' THEN v_subject:='General Awareness';
   END IF;
 END IF;
 INSERT INTO public.exam_questions(exam_id,question_id,question_order)
 SELECT p_exam_id,q.id,row_number() over(order by q.created_at,q.id)::int
 FROM public.questions q
 WHERE q.status='approved' AND public.question_is_publishable(q)
   AND (v_subject IS NULL OR lower(trim(coalesce(q.subject,'')))=lower(v_subject))
   AND (nullif(trim(q.exam),'') IS NULL OR lower(q.exam) like '%'||lower(e.title)||'%' OR lower(e.title) like '%'||lower(q.exam)||'%')
   AND NOT EXISTS (SELECT 1 FROM public.exam_questions x WHERE x.exam_id=p_exam_id AND x.question_id=q.id)
 ORDER BY q.created_at,q.id LIMIT greatest(coalesce(e.total_questions,25),1);
 GET DIAGNOSTICS n=row_count;
 SELECT count(*) INTO existing FROM public.exam_questions WHERE exam_id=p_exam_id;
 RETURN jsonb_build_object('ok',true,'added',n,'total',existing,'subject_used',v_subject,'configured_total',e.total_questions);
END $$;
REVOKE ALL ON FUNCTION public.admin_map_exam_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_map_exam_questions(uuid) TO authenticated;

-- 9) Useful diagnostic view.
CREATE OR REPLACE VIEW public.v17_question_integrity AS
SELECT status,count(*) total,
       count(*) FILTER (WHERE public.question_is_publishable(q)) publishable,
       count(*) FILTER (WHERE NOT public.question_is_publishable(q)) invalid
FROM public.questions q GROUP BY status;
