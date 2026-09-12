-- V7 AI review fields. Safe to run after supabase_schema_v7.sql.
alter table public.questions add column if not exists ai_review_status text default 'not_reviewed';
alter table public.questions add column if not exists ai_confidence numeric default 0;
alter table public.questions add column if not exists ai_notes text;
alter table public.questions add column if not exists ai_reviewed_at timestamptz;
alter table public.questions add column if not exists duplicate_of uuid references public.questions(id) on delete set null;
create index if not exists questions_ai_status_idx on public.questions(ai_review_status);
create index if not exists questions_duplicate_of_idx on public.questions(duplicate_of);
