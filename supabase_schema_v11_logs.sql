-- SKTech Exam Portal V11 - System / Candidate Error Logs
create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info','warning','error')),
  source text not null default 'app',
  event_type text not null default 'event',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  user_id uuid,
  user_email text,
  path text,
  user_agent text
);

create index if not exists system_logs_created_at_idx on public.system_logs(created_at desc);
create index if not exists system_logs_level_idx on public.system_logs(level);
create index if not exists system_logs_source_idx on public.system_logs(source);
create index if not exists system_logs_user_id_idx on public.system_logs(user_id);

alter table public.system_logs enable row level security;

drop policy if exists "Authenticated users can write own logs" on public.system_logs;
create policy "Authenticated users can write own logs"
on public.system_logs for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins can view logs" on public.system_logs;
create policy "Admins can view logs"
on public.system_logs for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can delete logs" on public.system_logs;
create policy "Admins can delete logs"
on public.system_logs for delete to authenticated
using (public.is_admin());
