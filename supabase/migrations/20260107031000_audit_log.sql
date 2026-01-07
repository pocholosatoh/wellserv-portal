create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null,
  actor_id text null,
  actor_role text not null,
  branch_id uuid null,
  patient_id text null,
  route text not null,
  method text not null,
  action text not null,
  result text not null,
  status_code int null,
  request_id text null,
  ip text null,
  user_agent text null,
  meta jsonb null
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_patient_id_created_at_idx
  on public.audit_log (patient_id, created_at desc);
create index if not exists audit_log_actor_user_id_created_at_idx
  on public.audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_branch_id_created_at_idx
  on public.audit_log (branch_id, created_at desc);
create index if not exists audit_log_route_created_at_idx on public.audit_log (route, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_no_access"
  on public.audit_log
  for all
  to public
  using (false)
  with check (false);
