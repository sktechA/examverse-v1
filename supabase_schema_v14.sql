-- SKTech Exam Portal V14: exam-specific question mapping + result flow + review repair
-- AI/OpenAI is NOT required.

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer,
  created_at timestamptz not null default now(),
  unique(exam_id, question_id)
);
create index if not exists exam_questions_exam_idx on public.exam_questions(exam_id, question_order);
create index if not exists exam_questions_question_idx on public.exam_questions(question_id);
alter table public.exam_questions enable row level security;

drop policy if exists exam_questions_read_v14 on public.exam_questions;
create policy exam_questions_read_v14 on public.exam_questions for select to authenticated using (public.is_admin() or true);


-- Compatibility: some existing questions tables do not have validation_notes.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS validation_notes text;

-- Map approved questions to an exam using the exam/subject metadata already imported in questions.
create or replace function public.admin_map_exam_questions(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.exams; q record; n integer:=0; existing integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into e from public.exams where id=p_exam_id;
 if e.id is null then raise exception 'Exam not found'; end if;
 insert into public.exam_questions(exam_id,question_id,question_order)
 select p_exam_id,q.id,row_number() over(order by q.created_at,q.id)::integer
 from public.questions q
 where q.status='approved'
   and trim(coalesce(q.question,''))<>''
   and trim(coalesce(q.option_a,''))<>'' and trim(coalesce(q.option_b,''))<>''
   and trim(coalesce(q.option_c,''))<>'' and trim(coalesce(q.option_d,''))<>''
   and upper(trim(coalesce(q.correct_answer,''))) in ('A','B','C','D')
   and (
      (nullif(trim(coalesce(q.exam,'')),'') is not null and (
        lower(q.exam) like '%'||lower(e.title)||'%' or lower(e.title) like '%'||lower(q.exam)||'%'
        or lower(q.exam) like '%'||lower(regexp_replace(e.title,'\s+(mock|test)$','','i'))||'%'
      ))
      or (nullif(trim(coalesce(e.subject,'')),'') is not null and lower(coalesce(q.subject,''))=lower(e.subject))
   )
 on conflict (exam_id,question_id) do nothing;
 get diagnostics n = row_count;
 select count(*) into existing from public.exam_questions where exam_id=p_exam_id;
 return jsonb_build_object('ok',true,'added',n,'total',existing);
end $$;
revoke all on function public.admin_map_exam_questions(uuid) from public;
grant execute on function public.admin_map_exam_questions(uuid) to authenticated;

-- Candidate-safe exam question retrieval. No global fallback: an exam gets only its mapping.
create or replace function public.get_exam_questions(p_exam_id uuid, p_limit integer default 100)
returns table(
 id uuid, question text, option_a text, option_b text, option_c text, option_d text,
 correct_answer text, explanation text, question_hi text, option_a_hi text, option_b_hi text,
 option_c_hi text, option_d_hi text, subject text, topic text, difficulty text, exam text
) language sql security definer set search_path=public as $$
 select q.id,q.question,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_answer,q.explanation,
        q.question_hi,q.option_a_hi,q.option_b_hi,q.option_c_hi,q.option_d_hi,q.subject,q.topic,q.difficulty,q.exam
 from public.exam_questions eq join public.questions q on q.id=eq.question_id
 where eq.exam_id=p_exam_id and q.status='approved'
 order by eq.question_order nulls last, q.created_at, q.id
 limit greatest(coalesce(p_limit,100),1);
$$;
revoke all on function public.get_exam_questions(uuid,integer) from public;
grant execute on function public.get_exam_questions(uuid,integer) to authenticated;

-- Repair existing review rows that are structurally valid. Do not require subject/exam to publish.
update public.questions
set status='approved', validation_notes=null, updated_at=now()
where status in ('pending_review','needs_correction')
  and trim(coalesce(question,''))<>''
  and trim(coalesce(option_a,''))<>'' and trim(coalesce(option_b,''))<>''
  and trim(coalesce(option_c,''))<>'' and trim(coalesce(option_d,''))<>''
  and upper(trim(coalesce(correct_answer,''))) in ('A','B','C','D')
  and not (
    lower(trim(option_a))=lower(trim(option_b)) or lower(trim(option_a))=lower(trim(option_c)) or lower(trim(option_a))=lower(trim(option_d))
    or lower(trim(option_b))=lower(trim(option_c)) or lower(trim(option_b))=lower(trim(option_d)) or lower(trim(option_c))=lower(trim(option_d))
  );

-- Correct attempt FK use is already supported by existing exam_attempts.exam_id.

-- Bulk approve every structurally valid review exception, not just the visible page.
create or replace function public.admin_bulk_approve_review()
returns jsonb language plpgsql security definer set search_path=public as $$
declare n integer:=0; skipped integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.questions
 set status='approved', validation_notes=null, updated_at=now()
 where status in ('pending_review','needs_correction')
   and trim(coalesce(question,''))<>''
   and trim(coalesce(option_a,''))<>'' and trim(coalesce(option_b,''))<>''
   and trim(coalesce(option_c,''))<>'' and trim(coalesce(option_d,''))<>''
   and upper(trim(coalesce(correct_answer,''))) in ('A','B','C','D')
   and not (
     lower(trim(option_a))=lower(trim(option_b)) or lower(trim(option_a))=lower(trim(option_c)) or lower(trim(option_a))=lower(trim(option_d))
     or lower(trim(option_b))=lower(trim(option_c)) or lower(trim(option_b))=lower(trim(option_d)) or lower(trim(option_c))=lower(trim(option_d))
   );
 get diagnostics n=row_count;
 select count(*) into skipped from public.questions where status in ('pending_review','needs_correction');
 return jsonb_build_object('ok',true,'approved',n,'remaining_review',skipped);
end $$;
revoke all on function public.admin_bulk_approve_review() from public;
grant execute on function public.admin_bulk_approve_review() to authenticated;
