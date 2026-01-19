insert into public.referral_specialties (code, name, sort_order)
values
  ('CARDIO', 'Cardiology', 1),
  ('DERM', 'Dermatology', 2),
  ('NEURO', 'Neurology', 3),
  ('OBGYN', 'Obstetrics & Gynecology', 4),
  ('OPTHA', 'Ophthalmology', 5),
  ('ORTHO', 'Orthopedics', 6),
  ('PED', 'Pediatrics', 7),
  ('PSYCH', 'Psychiatry', 8),
  ('RADIO', 'Radiology', 9),
  ('URO', 'Urology', 10),
  ('ENT', 'Ear, Nose & Throat', 11),
  ('GENSURG', 'General Surgery', 12),
  ('ANESTH', 'Anesthesiology', 13),
  ('EMERG', 'Emergency Medicine', 14),
  ('PATH', 'Pathology', 15),
  ('FAMMED', 'Family Medicine', 16),
  ('IM', 'Internal Medicine', 17),
  ('RAYUMA', 'Rheumatology', 18),
  ('AESTHETIC', 'Aesthetic Medicine', 19)
on conflict (code) do nothing;

insert into public.referral_doctors (full_name, specialty_id, credentials, prc_no)
select 'Maria L. Santos', s.id, 'MD, FPCP', 'PRC-123456'
from public.referral_specialties s
where s.code = 'CARDIO'
  and not exists (
    select 1 from public.referral_doctors d
    where d.full_name = 'Maria L. Santos' and d.specialty_id = s.id
  );

insert into public.referral_doctors (full_name, specialty_id, credentials, prc_no)
select 'Jose R. Dizon', s.id, 'MD, FPDS', 'PRC-654321'
from public.referral_specialties s
where s.code = 'DERM'
  and not exists (
    select 1 from public.referral_doctors d
    where d.full_name = 'Jose R. Dizon' and d.specialty_id = s.id
  );

insert into public.referral_doctors (full_name, specialty_id, credentials, prc_no)
select 'Clarissa P. Dela Cruz', s.id, 'MD, FPNA', 'PRC-777888'
from public.referral_specialties s
where s.code = 'NEURO'
  and not exists (
    select 1 from public.referral_doctors d
    where d.full_name = 'Clarissa P. Dela Cruz' and d.specialty_id = s.id
  );

insert into public.referral_doctor_affiliations (
  referral_doctor_id,
  institution_name,
  address_line,
  contact_numbers,
  schedule_text,
  sort_order
)
select d.id,
  'Good Samaritan Hospital',
  'Gapan, Nueva Ecija',
  '(044) 123-4567',
  'Mon-Wed 9:00am-12:00pm',
  1
from public.referral_doctors d
where d.full_name = 'Maria L. Santos'
  and not exists (
    select 1 from public.referral_doctor_affiliations a
    where a.referral_doctor_id = d.id
      and a.institution_name = 'Good Samaritan Hospital'
  );

insert into public.referral_doctor_affiliations (
  referral_doctor_id,
  institution_name,
  address_line,
  contact_numbers,
  schedule_text,
  sort_order
)
select d.id,
  'Nueva Ecija Medical Center',
  'Cabanatuan City, Nueva Ecija',
  '(044) 987-6543',
  'Thu-Fri 1:00pm-4:00pm',
  2
from public.referral_doctors d
where d.full_name = 'Maria L. Santos'
  and not exists (
    select 1 from public.referral_doctor_affiliations a
    where a.referral_doctor_id = d.id
      and a.institution_name = 'Nueva Ecija Medical Center'
  );

insert into public.referral_doctor_affiliations (
  referral_doctor_id,
  institution_name,
  address_line,
  contact_numbers,
  schedule_text,
  sort_order
)
select d.id,
  'Dermacare Clinic',
  'San Isidro, Nueva Ecija',
  '(044) 555-1212',
  'Tue & Sat 10:00am-2:00pm',
  1
from public.referral_doctors d
where d.full_name = 'Jose R. Dizon'
  and not exists (
    select 1 from public.referral_doctor_affiliations a
    where a.referral_doctor_id = d.id
      and a.institution_name = 'Dermacare Clinic'
  );
