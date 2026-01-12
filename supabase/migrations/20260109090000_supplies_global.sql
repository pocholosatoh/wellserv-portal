create table if not exists public.supplies_global_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.supplies_items(id) on delete restrict,
  expiry_date date not null,
  total_pcs int not null,
  remaining_pcs int not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_staff_id uuid null,
  updated_by_staff_id uuid null,
  constraint supplies_global_batches_remaining_le_total check (remaining_pcs <= total_pcs),
  constraint supplies_global_batches_remaining_pcs_check check (remaining_pcs >= 0),
  constraint supplies_global_batches_total_pcs_check check (total_pcs >= 0)
);

create table if not exists public.supplies_transfers (
  id uuid primary key default gen_random_uuid(),
  global_batch_id uuid not null references public.supplies_global_batches(id) on delete restrict,
  branch_code text not null,
  item_id uuid not null references public.supplies_items(id) on delete restrict,
  expiry_date date not null,
  qty_pcs int not null,
  transferred_at timestamptz not null default now(),
  transferred_by_staff_id uuid null,
  notes text null,
  constraint supplies_transfers_qty_pcs_check check (qty_pcs > 0)
);

create index if not exists supplies_global_batches_item_exp_idx
  on public.supplies_global_batches (item_id, expiry_date);

create index if not exists supplies_transfers_global_batch_id_idx
  on public.supplies_transfers (global_batch_id);

create or replace view public.v_supplies_global_inventory_summary as
  select
    item_id,
    sum(total_pcs)::int as total_pcs_all,
    sum(remaining_pcs)::int as remaining_pcs_all,
    sum(total_pcs) filter (where expiry_date >= current_date)::int as total_pcs_available,
    sum(remaining_pcs) filter (where expiry_date >= current_date)::int as remaining_pcs_available,
    min(expiry_date) filter (where expiry_date >= current_date and remaining_pcs > 0) as nearest_expiry_date,
    count(*) filter (where expiry_date >= current_date and remaining_pcs > 0) as active_batches_count
  from public.supplies_global_batches b
  group by item_id;

create or replace view public.v_supplies_global_next_expiries as
  select
    item_id,
    expiry_date,
    sum(remaining_pcs)::int as remaining_pcs
  from public.supplies_global_batches b
  where expiry_date >= current_date
  group by item_id, expiry_date
  order by item_id, expiry_date;

create or replace function public.supplies_global_receive(
  p_item_id uuid,
  p_added_pcs int,
  p_expiry_date date,
  p_staff_id uuid default null,
  p_notes text default null
) returns table(batch_id uuid, remaining_pcs int)
  language plpgsql
  as $$
declare
  v_id uuid;
  v_remaining int;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;
  if p_added_pcs is null or p_added_pcs <= 0 then
    raise exception 'added pcs must be > 0';
  end if;
  if p_expiry_date is null then
    raise exception 'expiry_date is required';
  end if;

  select sgb.id, sgb.remaining_pcs
    into v_id, v_remaining
  from public.supplies_global_batches sgb
  where sgb.item_id = p_item_id
    and sgb.expiry_date = p_expiry_date
  for update;

  if v_id is null then
    insert into public.supplies_global_batches as sgb (
      item_id, expiry_date,
      total_pcs, remaining_pcs,
      created_by_staff_id, updated_by_staff_id
    ) values (
      p_item_id, p_expiry_date,
      p_added_pcs, p_added_pcs,
      p_staff_id, p_staff_id
    )
    returning sgb.id, sgb.remaining_pcs into v_id, v_remaining;
  else
    update public.supplies_global_batches sgb
      set total_pcs = sgb.total_pcs + p_added_pcs,
          remaining_pcs = sgb.remaining_pcs + p_added_pcs,
          updated_by_staff_id = p_staff_id
    where sgb.id = v_id;

    select sgb.remaining_pcs
      into v_remaining
    from public.supplies_global_batches sgb
    where sgb.id = v_id;
  end if;

  batch_id := v_id;
  remaining_pcs := v_remaining;
  return next;
end;
$$;

create or replace function public.supplies_transfer_from_global_fefo(
  p_branch_code text,
  p_item_id uuid,
  p_qty_pcs int,
  p_staff_id uuid default null,
  p_notes text default null
) returns table(transferred_total int, branch_remaining_after_available int, global_remaining_after_available int)
  language plpgsql
  as $$
declare
  v_need int := p_qty_pcs;
  v_batch record;
  v_take int;
  v_remaining_global int;
  v_remaining_branch int;
  v_branch_batch_id uuid;
  v_branch_remaining int;
begin
  if p_branch_code is null or btrim(p_branch_code) = '' then
    raise exception 'branch_code is required';
  end if;
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;
  if p_qty_pcs is null or p_qty_pcs <= 0 then
    raise exception 'qty must be > 0';
  end if;

  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_global
  from public.supplies_global_batches
  where item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  if v_remaining_global < v_need then
    raise exception 'Insufficient GLOBAL AVAILABLE stock. Remaining %, requested %', v_remaining_global, v_need;
  end if;

  for v_batch in
    select id, remaining_pcs, expiry_date
    from public.supplies_global_batches
    where item_id = p_item_id
      and remaining_pcs > 0
      and expiry_date >= current_date
    order by expiry_date asc, received_at asc
    for update
  loop
    exit when v_need <= 0;

    v_take := least(v_need, v_batch.remaining_pcs);

    update public.supplies_global_batches
      set remaining_pcs = remaining_pcs - v_take,
          updated_by_staff_id = p_staff_id
    where id = v_batch.id;

    select sb.id, sb.remaining_pcs
      into v_branch_batch_id, v_branch_remaining
    from public.supplies_batches sb
    where sb.branch_code = p_branch_code
      and sb.item_id = p_item_id
      and sb.expiry_date = v_batch.expiry_date
    for update;

    if v_branch_batch_id is null then
      insert into public.supplies_batches as sb (
        branch_code, item_id, expiry_date,
        total_pcs, remaining_pcs,
        created_by_staff_id, updated_by_staff_id
      ) values (
        p_branch_code, p_item_id, v_batch.expiry_date,
        v_take, v_take,
        p_staff_id, p_staff_id
      )
      returning sb.id, sb.remaining_pcs into v_branch_batch_id, v_branch_remaining;
    else
      update public.supplies_batches sb
        set total_pcs = sb.total_pcs + v_take,
            remaining_pcs = sb.remaining_pcs + v_take,
            updated_by_staff_id = p_staff_id
      where sb.id = v_branch_batch_id;

      select sb.remaining_pcs
        into v_branch_remaining
      from public.supplies_batches sb
      where sb.id = v_branch_batch_id;
    end if;

    insert into public.supplies_transfers (
      global_batch_id,
      branch_code,
      item_id,
      expiry_date,
      qty_pcs,
      transferred_by_staff_id,
      notes
    ) values (
      v_batch.id,
      p_branch_code,
      p_item_id,
      v_batch.expiry_date,
      v_take,
      p_staff_id,
      p_notes
    );

    v_need := v_need - v_take;
  end loop;

  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_global
  from public.supplies_global_batches
  where item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_branch
  from public.supplies_batches
  where branch_code = p_branch_code
    and item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  transferred_total := p_qty_pcs;
  branch_remaining_after_available := v_remaining_branch;
  global_remaining_after_available := v_remaining_global;
  return next;
end;
$$;

create trigger trg_supplies_global_batches_updated_at
  before update on public.supplies_global_batches
  for each row execute function public.set_updated_at();

alter table public.supplies_global_batches enable row level security;
alter table public.supplies_transfers enable row level security;
