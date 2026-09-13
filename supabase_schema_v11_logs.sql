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

-- V11.1 migration: align logging with the deployed app and allow auth failures to be recorded.
alter table public.system_logs add column if not exists action text;
alter table public.system_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.system_logs add column if not exists page text;
alter table public.system_logs add column if not exists request_id text;

drop policy if exists "Admins can delete logs" on public.system_logs;
create policy "Admins can delete logs"
on public.system_logs
for delete to authenticated
using (public.is_admin());

create or replace function public.write_system_log(
  p_level text,
  p_source text,
  p_action text,
  p_message text,
  p_details jsonb default null,
  p_user_id uuid default null,
  p_page text default null,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.system_logs(level,source,action,message,details,user_id,page,request_id)
  values (
    case when p_level in ('info','warning','error','critical') then p_level else 'error' end,
    left(coalesce(p_source,'unknown'),100),
    left(coalesce(p_action,''),150),
    left(coalesce(p_message,'Unknown error'),2000),
    coalesce(p_details,'{}'::jsonb),
    coalesce(p_user_id,auth.uid()),
    left(p_page,300),
    left(p_request_id,150)
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.write_system_log(text,text,text,text,jsonb,uuid,text,text) from public;
grant execute on function public.write_system_log(text,text,text,text,jsonb,uuid,text,text) to anon, authenticated;
