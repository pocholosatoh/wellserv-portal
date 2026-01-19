create sequence if not exists public.referral_code_seq;

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  seq bigint;
  year_text text;
begin
  seq := nextval('public.referral_code_seq');
  year_text := to_char(now(), 'YYYY');
  return 'REF-' || year_text || '-' || lpad(seq::text, 6, '0');
end;
$$;

create table if not exists public.referral_specialties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.referral_doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty_id uuid not null references public.referral_specialties(id) on delete restrict,
  credentials text,
  prc_no text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_doctor_affiliations (
  id uuid primary key default gen_random_uuid(),
  referral_doctor_id uuid not null references public.referral_doctors(id) on delete cascade,
  institution_name text not null,
  address_line text not null,
  contact_numbers text,
  schedule_text text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.patient_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text unique not null default public.generate_referral_code(),
  patient_id text not null references public.patients(patient_id) on delete restrict,
  encounter_id uuid null references public.encounters(id) on delete set null,
  consult_id uuid null references public.consultations(id) on delete set null,
  referred_by_doctor_id uuid not null references public.doctors(doctor_id) on delete restrict,
  referred_to_doctor_id uuid not null references public.referral_doctors(id) on delete restrict,
  referred_to_specialty_id uuid not null references public.referral_specialties(id) on delete restrict,
  referred_to_affiliation_id uuid null references public.referral_doctor_affiliations(id) on delete set null,
  include_latest_notes boolean not null default false,
  include_latest_labs boolean not null default false,
  include_latest_vitals boolean not null default false,
  snapshot_affiliation_text text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.consultation_events (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id text not null references public.patients(patient_id) on delete restrict,
  event_type text not null,
  event_text text not null,
  referral_id uuid null references public.patient_referrals(id) on delete set null,
  created_by_doctor_id uuid null references public.doctors(doctor_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists referral_specialties_active_idx
  on public.referral_specialties (is_active, sort_order);

create index if not exists referral_doctors_specialty_active_idx
  on public.referral_doctors (specialty_id, is_active);

create index if not exists referral_affiliations_doctor_active_idx
  on public.referral_doctor_affiliations (referral_doctor_id, is_active);

create index if not exists patient_referrals_patient_created_idx
  on public.patient_referrals (patient_id, created_at desc);

create index if not exists consultation_events_consult_created_idx
  on public.consultation_events (consultation_id, created_at desc);

create trigger trg_referral_doctors_set_updated_at
  before update on public.referral_doctors
  for each row execute function public.set_updated_at();
