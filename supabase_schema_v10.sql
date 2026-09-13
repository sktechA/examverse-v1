-- SKTech Exam Portal V10
-- Run AFTER the existing V7/V8/V9 schema in Supabase SQL Editor.
-- Safe to run repeatedly.

-- 1) Question status compatibility + AI fields
alter table public.questions add column if not exists ai_review_status text default 'not_reviewed';
alter table public.questions add column if not exists ai_confidence numeric default 0;
alter table public.questions add column if not exists ai_notes text;
alter table public.questions add column if not exists ai_reviewed_at timestamptz;
alter table public.questions add column if not exists duplicate_of uuid references public.questions(id) on delete set null;

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

alter table public.questions
  add constraint questions_status_check
  check (status in ('pending_review','needs_correction','approved','rejected','draft','pending'));

update public.questions set status='pending_review' where status='pending';

-- Existing broken V9 approved rows are quarantined so candidates never see blanks.
update public.questions
set status='needs_correction',
    ai_review_status='needs_correction',
    ai_notes='Quarantined by V10 validation: incomplete question/options/answer.'
where status='approved'
  and (
    nullif(trim(coalesce(question,'')),'') is null
    or nullif(trim(coalesce(option_a,'')),'') is null
    or nullif(trim(coalesce(option_b,'')),'') is null
    or nullif(trim(coalesce(option_c,'')),'') is null
    or nullif(trim(coalesce(option_d,'')),'') is null
    or upper(trim(coalesce(correct_answer,''))) not in ('A','B','C','D')
  );

create index if not exists questions_status_exam_v10_idx on public.questions(status, exam);
create index if not exists questions_ai_status_v10_idx on public.questions(ai_review_status);

-- Allow the production admin role used by the portal.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='public.profiles'::regclass
      AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;
alter table public.profiles add constraint profiles_role_check_v10
check (role in ('candidate','admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support','sub_admin'));

-- 2) Admin role helper + RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.role in ('admin','super_admin','question_manager','exam_manager','vacancy_manager','content_manager','support','sub_admin')
  );
$$;

drop policy if exists "Admins can manage questions" on public.questions;
create policy "Admins can manage questions"
on public.questions for all to authenticated
using (public.is_admin() or lower(coalesce(auth.jwt()->>'email',''))='skt22tripathi@gmail.com')
with check (public.is_admin() or lower(coalesce(auth.jwt()->>'email',''))='skt22tripathi@gmail.com');

drop policy if exists questions_read_approved on public.questions;
create policy questions_read_approved on public.questions
for select to authenticated
using (status='approved' or public.is_admin() or lower(coalesce(auth.jwt()->>'email',''))='skt22tripathi@gmail.com');

-- 3) Controlled bulk import. TXT parser sends clean JSON rows.
create or replace function public.admin_import_questions(rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  inserted_count integer:=0;
  uid uuid:=auth.uid();
  email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if not (email='skt22tripathi@gmail.com' or public.is_admin()) then
    raise exception 'Not authorized as admin';
  end if;
  if jsonb_typeof(rows)<>'array' then raise exception 'rows must be a JSON array'; end if;
  for r in select value from jsonb_array_elements(rows) loop
    insert into public.questions (
      question,question_hi,option_a,option_b,option_c,option_d,
      option_a_hi,option_b_hi,option_c_hi,option_d_hi,
      correct_answer,explanation,explanation_hi,subject,topic,subtopic,
      difficulty,language,exam,year,source,tags,status,created_by
    ) values (
      nullif(r->>'question',''),nullif(r->>'question_hi',''),
      nullif(r->>'option_a',''),nullif(r->>'option_b',''),nullif(r->>'option_c',''),nullif(r->>'option_d',''),
      nullif(r->>'option_a_hi',''),nullif(r->>'option_b_hi',''),nullif(r->>'option_c_hi',''),nullif(r->>'option_d_hi',''),
      upper(nullif(r->>'correct_answer','')),nullif(r->>'explanation',''),nullif(r->>'explanation_hi',''),
      coalesce(nullif(r->>'subject',''),'General Awareness'),nullif(r->>'topic',''),nullif(r->>'subtopic',''),
      coalesce(nullif(r->>'difficulty',''),'Moderate'),coalesce(nullif(r->>'language',''),'Hindi'),nullif(r->>'exam',''),
      case when nullif(r->>'year','') is null then null else (r->>'year')::integer end,
      nullif(r->>'source',''),
      case when jsonb_typeof(r->'tags')='array' then array(select jsonb_array_elements_text(r->'tags')) else '{}'::text[] end,
      'pending_review',uid
    );
    inserted_count:=inserted_count+1;
  end loop;
  return jsonb_build_object('ok',true,'inserted',inserted_count);
end $$;
revoke all on function public.admin_import_questions(jsonb) from public;
grant execute on function public.admin_import_questions(jsonb) to authenticated;

-- 4) Candidate profile/auth hardening
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,email,phone,role,consent_at)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),new.email,coalesce(new.phone,new.raw_user_meta_data->>'phone'),'candidate',
    case when new.raw_user_meta_data->>'consent_at' is null then null else (new.raw_user_meta_data->>'consent_at')::timestamptz end)
  on conflict(id) do update set email=coalesce(excluded.email,public.profiles.email),phone=coalesce(public.profiles.phone,excluded.phone),full_name=case when coalesce(public.profiles.full_name,'')='' then excluded.full_name else public.profiles.full_name end,updated_at=now();
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check(id=auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

-- 5) Current Affairs feed
create table if not exists public.current_affairs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  category text default 'National',
  source_name text not null,
  source_url text,
  published_at timestamptz default now(),
  status text not null default 'draft' check(status in ('draft','pending_review','published','rejected')),
  question_count integer default 0,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists current_affairs_external_id_idx on public.current_affairs(external_id) where external_id is not null;
create index if not exists current_affairs_published_idx on public.current_affairs(status,published_at desc);
alter table public.current_affairs enable row level security;
drop policy if exists current_affairs_read on public.current_affairs;
create policy current_affairs_read on public.current_affairs for select to authenticated using(status='published' or public.is_admin());
drop policy if exists current_affairs_admin on public.current_affairs;
create policy current_affairs_admin on public.current_affairs for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Official-source starter entries so the section is visible immediately.
insert into public.current_affairs(title,summary,category,source_name,source_url,published_at,status,external_id)
values
('SEBI: Felicitation of Winners of Securities Market TechSprint at Global Fintech Fest 2026','Official SEBI media update dated 11 September 2026.','Banking & Finance','SEBI','https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=23','2026-09-11T00:00:00+05:30','published','sebi-2026-09-11-techsprint'),
('SEBI: Successful launch of Demat 2.0 Pilot for Tokenised Corporate Bonds','Official SEBI FAQ/media update dated 10 September 2026.','Banking & Finance','SEBI','https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=23','2026-09-10T00:00:00+05:30','published','sebi-2026-09-10-demat2')
on conflict(external_id) do nothing;

-- 6) Exam attempts: keep the V7 column names used by the application.
drop policy if exists attempts_self on public.exam_attempts;
create policy attempts_self on public.exam_attempts for select to authenticated using(candidate_id=auth.uid() or public.is_admin());
drop policy if exists attempts_insert_self on public.exam_attempts;
create policy attempts_insert_self on public.exam_attempts for insert to authenticated with check(candidate_id=auth.uid());


-- 7) Small official-source Current Affairs starter bank so Daily Mock is usable immediately.
insert into public.questions
(question,option_a,option_b,option_c,option_d,correct_answer,explanation,subject,topic,subtopic,difficulty,language,exam,year,source,status)
values
('The 11 September 2026 official media update about Securities Market TechSprint was issued by which regulator?','RBI','SEBI','IRDAI','PFRDA','B','The cited official media update is published by SEBI.','Current Affairs','Banking & Finance','SEBI Updates','Easy','English + Hindi','Current Affairs',2026,'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=23','approved'),
('SEBI''s 10 September 2026 pilot mentioned in its official media updates relates to which instrument?','Tokenised Corporate Bonds','Gold ETFs only','Crop Insurance Policies','Postal Savings Certificates','A','The official SEBI update is titled around the successful launch of the Demat 2.0 pilot for Tokenised Corporate Bonds.','Current Affairs','Banking & Finance','Capital Markets','Moderate','English + Hindi','Current Affairs',2026,'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=23','approved'),
('The official SEBI media listing dated 10 September 2026 included an update on which pilot?','UPI Lite Pilot','Demat 2.0 Pilot','FASTag 2.0 Pilot','GSTN 2.0 Pilot','B','SEBI listed the successful launch of the Demat 2.0 pilot for Tokenised Corporate Bonds.','Current Affairs','Banking & Finance','SEBI Updates','Easy','English + Hindi','Current Affairs',2026,'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=6&ssid=23','approved'),
('For exam preparation, current-affairs facts should preferably be verified against which type of source?','Anonymous social media post','Official regulator/government release','Unverified forwarded message','Random comment section','B','Official government and regulator releases are the preferred primary verification sources.','Current Affairs','Current Affairs Strategy','Source Verification','Easy','English + Hindi','Current Affairs',2026,'SKTech Official Source Policy','approved')
on conflict do nothing;
