alter table public.patient_referrals
  add column if not exists include_patient_history boolean not null default false;
