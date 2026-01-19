create table if not exists public.patient_referral_affiliations (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.patient_referrals(id) on delete cascade,
  referral_doctor_affiliation_id uuid not null references public.referral_doctor_affiliations(id) on delete restrict,
  sort_order int default 0,
  snapshot_text text not null,
  created_at timestamptz not null default now(),
  unique (referral_id, referral_doctor_affiliation_id)
);

create index if not exists patient_referral_affiliations_referral_idx
  on public.patient_referral_affiliations (referral_id);

create index if not exists patient_referral_affiliations_affiliation_idx
  on public.patient_referral_affiliations (referral_doctor_affiliation_id);

-- Backfill legacy single-affiliation referrals (idempotent)
insert into public.patient_referral_affiliations (
  id,
  referral_id,
  referral_doctor_affiliation_id,
  sort_order,
  snapshot_text,
  created_at
)
select
  gen_random_uuid(),
  pr.id,
  pr.referred_to_affiliation_id,
  coalesce(rda.sort_order, 0),
  coalesce(
    pr.snapshot_affiliation_text,
    concat_ws(
      E'\n',
      rda.institution_name,
      rda.address_line,
      rda.contact_numbers,
      rda.schedule_text
    )
  ),
  pr.created_at
from public.patient_referrals pr
join public.referral_doctor_affiliations rda
  on rda.id = pr.referred_to_affiliation_id
where pr.referred_to_affiliation_id is not null
  and not exists (
    select 1
    from public.patient_referral_affiliations pra
    where pra.referral_id = pr.id
      and pra.referral_doctor_affiliation_id = pr.referred_to_affiliation_id
  );
