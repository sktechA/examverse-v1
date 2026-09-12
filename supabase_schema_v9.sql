-- SKTech Exam Portal V9 hardening / compatibility patch
-- Run after V7/V8 schema. Safe to run repeatedly.

alter table public.questions
  alter column status set default 'pending_review';

-- Keep legacy 'pending' rows usable by converting them to the V9 status.
update public.questions set status='pending_review' where status='pending';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support','sub_admin')
  );
$$;

drop policy if exists "Admins can manage questions" on public.questions;
create policy "Admins can manage questions"
on public.questions
for all to authenticated
using (
  public.is_admin()
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'skt22tripathi@gmail.com'
)
with check (
  public.is_admin()
  or lower(coalesce(auth.jwt() ->> 'email','')) = 'skt22tripathi@gmail.com'
);

-- Controlled server-side import function. It is callable only by the designated admin
-- identity or a profile with an allowed admin role. It runs with definer privileges so
-- question import cannot be blocked by client-side RLS policy evaluation.
create or replace function public.admin_import_questions(rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  inserted_count integer := 0;
  uid uuid := auth.uid();
  email text := lower(coalesce(auth.jwt() ->> 'email',''));
begin
  if not (
    email = 'skt22tripathi@gmail.com'
    or exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support','sub_admin'))
  ) then
    raise exception 'Not authorized as admin';
  end if;

  if jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;

  for r in select value from jsonb_array_elements(rows) loop
    insert into public.questions (
      question, question_hi,
      option_a, option_b, option_c, option_d,
      option_a_hi, option_b_hi, option_c_hi, option_d_hi,
      correct_answer, explanation, explanation_hi,
      subject, topic, subtopic, difficulty, language, exam, year, source, tags,
      status, created_by
    ) values (
      nullif(r->>'question',''), nullif(r->>'question_hi',''),
      nullif(r->>'option_a',''), nullif(r->>'option_b',''), nullif(r->>'option_c',''), nullif(r->>'option_d',''),
      nullif(r->>'option_a_hi',''), nullif(r->>'option_b_hi',''), nullif(r->>'option_c_hi',''), nullif(r->>'option_d_hi',''),
      nullif(r->>'correct_answer',''), nullif(r->>'explanation',''), nullif(r->>'explanation_hi',''),
      coalesce(nullif(r->>'subject',''),'General Awareness'), nullif(r->>'topic',''), nullif(r->>'subtopic',''),
      coalesce(nullif(r->>'difficulty',''),'Moderate'), coalesce(nullif(r->>'language',''),'English'), nullif(r->>'exam',''),
      case when nullif(r->>'year','') is null then null else (r->>'year')::integer end,
      nullif(r->>'source',''),
      case when jsonb_typeof(r->'tags')='array' then array(select jsonb_array_elements_text(r->'tags')) else null end,
      'pending_review', uid
    );
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('ok',true,'inserted',inserted_count);
end;
$$;

revoke all on function public.admin_import_questions(jsonb) from public;
grant execute on function public.admin_import_questions(jsonb) to authenticated;
