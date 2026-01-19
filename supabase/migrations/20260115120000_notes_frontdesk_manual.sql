alter table public.encounters
  add column if not exists notes_frontdesk_manual text;
