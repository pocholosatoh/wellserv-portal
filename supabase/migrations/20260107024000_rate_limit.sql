create table if not exists public.rate_limit_buckets (
  key text primary key,
  count integer not null,
  reset_at timestamp with time zone not null,
  updated_at timestamp with time zone not null default now()
);

create or replace function public.rate_limit_hit(p_key text, p_window_ms bigint)
returns table (count integer, reset_at timestamp with time zone)
language plpgsql
as $$
declare
  now_ts timestamp with time zone := now();
begin
  insert into public.rate_limit_buckets as r (key, count, reset_at, updated_at)
  values (p_key, 1, now_ts + (p_window_ms * interval '1 millisecond'), now_ts)
  on conflict (key) do update
    set count = case when r.reset_at <= now_ts then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now_ts then now_ts + (p_window_ms * interval '1 millisecond') else r.reset_at end,
        updated_at = now_ts
  returning r.count, r.reset_at
  into count, reset_at;

  return next;
end;
$$;
