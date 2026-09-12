-- SKTECH EXAM PORTAL V8 production hardening
create extension if not exists pgcrypto;

-- Existing V7 tables are kept; add missing integrity/indexes and profile automation.
alter table public.profiles alter column role set default 'candidate';
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_questions_status_exam on public.questions(status, exam);
create index if not exists idx_questions_status_subject on public.questions(status, subject);
create index if not exists idx_attempts_candidate on public.exam_attempts(candidate_id, created_at desc);
create index if not exists idx_attempts_exam on public.exam_attempts(exam_id, created_at desc);
create index if not exists idx_events_created on public.page_events(created_at desc);

-- Keep profile data in sync with Auth registration. Never overwrites a manually edited profile name/phone.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, email, phone, role, consent_at)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    'candidate',
    case when new.raw_user_meta_data->>'consent_at' is not null then (new.raw_user_meta_data->>'consent_at')::timestamptz else null end
  )
  on conflict(id) do update set email=excluded.email,
    phone=coalesce(public.profiles.phone,excluded.phone),
    full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),
    updated_at=now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support'));
$$;

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;

-- Candidate owns their own profile; admin roles can manage operational records.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert with check(id=auth.uid());
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using(id=auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

drop policy if exists questions_read_approved on public.questions;
create policy questions_read_approved on public.questions for select using(status='approved' or public.is_admin());
drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists exams_read_published on public.exams;
create policy exams_read_published on public.exams for select using(status='published' or public.is_admin());

drop policy if exists attempts_self on public.exam_attempts;
create policy attempts_self on public.exam_attempts for select using(candidate_id=auth.uid() or public.is_admin());
drop policy if exists attempts_insert_self on public.exam_attempts;
create policy attempts_insert_self on public.exam_attempts for insert with check(candidate_id=auth.uid());
drop policy if exists attempts_update_self on public.exam_attempts;
create policy attempts_update_self on public.exam_attempts for update using(candidate_id=auth.uid() or public.is_admin()) with check(candidate_id=auth.uid() or public.is_admin());

