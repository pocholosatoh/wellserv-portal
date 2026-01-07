create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";

create type "public"."packaging_type" as enum ('box', 'bundle', 'pack', 'bag', 'bottle');

create sequence "public"."medical_certificate_supporting_items_id_seq";

create sequence "public"."staff_no_seq";


  create table "public"."config" (
    "key" text not null,
    "value" text
      );



  create table "public"."config_import" (
    "key" text,
    "value" text
      );



  create table "public"."consent_templates" (
    "id" uuid not null default gen_random_uuid(),
    "slug" text not null,
    "version" integer not null,
    "body" text not null,
    "effective_from" date not null,
    "retired_at" date
      );



  create table "public"."consultation_diagnoses" (
    "id" uuid not null default gen_random_uuid(),
    "consultation_id" uuid not null,
    "encounter_id" uuid not null,
    "patient_id" text not null,
    "icd10_code" text not null,
    "icd10_text_snapshot" text not null,
    "is_primary" boolean not null default false,
    "certainty" text,
    "acuity" text,
    "onset_date" date,
    "resolved_date" date,
    "notes" text,
    "source" text not null default 'doctor'::text,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone
      );



  create table "public"."consultations" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "doctor_id" uuid,
    "visit_at" timestamp with time zone not null default now(),
    "plan_shared" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "doctor_name_at_time" text,
    "branch" text,
    "encounter_id" uuid,
    "hub_code" text,
    "type" text not null default 'FPE'::text,
    "status" text not null default 'draft'::text,
    "started_by_user_id" uuid,
    "finalized_by_doctor_id" uuid,
    "finalized_at" timestamp with time zone,
    "signing_doctor_id" uuid,
    "signing_doctor_name" text,
    "signing_doctor_prc_no" text,
    "signing_doctor_philhealth_md_id" text
      );



  create table "public"."doctor_notes" (
    "id" uuid not null default gen_random_uuid(),
    "consultation_id" uuid not null,
    "notes_markdown" text,
    "notes_soap" jsonb,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."doctors" (
    "doctor_id" uuid not null default gen_random_uuid(),
    "code" text,
    "display_name" text,
    "pin_hash" text,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "full_name" text,
    "credentials" text,
    "specialty" text,
    "affiliations" text,
    "prc_no" text,
    "ptr_no" text,
    "s2_no" text,
    "signature_image_url" text,
    "philhealth_md_id" text
      );



  create table "public"."ecg_cases" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "encounter_id" uuid,
    "external_result_id" uuid,
    "uploaded_by" text not null,
    "uploaded_at" timestamp with time zone not null default now(),
    "status" text not null default 'pending'::text,
    "note" text
      );


alter table "public"."ecg_cases" enable row level security;


  create table "public"."ecg_reports" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "external_result_id" uuid not null,
    "encounter_id" uuid not null,
    "doctor_id" uuid not null,
    "interpreted_name" text not null,
    "interpreted_license" text,
    "interpreted_at" timestamp with time zone not null default now(),
    "rhythm" text,
    "heart_rate" text,
    "pr_interval" text,
    "qrs_duration" text,
    "qtc" text,
    "axis" text,
    "findings" text,
    "impression" text not null,
    "recommendations" text,
    "status" text not null default 'final'::text
      );


alter table "public"."ecg_reports" enable row level security;


  create table "public"."encounter_events" (
    "id" uuid not null default gen_random_uuid(),
    "encounter_id" uuid not null,
    "event_type" text not null,
    "actor_role" text,
    "actor_id" text,
    "ts" timestamp with time zone default now(),
    "remarks" text
      );



  create table "public"."encounter_orders" (
    "encounter_id" uuid not null,
    "notes" text
      );



  create table "public"."encounters" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "branch_code" text not null,
    "visit_date_local" date not null,
    "status" text not null default 'intake'::text,
    "priority" integer default 0,
    "is_philhealth_claim" boolean default false,
    "yakap_flag" boolean default false,
    "claim_notes" text,
    "notes_frontdesk" text,
    "locked_to_rmt" boolean default false,
    "staging_synced" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "total_price" numeric(12,2),
    "price_auto_total" numeric(12,2),
    "price_manual_add" numeric(12,2),
    "visited_at" timestamp with time zone,
    "consult_status" text,
    "queue_number" integer,
    "for_consult" boolean not null default false,
    "current_consultation_id" uuid,
    "in_consult_started_at" timestamp with time zone,
    "case_no" text,
    "tcn" text,
    "discount_enabled" boolean not null default false,
    "discount_rate" numeric not null default 0.2,
    "discount_amount" integer not null default 0
      );



  create table "public"."external_results" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "provider" text,
    "taken_at" date,
    "uploaded_at" timestamp with time zone not null default now(),
    "uploaded_by" text,
    "note" text,
    "url" text not null,
    "content_type" text,
    "type" text not null,
    "encounter_id" uuid,
    "category" text not null default 'other'::text,
    "subtype" text,
    "impression" text,
    "reported_at" timestamp with time zone,
    "performer_name" text,
    "performer_role" text,
    "performer_license" text,
    "source" text not null default 'upload'::text
      );


alter table "public"."external_results" enable row level security;


  create table "public"."followup_attempts" (
    "id" uuid not null default gen_random_uuid(),
    "followup_id" uuid not null,
    "attempted_at" timestamp with time zone not null default now(),
    "channel" text not null,
    "outcome" text not null,
    "notes" text,
    "attempted_by_name" text,
    "staff_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."followups" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "created_from_consultation_id" uuid not null,
    "closed_by_consultation_id" uuid,
    "return_branch" text,
    "due_date" date not null,
    "tolerance_days" integer not null default 7,
    "valid_until" date generated always as ((due_date + '30 days'::interval)) stored,
    "intended_outcome" text,
    "expected_tests" text,
    "status" text not null default 'scheduled'::text,
    "cancel_reason" text,
    "completion_note" text,
    "created_by" text,
    "updated_by" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );



  create table "public"."hubs" (
    "code" text not null,
    "name" text not null,
    "address" text,
    "contact" text,
    "is_active" boolean not null default true,
    "kpp_id" text,
    "hci_accreditation_no" text
      );



  create table "public"."icd10" (
    "code" text not null,
    "title" text not null
      );



  create table "public"."icd10_catalog" (
    "icd10_code" text not null,
    "short_title" text,
    "long_title" text,
    "chapter" text,
    "block" text,
    "is_billable" boolean not null default true
      );



  create table "public"."medical_certificate_supporting_items" (
    "id" bigint not null default nextval('public.medical_certificate_supporting_items_id_seq'::regclass),
    "certificate_id" uuid not null,
    "ordinal" integer not null default 0,
    "source_type" text not null,
    "source_id" text,
    "label" text not null,
    "summary" text not null,
    "payload" jsonb,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."medical_certificates" (
    "id" uuid not null default gen_random_uuid(),
    "certificate_no" text not null,
    "patient_id" text not null,
    "encounter_id" uuid not null,
    "consultation_id" uuid not null,
    "issued_at" timestamp with time zone not null default now(),
    "valid_until" timestamp with time zone not null default (now() + '30 days'::interval),
    "status" text not null default 'draft'::text,
    "patient_full_name" text not null,
    "patient_birthdate" date,
    "patient_age" numeric,
    "patient_sex" text,
    "patient_address" text,
    "diagnosis_source" text not null default 'consultation'::text,
    "diagnosis_text" text,
    "remarks" text,
    "advice" text,
    "findings_summary" text,
    "physical_exam" jsonb not null,
    "supporting_data" jsonb not null default '[]'::jsonb,
    "patient_snapshot" jsonb not null,
    "consultation_snapshot" jsonb,
    "doctor_snapshot" jsonb not null,
    "doctor_id" uuid not null,
    "doctor_branch" text,
    "qr_token" text not null,
    "verification_code" text not null,
    "printed_at" timestamp with time zone,
    "void_reason" text,
    "created_by_doctor_id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."meds" (
    "id" uuid not null default gen_random_uuid(),
    "generic_name" text,
    "strength" text,
    "form" text,
    "price" numeric(10,2),
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."note_templates" (
    "id" uuid not null default gen_random_uuid(),
    "doctor_id" uuid,
    "title" text not null,
    "template_type" text not null,
    "soap_template" jsonb,
    "markdown_template" text,
    "is_system" boolean not null default false,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );



  create table "public"."order_items" (
    "id" uuid not null default gen_random_uuid(),
    "encounter_id" uuid not null,
    "kind" text not null,
    "code_or_name" text not null,
    "qty" integer default 1,
    "unit_price" numeric(12,2),
    "price_override" numeric(12,2),
    "source" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."package_items" (
    "package_code" text not null,
    "test_code" text not null,
    "package_id" uuid not null,
    "test_id" uuid not null
      );



  create table "public"."packages" (
    "package_code" text not null,
    "display_name" text not null,
    "package_price" numeric(12,2),
    "id" uuid not null default gen_random_uuid()
      );



  create table "public"."patient_consents" (
    "id" uuid not null default gen_random_uuid(),
    "encounter_id" uuid not null,
    "consultation_id" uuid not null,
    "patient_id" text not null,
    "doctor_id" uuid not null,
    "template_slug" text not null,
    "template_version" integer not null,
    "doctor_attest" boolean not null default false,
    "doctor_signature_url" text,
    "patient_method" text not null,
    "patient_signature_url" text,
    "patient_typed_name" text,
    "consent_hash" text not null,
    "ip_hash" text,
    "user_agent" text,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "signer_kind" text default 'patient'::text,
    "signer_name" text,
    "signer_relation" text
      );



  create table "public"."patient_pin_reset_tokens" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "token" text not null,
    "expires_at" timestamp with time zone not null,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "attempt_count" integer not null default 0
      );


alter table "public"."patient_pin_reset_tokens" enable row level security;


  create table "public"."patient_self_monitoring" (
    "id" uuid not null default gen_random_uuid(),
    "patient_id" text not null,
    "parameter_key" text not null,
    "enabled" boolean not null default true,
    "doctor_requested" boolean not null default false,
    "frequency" text,
    "instructions" text,
    "consultation_id" uuid,
    "encounter_id" uuid,
    "doctor_id" uuid,
    "last_set_by" text not null default 'system'::text,
    "last_set_by_user" uuid,
    "last_set_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."patients" (
    "patient_id" text not null,
    "full_name" text,
    "sex" text,
    "birthday" date,
    "contact" text,
    "address" text,
    "email" text,
    "height_ft" text,
    "height_inch" text,
    "weight_kg" text,
    "systolic_bp" text,
    "diastolic_bp" text,
    "chief_complaint" text,
    "present_illness_history" text,
    "past_medical_history" text,
    "past_surgical_history" text,
    "allergies_text" text,
    "medications_current" text,
    "family_hx" text,
    "smoking_hx" text,
    "alcohol_hx" text,
    "last_updated" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "age" integer,
    "philhealth_pin" text,
    "membership_type" text,
    "atc_code" text,
    "delivery_address_label" text,
    "delivery_address_text" text,
    "delivery_lat" numeric(10,7),
    "delivery_lng" numeric(10,7),
    "delivery_notes" text,
    "last_delivery_used_at" timestamp with time zone,
    "last_delivery_success_at" timestamp with time zone,
    "pin_hash" text,
    "pin_set_at" timestamp with time zone,
    "last_login_at" timestamp with time zone
      );



  create table "public"."patients_import" (
    "patient_id" text not null,
    "full_name" text,
    "age" text,
    "sex" text,
    "birthday" text,
    "contact" text,
    "address" text,
    "email" text,
    "height_ft" text,
    "height_inch" text,
    "weight_kg" text,
    "systolic_bp" text,
    "diastolic_bp" text,
    "chief_complaint" text,
    "present_illness_history" text,
    "past_medical_history" text,
    "past_surgical_history" text,
    "allergies_text" text,
    "medications_current" text,
    "family_hx" text,
    "smoking_hx" text,
    "alcohol_hx" text,
    "last_updated" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
      );



  create table "public"."prescription_items" (
    "id" uuid not null default gen_random_uuid(),
    "prescription_id" uuid not null,
    "med_id" uuid,
    "generic_name" text,
    "strength" text,
    "form" text,
    "route" text,
    "dose_amount" numeric,
    "dose_unit" text,
    "frequency_code" text,
    "duration_days" integer,
    "quantity" numeric,
    "instructions" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "unit_price" numeric,
    "brand_name" text
      );



  create table "public"."prescriptions" (
    "id" uuid not null default gen_random_uuid(),
    "consultation_id" uuid not null,
    "patient_id" text not null,
    "doctor_id" uuid,
    "status" text not null default 'draft'::text,
    "notes_for_patient" text,
    "show_prices" boolean not null default false,
    "discount_type" text,
    "discount_value" numeric,
    "discount_expires_at" timestamp with time zone,
    "discount_applied_by" text,
    "final_total" numeric,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "want_pharmacy_order" boolean not null default false,
    "order_requested_at" timestamp with time zone,
    "delivery_address" text,
    "supersedes_prescription_id" uuid,
    "is_superseded" boolean not null default false,
    "active" boolean not null default false,
    "valid_days" integer not null default 30,
    "valid_until" timestamp with time zone
      );



  create table "public"."ranges" (
    "analyte_key" text not null,
    "label" text,
    "section" text,
    "unit" text,
    "type" text,
    "decimals" integer,
    "sex" text not null default ''::text,
    "age_min" numeric not null default '-1'::integer,
    "age_max" numeric not null default 999,
    "low" numeric,
    "high" numeric,
    "normal_values" text,
    "scaling_order" text
      );



  create table "public"."ranges_import" (
    "analyte_key" text,
    "label" text,
    "section" text,
    "unit" text,
    "type" text,
    "decimals" text,
    "sex" text,
    "age_min" text,
    "age_max" text,
    "low" text,
    "high" text,
    "normal_values" text,
    "scaling_order" text
      );



  create table "public"."results_flat" (
    "patient_id" text not null,
    "date_of_test" text not null,
    "barcode" text not null default ''::text,
    "analyte_key" text not null,
    "value" text,
    "notes" text,
    "branch" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "encounter_id" text,
    "performed_by_staff_id" uuid
      );



  create table "public"."results_wide" (
    "barcode" text not null default ''::text,
    "patient_id" text not null,
    "full_name" text,
    "age" text,
    "sex" text,
    "birthday" text,
    "contact" text,
    "address" text,
    "date_of_test" text not null,
    "notes" text,
    "hema_100" text,
    "hema_wbc" text,
    "hema_lymph" text,
    "hema_mid" text,
    "hema_gran" text,
    "hema_rbc" text,
    "hema_hgb" text,
    "hema_hct" text,
    "hema_mcv" text,
    "hema_mch" text,
    "hema_mchc" text,
    "hema_plt" text,
    "hema_bt" text,
    "hema_remarks" text,
    "chem_ogbase" text,
    "chem_og1st" text,
    "chem_og2nd" text,
    "chem_fbs" text,
    "chem_rbs" text,
    "chem_chole" text,
    "chem_trigly" text,
    "chem_hdl" text,
    "chem_ldl" text,
    "chem_vldl" text,
    "chem_bun" text,
    "chem_crea" text,
    "chem_bua" text,
    "chem_ast" text,
    "chem_alt" text,
    "chem_hba1c" text,
    "chem_tsh" text,
    "chem_ft3" text,
    "chem_ft4" text,
    "chem_t3" text,
    "chem_t4" text,
    "chem_psa" text,
    "chem_remarks" text,
    "ua_color" text,
    "ua_trans" text,
    "ua_glu" text,
    "ua_pro" text,
    "ua_ph" text,
    "ua_sg" text,
    "ua_blood" text,
    "ua_bilirubin" text,
    "ua_urobili" text,
    "ua_ketones" text,
    "ua_nitrites" text,
    "ua_le" text,
    "ua_cast" text,
    "ua_casttype" text,
    "ua_crystals" text,
    "ua_crystalstype" text,
    "ua_epi" text,
    "ua_muc" text,
    "ua_ura" text,
    "ua_pho" text,
    "ua_bac" text,
    "ua_pus" text,
    "ua_rbc" text,
    "ua_remarks" text,
    "fa_color" text,
    "fa_cons" text,
    "fa_pus" text,
    "fa_rbc" text,
    "fa_bac" text,
    "fa_yeast" text,
    "fa_fat" text,
    "fa_para" text,
    "fa_paratype" text,
    "fa_fobt" text,
    "fa_remarks" text,
    "sero_dengns1" text,
    "sero_dengm" text,
    "sero_dengg" text,
    "sero_hepab" text,
    "sero_rpv" text,
    "sero_hiv" text,
    "sero_hcv" text,
    "sero_pt" text,
    "sero_remarks" text,
    "branch" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "encounter_id" text
      );



  create table "public"."results_wide_import" (
    "barcode" text not null,
    "patient_id" text not null,
    "full_name" text,
    "age" text,
    "sex" text,
    "birthday" text,
    "contact" text,
    "address" text,
    "date_of_test" text not null,
    "notes" text,
    "hema_100" text,
    "hema_wbc" text,
    "hema_lymph" text,
    "hema_mid" text,
    "hema_gran" text,
    "hema_rbc" text,
    "hema_hgb" text,
    "hema_hct" text,
    "hema_mcv" text,
    "hema_mch" text,
    "hema_mchc" text,
    "hema_plt" text,
    "hema_bt" text,
    "hema_remarks" text,
    "chem_ogbase" text,
    "chem_og1st" text,
    "chem_og2nd" text,
    "chem_fbs" text,
    "chem_rbs" text,
    "chem_chole" text,
    "chem_trigly" text,
    "chem_hdl" text,
    "chem_ldl" text,
    "chem_vldl" text,
    "chem_bun" text,
    "chem_crea" text,
    "chem_bua" text,
    "chem_ast" text,
    "chem_alt" text,
    "chem_hba1c" text,
    "chem_tsh" text,
    "chem_ft3" text,
    "chem_ft4" text,
    "chem_t3" text,
    "chem_t4" text,
    "chem_psa" text,
    "chem_remarks" text,
    "ua_color" text,
    "ua_trans" text,
    "ua_glu" text,
    "ua_pro" text,
    "ua_ph" text,
    "ua_sg" text,
    "ua_blood" text,
    "ua_bilirubin" text,
    "ua_urobili" text,
    "ua_ketones" text,
    "ua_nitrites" text,
    "ua_le" text,
    "ua_cast" text,
    "ua_casttype" text,
    "ua_crystals" text,
    "ua_crystalstype" text,
    "ua_epi" text,
    "ua_muc" text,
    "ua_ura" text,
    "ua_pho" text,
    "ua_bac" text,
    "ua_pus" text,
    "ua_rbc" text,
    "ua_remarks" text,
    "fa_color" text,
    "fa_cons" text,
    "fa_pus" text,
    "fa_rbc" text,
    "fa_bac" text,
    "fa_yeast" text,
    "fa_fat" text,
    "fa_para" text,
    "fa_paratype" text,
    "fa_fobt" text,
    "fa_remarks" text,
    "sero_dengns1" text,
    "sero_dengm" text,
    "sero_dengg" text,
    "sero_hepab" text,
    "sero_rpv" text,
    "sero_hiv" text,
    "sero_hcv" text,
    "sero_pt" text,
    "sero_remarks" text,
    "branch" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "encounter_id" text
      );



  create table "public"."section_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "hub_code" text not null,
    "section" text not null,
    "staff_id" uuid not null,
    "effective_from" date not null,
    "effective_to" date,
    "created_at" timestamp with time zone not null default now(),
    "created_by_staff_id" uuid
      );



  create table "public"."staff" (
    "id" uuid not null default gen_random_uuid(),
    "staff_no" text not null default to_char(nextval('public.staff_no_seq'::regclass), 'FM0000'::text),
    "login_code" text not null,
    "first_name" text not null,
    "last_name" text not null,
    "birthday" date not null,
    "sex" text not null,
    "credentials" text,
    "prc_number" text,
    "position_title" text,
    "date_started" date,
    "pin_hash" text,
    "pin_set_at" timestamp with time zone,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by_staff_id" uuid,
    "updated_by_staff_id" uuid,
    "middle_name" text
      );



  create table "public"."supplies_batches" (
    "id" uuid not null default gen_random_uuid(),
    "branch_code" text not null,
    "item_id" uuid not null,
    "expiry_date" date not null,
    "total_pcs" integer not null,
    "remaining_pcs" integer not null,
    "received_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by_staff_id" uuid,
    "updated_by_staff_id" uuid
      );


alter table "public"."supplies_batches" enable row level security;


  create table "public"."supplies_dispenses" (
    "id" uuid not null default gen_random_uuid(),
    "inventory_id" uuid not null,
    "qty_pcs" integer not null,
    "dispensed_at" timestamp with time zone not null default now(),
    "dispensed_by_staff_id" uuid,
    "patient_id" uuid,
    "encounter_id" uuid,
    "reference" text,
    "notes" text,
    "batch_id" uuid
      );


alter table "public"."supplies_dispenses" enable row level security;


  create table "public"."supplies_inventory" (
    "id" uuid not null default gen_random_uuid(),
    "branch_code" text not null,
    "item_id" uuid not null,
    "packaging_count" integer not null,
    "total_pcs" integer not null,
    "remaining_pcs" integer not null,
    "expiry_date" date,
    "last_dispensed_at" timestamp with time zone,
    "last_received_at" timestamp with time zone,
    "reorder_level_pcs" integer,
    "hub_code" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by_staff_id" uuid,
    "updated_by_staff_id" uuid
      );


alter table "public"."supplies_inventory" enable row level security;


  create table "public"."supplies_items" (
    "id" uuid not null default gen_random_uuid(),
    "item_name" text not null,
    "packaging_type" public.packaging_type not null,
    "pcs_per_package" integer not null,
    "sku" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by_staff_id" uuid
      );


alter table "public"."supplies_items" enable row level security;


  create table "public"."tests_catalog" (
    "test_code" text not null,
    "display_name" text not null,
    "default_price" numeric(12,2),
    "is_active" boolean default true,
    "id" uuid not null default gen_random_uuid()
      );



  create table "public"."user_hubs" (
    "user_id" uuid not null,
    "hub_code" text not null,
    "role" text not null,
    "is_primary" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."vitals_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "consultation_id" uuid,
    "encounter_id" uuid not null,
    "patient_id" text not null,
    "measured_at" timestamp with time zone not null default now(),
    "systolic_bp" integer,
    "diastolic_bp" integer,
    "hr" integer,
    "rr" integer,
    "temp_c" numeric(4,1),
    "height_cm" numeric(5,2),
    "weight_kg" numeric(5,2),
    "bmi" numeric(5,2),
    "o2sat" integer,
    "notes" text,
    "source" text not null default 'doctor'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "created_by_initials" text not null,
    "blood_glucose_mgdl" numeric(6,1)
      );



  create table "public"."yakap_map_components" (
    "yakap_code" text not null,
    "analyte_key" text not null,
    "sex" text not null,
    "position" integer not null,
    "is_optional" boolean not null default false
      );



  create table "public"."yakap_map_tests" (
    "yakap_code" text not null,
    "yakap_name" text not null,
    "internal_code" text not null,
    "type" text not null
      );


alter sequence "public"."medical_certificate_supporting_items_id_seq" owned by "public"."medical_certificate_supporting_items"."id";

CREATE UNIQUE INDEX config_pkey ON public.config USING btree (key);

CREATE UNIQUE INDEX consent_templates_pkey ON public.consent_templates USING btree (id);

CREATE INDEX consent_templates_slug_idx ON public.consent_templates USING btree (slug);

CREATE UNIQUE INDEX consent_templates_slug_key ON public.consent_templates USING btree (slug);

CREATE UNIQUE INDEX consultation_diagnoses_pkey ON public.consultation_diagnoses USING btree (id);

CREATE UNIQUE INDEX consultations_pkey ON public.consultations USING btree (id);

CREATE UNIQUE INDEX doctor_notes_consultation_id_key ON public.doctor_notes USING btree (consultation_id);

CREATE UNIQUE INDEX doctor_notes_pkey ON public.doctor_notes USING btree (id);

CREATE UNIQUE INDEX doctors_code_key ON public.doctors USING btree (code);

CREATE UNIQUE INDEX doctors_pkey ON public.doctors USING btree (doctor_id);

CREATE INDEX ecg_cases_patient_idx ON public.ecg_cases USING btree (patient_id, uploaded_at DESC);

CREATE UNIQUE INDEX ecg_cases_pkey ON public.ecg_cases USING btree (id);

CREATE INDEX ecg_cases_status_idx ON public.ecg_cases USING btree (status, uploaded_at DESC);

CREATE INDEX ecg_reports_doctor_idx ON public.ecg_reports USING btree (doctor_id, interpreted_at DESC);

CREATE INDEX ecg_reports_encounter_idx ON public.ecg_reports USING btree (encounter_id);

CREATE INDEX ecg_reports_ext_result_idx ON public.ecg_reports USING btree (external_result_id);

CREATE UNIQUE INDEX ecg_reports_external_result_id_key ON public.ecg_reports USING btree (external_result_id);

CREATE INDEX ecg_reports_patient_idx ON public.ecg_reports USING btree (patient_id, interpreted_at DESC);

CREATE UNIQUE INDEX ecg_reports_pkey ON public.ecg_reports USING btree (id);

CREATE UNIQUE INDEX encounter_events_pkey ON public.encounter_events USING btree (id);

CREATE UNIQUE INDEX encounter_orders_pkey ON public.encounter_orders USING btree (encounter_id);

CREATE UNIQUE INDEX encounters_pkey ON public.encounters USING btree (id);

CREATE INDEX ext_results_category_idx ON public.external_results USING btree (category, subtype, taken_at DESC);

CREATE INDEX ext_results_ecg_recent_idx ON public.external_results USING btree (uploaded_at DESC) WHERE (type = 'ECG'::text);

CREATE INDEX ext_results_ecg_taken_idx ON public.external_results USING btree (taken_at DESC, uploaded_at DESC) WHERE (type = 'ECG'::text);

CREATE INDEX ext_results_encounter_idx ON public.external_results USING btree (encounter_id);

CREATE INDEX ext_results_patient_date_idx ON public.external_results USING btree (patient_id, taken_at DESC, uploaded_at DESC);

CREATE INDEX ext_results_patient_type_idx ON public.external_results USING btree (patient_id, type, taken_at DESC);

CREATE UNIQUE INDEX external_results_pkey ON public.external_results USING btree (id);

CREATE UNIQUE INDEX followup_attempts_pkey ON public.followup_attempts USING btree (id);

CREATE UNIQUE INDEX followups_pkey ON public.followups USING btree (id);

CREATE UNIQUE INDEX hubs_pkey ON public.hubs USING btree (code);

CREATE UNIQUE INDEX icd10_catalog_pkey ON public.icd10_catalog USING btree (icd10_code);

CREATE UNIQUE INDEX icd10_pkey ON public.icd10 USING btree (code);

CREATE INDEX idx_consultation_diagnoses_consult ON public.consultation_diagnoses USING btree (consultation_id);

CREATE INDEX idx_consultations_branch ON public.consultations USING btree (branch);

CREATE INDEX idx_consultations_encounter ON public.consultations USING btree (encounter_id);

CREATE INDEX idx_consultations_patient_date ON public.consultations USING btree (patient_id, visit_at DESC);

CREATE INDEX idx_doctor_notes_consult ON public.doctor_notes USING btree (consultation_id);

CREATE INDEX idx_doctors_code ON public.doctors USING btree (code);

CREATE INDEX idx_doctors_name ON public.doctors USING btree (display_name);

CREATE INDEX idx_enc_consult_hub_date_status ON public.encounters USING btree (branch_code, visit_date_local, consult_status);

CREATE INDEX idx_encounter_events_by_enc ON public.encounter_events USING btree (encounter_id);

CREATE INDEX idx_encounters_day_branch_priority ON public.encounters USING btree (visit_date_local, branch_code, priority DESC);

CREATE INDEX idx_encounters_patient ON public.encounters USING btree (patient_id, visit_date_local);

CREATE INDEX idx_encounters_patient_day ON public.encounters USING btree (patient_id, visit_date_local);

CREATE INDEX idx_encounters_today ON public.encounters USING btree (visit_date_local, branch_code, status);

CREATE INDEX idx_encounters_today_branch ON public.encounters USING btree (visit_date_local, branch_code);

CREATE INDEX idx_events_enc_ts ON public.encounter_events USING btree (encounter_id, ts);

CREATE INDEX idx_flat_pid_date ON public.results_flat USING btree (patient_id, date_of_test);

CREATE INDEX idx_followups_due ON public.followups USING btree (due_date);

CREATE INDEX idx_followups_patient ON public.followups USING btree (patient_id);

CREATE INDEX idx_followups_status ON public.followups USING btree (status);

CREATE INDEX idx_icd10_code ON public.icd10 USING btree (code);

CREATE INDEX idx_icd10_title_trigram ON public.icd10 USING gin (title public.gin_trgm_ops);

CREATE INDEX idx_med_cert_consultation ON public.medical_certificates USING btree (consultation_id);

CREATE INDEX idx_med_cert_encounter ON public.medical_certificates USING btree (encounter_id);

CREATE INDEX idx_med_cert_patient ON public.medical_certificates USING btree (patient_id);

CREATE INDEX idx_med_cert_qr_token ON public.medical_certificates USING btree (qr_token);

CREATE INDEX idx_med_cert_supporting_certificate ON public.medical_certificate_supporting_items USING btree (certificate_id);

CREATE INDEX idx_meds_active ON public.meds USING btree (is_active);

CREATE INDEX idx_meds_generic ON public.meds USING btree (generic_name);

CREATE INDEX idx_order_items_by_enc ON public.order_items USING btree (encounter_id);

CREATE INDEX idx_order_items_enc ON public.order_items USING btree (encounter_id);

CREATE INDEX idx_package_items_package_id ON public.package_items USING btree (package_id);

CREATE INDEX idx_package_items_test_id ON public.package_items USING btree (test_id);

CREATE INDEX idx_pin_reset_expires_at ON public.patient_pin_reset_tokens USING btree (expires_at);

CREATE INDEX idx_pin_reset_patient_id_created_at ON public.patient_pin_reset_tokens USING btree (patient_id, created_at DESC);

CREATE INDEX idx_pin_reset_used_at ON public.patient_pin_reset_tokens USING btree (used_at);

CREATE INDEX idx_prescription_items_prescription ON public.prescription_items USING btree (prescription_id);

CREATE INDEX idx_prescriptions_consult_status ON public.prescriptions USING btree (consultation_id, status);

CREATE INDEX idx_prescriptions_consultation_id ON public.prescriptions USING btree (consultation_id);

CREATE INDEX idx_prescriptions_patient_status_date ON public.prescriptions USING btree (patient_id, status, created_at DESC);

CREATE INDEX idx_psm_doctor_requested ON public.patient_self_monitoring USING btree (doctor_requested, patient_id);

CREATE INDEX idx_psm_patient ON public.patient_self_monitoring USING btree (patient_id);

CREATE INDEX idx_results_flat_encounter ON public.results_flat USING btree (encounter_id);

CREATE INDEX idx_results_flat_performed_by ON public.results_flat USING btree (performed_by_staff_id);

CREATE INDEX idx_results_flat_pk_like ON public.results_flat USING btree (patient_id, date_of_test, barcode, analyte_key);

CREATE INDEX idx_results_wide_barcode ON public.results_wide USING btree (barcode);

CREATE INDEX idx_results_wide_patient ON public.results_wide USING btree (patient_id);

CREATE INDEX idx_results_wide_updated ON public.results_wide USING btree (updated_at);

CREATE INDEX idx_vitals_consult ON public.vitals_snapshots USING btree (consultation_id, measured_at DESC);

CREATE INDEX idx_vitals_consult_measured ON public.vitals_snapshots USING btree (consultation_id, measured_at DESC);

CREATE INDEX idx_vitals_created_by_initials ON public.vitals_snapshots USING btree (created_by_initials);

CREATE INDEX idx_vitals_encounter_measured ON public.vitals_snapshots USING btree (encounter_id, measured_at DESC);

CREATE INDEX idx_vitals_patient_measured ON public.vitals_snapshots USING btree (patient_id, measured_at DESC);

CREATE INDEX idx_vitals_patient_source_measured ON public.vitals_snapshots USING btree (patient_id, source, measured_at DESC);

CREATE INDEX idx_wide_pid_date ON public.results_wide USING btree (patient_id, date_of_test);

CREATE INDEX idx_yakap_components_order ON public.yakap_map_components USING btree (yakap_code, "position");

CREATE UNIQUE INDEX medical_certificate_supporting_items_pkey ON public.medical_certificate_supporting_items USING btree (id);

CREATE UNIQUE INDEX medical_certificates_certificate_no_key ON public.medical_certificates USING btree (certificate_no);

CREATE UNIQUE INDEX medical_certificates_pkey ON public.medical_certificates USING btree (id);

CREATE UNIQUE INDEX medical_certificates_qr_token_key ON public.medical_certificates USING btree (qr_token);

CREATE UNIQUE INDEX medical_certificates_verification_code_key ON public.medical_certificates USING btree (verification_code);

CREATE UNIQUE INDEX meds_pkey ON public.meds USING btree (id);

CREATE UNIQUE INDEX note_templates_pkey ON public.note_templates USING btree (id);

CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id);

CREATE UNIQUE INDEX package_items_pkey ON public.package_items USING btree (package_code, test_code);

CREATE UNIQUE INDEX packages_id_uq ON public.packages USING btree (id);

CREATE UNIQUE INDEX packages_package_code_uq ON public.packages USING btree (package_code);

CREATE UNIQUE INDEX packages_pkey ON public.packages USING btree (id);

CREATE INDEX patient_consents_consult_idx ON public.patient_consents USING btree (consultation_id);

CREATE INDEX patient_consents_encounter_idx ON public.patient_consents USING btree (encounter_id);

CREATE INDEX patient_consents_patient_idx ON public.patient_consents USING btree (patient_id);

CREATE UNIQUE INDEX patient_consents_pkey ON public.patient_consents USING btree (id);

CREATE UNIQUE INDEX patient_pin_reset_tokens_pkey ON public.patient_pin_reset_tokens USING btree (id);

CREATE UNIQUE INDEX patient_pin_reset_tokens_token_key ON public.patient_pin_reset_tokens USING btree (token);

CREATE UNIQUE INDEX patient_self_monitoring_pkey ON public.patient_self_monitoring USING btree (id);

CREATE UNIQUE INDEX patients_import_pkey ON public.patients_import USING btree (patient_id);

CREATE UNIQUE INDEX patients_import_uq ON public.patients_import USING btree (patient_id);

CREATE UNIQUE INDEX patients_pkey ON public.patients USING btree (patient_id);

CREATE UNIQUE INDEX prescription_items_pkey ON public.prescription_items USING btree (id);

CREATE UNIQUE INDEX prescriptions_pkey ON public.prescriptions USING btree (id);

CREATE UNIQUE INDEX ranges_pkey ON public.ranges USING btree (analyte_key, sex, age_min, age_max);

CREATE UNIQUE INDEX results_flat_pkey ON public.results_flat USING btree (patient_id, date_of_test, barcode, analyte_key);

CREATE UNIQUE INDEX results_flat_unique_visit_analyte ON public.results_flat USING btree (patient_id, date_of_test, barcode, analyte_key);

CREATE UNIQUE INDEX results_wide_import_uq ON public.results_wide_import USING btree (patient_id, date_of_test, barcode);

CREATE UNIQUE INDEX results_wide_pkey ON public.results_wide USING btree (patient_id, date_of_test, barcode);

CREATE UNIQUE INDEX section_assignments_one_active_per_hub_section ON public.section_assignments USING btree (hub_code, section) WHERE (effective_to IS NULL);

CREATE UNIQUE INDEX section_assignments_pkey ON public.section_assignments USING btree (id);

CREATE INDEX staff_last_name_idx ON public.staff USING btree (last_name);

CREATE INDEX staff_login_code_idx ON public.staff USING btree (login_code);

CREATE UNIQUE INDEX staff_login_code_key ON public.staff USING btree (login_code);

CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id);

CREATE UNIQUE INDEX staff_staff_no_key ON public.staff USING btree (staff_no);

CREATE INDEX supplies_batches_branch_item_exp_idx ON public.supplies_batches USING btree (branch_code, item_id, expiry_date);

CREATE INDEX supplies_batches_expiry_idx ON public.supplies_batches USING btree (expiry_date);

CREATE UNIQUE INDEX supplies_batches_pkey ON public.supplies_batches USING btree (id);

CREATE INDEX supplies_dispenses_batch_id_idx ON public.supplies_dispenses USING btree (batch_id);

CREATE INDEX supplies_dispenses_dispensed_at_idx ON public.supplies_dispenses USING btree (dispensed_at);

CREATE INDEX supplies_dispenses_inventory_id_idx ON public.supplies_dispenses USING btree (inventory_id);

CREATE UNIQUE INDEX supplies_dispenses_pkey ON public.supplies_dispenses USING btree (id);

CREATE INDEX supplies_inventory_branch_code_idx ON public.supplies_inventory USING btree (branch_code);

CREATE UNIQUE INDEX supplies_inventory_branch_item_unique ON public.supplies_inventory USING btree (branch_code, item_id);

CREATE INDEX supplies_inventory_expiry_date_idx ON public.supplies_inventory USING btree (expiry_date);

CREATE INDEX supplies_inventory_item_id_idx ON public.supplies_inventory USING btree (item_id);

CREATE UNIQUE INDEX supplies_inventory_pkey ON public.supplies_inventory USING btree (id);

CREATE UNIQUE INDEX supplies_items_item_name_ci_unique ON public.supplies_items USING btree (lower(item_name));

CREATE UNIQUE INDEX supplies_items_pkey ON public.supplies_items USING btree (id);

CREATE UNIQUE INDEX tests_catalog_id_uq ON public.tests_catalog USING btree (id);

CREATE UNIQUE INDEX tests_catalog_pkey ON public.tests_catalog USING btree (id);

CREATE UNIQUE INDEX tests_catalog_test_code_uq ON public.tests_catalog USING btree (test_code);

CREATE UNIQUE INDEX uniq_active_signed_per_consultation ON public.prescriptions USING btree (consultation_id) WHERE ((status = 'signed'::text) AND (active IS TRUE));

CREATE UNIQUE INDEX uniq_consult_patient_phday ON public.consultations USING btree (patient_id, (((visit_at AT TIME ZONE 'Asia/Manila'::text))::date));

CREATE UNIQUE INDEX uniq_draft_per_consultation ON public.prescriptions USING btree (consultation_id) WHERE (status = 'draft'::text);

CREATE UNIQUE INDEX uniq_followups_one_active_per_patient ON public.followups USING btree (patient_id) WHERE (status = 'scheduled'::text);

CREATE UNIQUE INDEX uq_diag_one_primary_per_consult ON public.consultation_diagnoses USING btree (consultation_id) WHERE is_primary;

CREATE UNIQUE INDEX uq_enc_consult_queue_active ON public.encounters USING btree (branch_code, visit_date_local, queue_number) WHERE ((consult_status = ANY (ARRAY['queued_for_consult'::text, 'in_consult'::text])) AND (queue_number IS NOT NULL));

CREATE UNIQUE INDEX uq_encounters_current_consult ON public.encounters USING btree (current_consultation_id) WHERE (current_consultation_id IS NOT NULL);

CREATE UNIQUE INDEX user_hubs_pkey ON public.user_hubs USING btree (user_id, hub_code, role);

CREATE UNIQUE INDEX ux_psm_patient_param ON public.patient_self_monitoring USING btree (patient_id, parameter_key);

CREATE UNIQUE INDEX vitals_snapshots_pkey ON public.vitals_snapshots USING btree (id);

CREATE UNIQUE INDEX yakap_map_components_pkey ON public.yakap_map_components USING btree (yakap_code, analyte_key, sex);

CREATE UNIQUE INDEX yakap_map_tests_pkey ON public.yakap_map_tests USING btree (yakap_code);

alter table "public"."config" add constraint "config_pkey" PRIMARY KEY using index "config_pkey";

alter table "public"."consent_templates" add constraint "consent_templates_pkey" PRIMARY KEY using index "consent_templates_pkey";

alter table "public"."consultation_diagnoses" add constraint "consultation_diagnoses_pkey" PRIMARY KEY using index "consultation_diagnoses_pkey";

alter table "public"."consultations" add constraint "consultations_pkey" PRIMARY KEY using index "consultations_pkey";

alter table "public"."doctor_notes" add constraint "doctor_notes_pkey" PRIMARY KEY using index "doctor_notes_pkey";

alter table "public"."doctors" add constraint "doctors_pkey" PRIMARY KEY using index "doctors_pkey";

alter table "public"."ecg_cases" add constraint "ecg_cases_pkey" PRIMARY KEY using index "ecg_cases_pkey";

alter table "public"."ecg_reports" add constraint "ecg_reports_pkey" PRIMARY KEY using index "ecg_reports_pkey";

alter table "public"."encounter_events" add constraint "encounter_events_pkey" PRIMARY KEY using index "encounter_events_pkey";

alter table "public"."encounter_orders" add constraint "encounter_orders_pkey" PRIMARY KEY using index "encounter_orders_pkey";

alter table "public"."encounters" add constraint "encounters_pkey" PRIMARY KEY using index "encounters_pkey";

alter table "public"."external_results" add constraint "external_results_pkey" PRIMARY KEY using index "external_results_pkey";

alter table "public"."followup_attempts" add constraint "followup_attempts_pkey" PRIMARY KEY using index "followup_attempts_pkey";

alter table "public"."followups" add constraint "followups_pkey" PRIMARY KEY using index "followups_pkey";

alter table "public"."hubs" add constraint "hubs_pkey" PRIMARY KEY using index "hubs_pkey";

alter table "public"."icd10" add constraint "icd10_pkey" PRIMARY KEY using index "icd10_pkey";

alter table "public"."icd10_catalog" add constraint "icd10_catalog_pkey" PRIMARY KEY using index "icd10_catalog_pkey";

alter table "public"."medical_certificate_supporting_items" add constraint "medical_certificate_supporting_items_pkey" PRIMARY KEY using index "medical_certificate_supporting_items_pkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_pkey" PRIMARY KEY using index "medical_certificates_pkey";

alter table "public"."meds" add constraint "meds_pkey" PRIMARY KEY using index "meds_pkey";

alter table "public"."note_templates" add constraint "note_templates_pkey" PRIMARY KEY using index "note_templates_pkey";

alter table "public"."order_items" add constraint "order_items_pkey" PRIMARY KEY using index "order_items_pkey";

alter table "public"."package_items" add constraint "package_items_pkey" PRIMARY KEY using index "package_items_pkey";

alter table "public"."packages" add constraint "packages_pkey" PRIMARY KEY using index "packages_pkey";

alter table "public"."patient_consents" add constraint "patient_consents_pkey" PRIMARY KEY using index "patient_consents_pkey";

alter table "public"."patient_pin_reset_tokens" add constraint "patient_pin_reset_tokens_pkey" PRIMARY KEY using index "patient_pin_reset_tokens_pkey";

alter table "public"."patient_self_monitoring" add constraint "patient_self_monitoring_pkey" PRIMARY KEY using index "patient_self_monitoring_pkey";

alter table "public"."patients" add constraint "patients_pkey" PRIMARY KEY using index "patients_pkey";

alter table "public"."patients_import" add constraint "patients_import_pkey" PRIMARY KEY using index "patients_import_pkey";

alter table "public"."prescription_items" add constraint "prescription_items_pkey" PRIMARY KEY using index "prescription_items_pkey";

alter table "public"."prescriptions" add constraint "prescriptions_pkey" PRIMARY KEY using index "prescriptions_pkey";

alter table "public"."ranges" add constraint "ranges_pkey" PRIMARY KEY using index "ranges_pkey";

alter table "public"."results_flat" add constraint "results_flat_pkey" PRIMARY KEY using index "results_flat_pkey";

alter table "public"."results_wide" add constraint "results_wide_pkey" PRIMARY KEY using index "results_wide_pkey";

alter table "public"."section_assignments" add constraint "section_assignments_pkey" PRIMARY KEY using index "section_assignments_pkey";

alter table "public"."staff" add constraint "staff_pkey" PRIMARY KEY using index "staff_pkey";

alter table "public"."supplies_batches" add constraint "supplies_batches_pkey" PRIMARY KEY using index "supplies_batches_pkey";

alter table "public"."supplies_dispenses" add constraint "supplies_dispenses_pkey" PRIMARY KEY using index "supplies_dispenses_pkey";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_pkey" PRIMARY KEY using index "supplies_inventory_pkey";

alter table "public"."supplies_items" add constraint "supplies_items_pkey" PRIMARY KEY using index "supplies_items_pkey";

alter table "public"."tests_catalog" add constraint "tests_catalog_pkey" PRIMARY KEY using index "tests_catalog_pkey";

alter table "public"."user_hubs" add constraint "user_hubs_pkey" PRIMARY KEY using index "user_hubs_pkey";

alter table "public"."vitals_snapshots" add constraint "vitals_snapshots_pkey" PRIMARY KEY using index "vitals_snapshots_pkey";

alter table "public"."yakap_map_components" add constraint "yakap_map_components_pkey" PRIMARY KEY using index "yakap_map_components_pkey";

alter table "public"."yakap_map_tests" add constraint "yakap_map_tests_pkey" PRIMARY KEY using index "yakap_map_tests_pkey";

alter table "public"."consent_templates" add constraint "consent_templates_slug_key" UNIQUE using index "consent_templates_slug_key";

alter table "public"."consultation_diagnoses" add constraint "consultation_diagnoses_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."consultation_diagnoses" validate constraint "consultation_diagnoses_consultation_id_fkey";

alter table "public"."consultation_diagnoses" add constraint "consultation_diagnoses_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."consultation_diagnoses" validate constraint "consultation_diagnoses_encounter_id_fkey";

alter table "public"."consultations" add constraint "consultations_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) ON DELETE SET NULL not valid;

alter table "public"."consultations" validate constraint "consultations_doctor_id_fkey";

alter table "public"."consultations" add constraint "consultations_signing_doctor_id_fkey" FOREIGN KEY (signing_doctor_id) REFERENCES public.doctors(doctor_id) not valid;

alter table "public"."consultations" validate constraint "consultations_signing_doctor_id_fkey";

alter table "public"."consultations" add constraint "consultations_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'final'::text]))) not valid;

alter table "public"."consultations" validate constraint "consultations_status_check";

alter table "public"."consultations" add constraint "consultations_type_check" CHECK ((type = ANY (ARRAY['FPE'::text, 'FollowUp'::text, 'Tele'::text, 'WalkInLabOnly'::text]))) not valid;

alter table "public"."consultations" validate constraint "consultations_type_check";

alter table "public"."doctor_notes" add constraint "doctor_notes_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."doctor_notes" validate constraint "doctor_notes_consultation_id_fkey";

alter table "public"."doctor_notes" add constraint "doctor_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.doctors(doctor_id) ON DELETE SET NULL not valid;

alter table "public"."doctor_notes" validate constraint "doctor_notes_created_by_fkey";

alter table "public"."doctor_notes" add constraint "fk_doctor_notes_consult" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."doctor_notes" validate constraint "fk_doctor_notes_consult";

alter table "public"."doctors" add constraint "doctors_code_key" UNIQUE using index "doctors_code_key";

alter table "public"."ecg_cases" add constraint "ecg_cases_external_result_id_fkey" FOREIGN KEY (external_result_id) REFERENCES public.external_results(id) ON DELETE SET NULL not valid;

alter table "public"."ecg_cases" validate constraint "ecg_cases_external_result_id_fkey";

alter table "public"."ecg_cases" add constraint "ecg_cases_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'signed'::text, 'returned'::text]))) not valid;

alter table "public"."ecg_cases" validate constraint "ecg_cases_status_check";

alter table "public"."ecg_reports" add constraint "ecg_reports_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) ON DELETE RESTRICT not valid;

alter table "public"."ecg_reports" validate constraint "ecg_reports_doctor_id_fkey";

alter table "public"."ecg_reports" add constraint "ecg_reports_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE RESTRICT not valid;

alter table "public"."ecg_reports" validate constraint "ecg_reports_encounter_id_fkey";

alter table "public"."ecg_reports" add constraint "ecg_reports_external_result_id_fkey" FOREIGN KEY (external_result_id) REFERENCES public.external_results(id) ON DELETE CASCADE not valid;

alter table "public"."ecg_reports" validate constraint "ecg_reports_external_result_id_fkey";

alter table "public"."ecg_reports" add constraint "ecg_reports_external_result_id_key" UNIQUE using index "ecg_reports_external_result_id_key";

alter table "public"."encounter_events" add constraint "encounter_events_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."encounter_events" validate constraint "encounter_events_encounter_id_fkey";

alter table "public"."encounter_orders" add constraint "encounter_orders_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."encounter_orders" validate constraint "encounter_orders_encounter_id_fkey";

alter table "public"."encounters" add constraint "encounters_branch_code_check" CHECK ((branch_code = ANY (ARRAY['SI'::text, 'SL'::text]))) not valid;

alter table "public"."encounters" validate constraint "encounters_branch_code_check";

alter table "public"."encounters" add constraint "encounters_consult_status_check" CHECK (((consult_status IS NULL) OR (consult_status = ANY (ARRAY['queued_for_consult'::text, 'in_consult'::text, 'done'::text, 'cancelled'::text])))) not valid;

alter table "public"."encounters" validate constraint "encounters_consult_status_check";

alter table "public"."encounters" add constraint "encounters_discount_amount_nonnegative" CHECK ((discount_amount >= 0)) not valid;

alter table "public"."encounters" validate constraint "encounters_discount_amount_nonnegative";

alter table "public"."encounters" add constraint "encounters_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."encounters" validate constraint "encounters_patient_id_fkey";

alter table "public"."encounters" add constraint "encounters_status_check" CHECK ((status = ANY (ARRAY['intake'::text, 'for-extract'::text, 'extracted'::text, 'for-processing'::text, 'done'::text, 'cancelled'::text]))) not valid;

alter table "public"."encounters" validate constraint "encounters_status_check";

alter table "public"."external_results" add constraint "external_results_type_not_blank" CHECK ((length(TRIM(BOTH FROM type)) > 0)) not valid;

alter table "public"."external_results" validate constraint "external_results_type_not_blank";

alter table "public"."followup_attempts" add constraint "followup_attempts_followup_id_fkey" FOREIGN KEY (followup_id) REFERENCES public.followups(id) ON DELETE CASCADE not valid;

alter table "public"."followup_attempts" validate constraint "followup_attempts_followup_id_fkey";

alter table "public"."medical_certificate_supporting_items" add constraint "medical_certificate_supporting_items_certificate_id_fkey" FOREIGN KEY (certificate_id) REFERENCES public.medical_certificates(id) ON DELETE CASCADE not valid;

alter table "public"."medical_certificate_supporting_items" validate constraint "medical_certificate_supporting_items_certificate_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_certificate_no_key" UNIQUE using index "medical_certificates_certificate_no_key";

alter table "public"."medical_certificates" add constraint "medical_certificates_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_consultation_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_created_by_doctor_id_fkey" FOREIGN KEY (created_by_doctor_id) REFERENCES public.doctors(doctor_id) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_created_by_doctor_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_doctor_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_encounter_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_patient_id_fkey" FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_patient_id_fkey";

alter table "public"."medical_certificates" add constraint "medical_certificates_qr_token_key" UNIQUE using index "medical_certificates_qr_token_key";

alter table "public"."medical_certificates" add constraint "medical_certificates_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'void'::text]))) not valid;

alter table "public"."medical_certificates" validate constraint "medical_certificates_status_check";

alter table "public"."medical_certificates" add constraint "medical_certificates_verification_code_key" UNIQUE using index "medical_certificates_verification_code_key";

alter table "public"."note_templates" add constraint "note_templates_content_check" CHECK ((((template_type = 'SOAP'::text) AND (soap_template IS NOT NULL)) OR ((template_type = 'MARKDOWN'::text) AND (markdown_template IS NOT NULL)))) not valid;

alter table "public"."note_templates" validate constraint "note_templates_content_check";

alter table "public"."note_templates" add constraint "note_templates_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) not valid;

alter table "public"."note_templates" validate constraint "note_templates_doctor_id_fkey";

alter table "public"."note_templates" add constraint "note_templates_template_type_check" CHECK ((template_type = ANY (ARRAY['SOAP'::text, 'MARKDOWN'::text]))) not valid;

alter table "public"."note_templates" validate constraint "note_templates_template_type_check";

alter table "public"."order_items" add constraint "order_items_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."order_items" validate constraint "order_items_encounter_id_fkey";

alter table "public"."order_items" add constraint "order_items_kind_check" CHECK ((kind = ANY (ARRAY['test'::text, 'package'::text, 'manual'::text]))) not valid;

alter table "public"."order_items" validate constraint "order_items_kind_check";

alter table "public"."order_items" add constraint "order_items_source_check" CHECK ((source = ANY (ARRAY['frontdesk'::text, 'rmt'::text]))) not valid;

alter table "public"."order_items" validate constraint "order_items_source_check";

alter table "public"."package_items" add constraint "package_items_package_id_fkey" FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT not valid;

alter table "public"."package_items" validate constraint "package_items_package_id_fkey";

alter table "public"."package_items" add constraint "package_items_test_id_fkey" FOREIGN KEY (test_id) REFERENCES public.tests_catalog(id) ON DELETE RESTRICT not valid;

alter table "public"."package_items" validate constraint "package_items_test_id_fkey";

alter table "public"."packages" add constraint "packages_id_uq" UNIQUE using index "packages_id_uq";

alter table "public"."packages" add constraint "packages_package_code_uq" UNIQUE using index "packages_package_code_uq";

alter table "public"."patient_consents" add constraint "patient_consents_consultations_fk" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_consultations_fk";

alter table "public"."patient_consents" add constraint "patient_consents_doctors_fk" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_doctors_fk";

alter table "public"."patient_consents" add constraint "patient_consents_encounters_fk" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_encounters_fk";

alter table "public"."patient_consents" add constraint "patient_consents_patient_method_check" CHECK ((patient_method = ANY (ARRAY['drawn'::text, 'typed'::text]))) not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_patient_method_check";

alter table "public"."patient_consents" add constraint "patient_consents_patients_fk" FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_patients_fk";

alter table "public"."patient_consents" add constraint "patient_consents_signer_kind_check" CHECK ((signer_kind = ANY (ARRAY['patient'::text, 'guardian'::text, 'representative'::text]))) not valid;

alter table "public"."patient_consents" validate constraint "patient_consents_signer_kind_check";

alter table "public"."patient_pin_reset_tokens" add constraint "patient_pin_reset_tokens_token_key" UNIQUE using index "patient_pin_reset_tokens_token_key";

alter table "public"."patient_self_monitoring" add constraint "patient_self_monitoring_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL not valid;

alter table "public"."patient_self_monitoring" validate constraint "patient_self_monitoring_consultation_id_fkey";

alter table "public"."patient_self_monitoring" add constraint "patient_self_monitoring_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE SET NULL not valid;

alter table "public"."patient_self_monitoring" validate constraint "patient_self_monitoring_encounter_id_fkey";

alter table "public"."patient_self_monitoring" add constraint "patient_self_monitoring_parameter_key_check" CHECK ((parameter_key = ANY (ARRAY['bp'::text, 'weight'::text, 'glucose'::text]))) not valid;

alter table "public"."patient_self_monitoring" validate constraint "patient_self_monitoring_parameter_key_check";

alter table "public"."prescription_items" add constraint "fk_items_rx" FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE not valid;

alter table "public"."prescription_items" validate constraint "fk_items_rx";

alter table "public"."prescription_items" add constraint "prescription_items_med_id_fkey" FOREIGN KEY (med_id) REFERENCES public.meds(id) ON DELETE SET NULL not valid;

alter table "public"."prescription_items" validate constraint "prescription_items_med_id_fkey";

alter table "public"."prescription_items" add constraint "prescription_items_prescription_id_fkey" FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE not valid;

alter table "public"."prescription_items" validate constraint "prescription_items_prescription_id_fkey";

alter table "public"."prescriptions" add constraint "prescriptions_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."prescriptions" validate constraint "prescriptions_consultation_id_fkey";

alter table "public"."prescriptions" add constraint "prescriptions_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percent'::text, 'amount'::text]))) not valid;

alter table "public"."prescriptions" validate constraint "prescriptions_discount_type_check";

alter table "public"."prescriptions" add constraint "prescriptions_doctor_id_fkey" FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id) ON DELETE SET NULL not valid;

alter table "public"."prescriptions" validate constraint "prescriptions_doctor_id_fkey";

alter table "public"."prescriptions" add constraint "prescriptions_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'signed'::text]))) not valid;

alter table "public"."prescriptions" validate constraint "prescriptions_status_check";

alter table "public"."prescriptions" add constraint "prescriptions_supersedes_prescription_id_fkey" FOREIGN KEY (supersedes_prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL not valid;

alter table "public"."prescriptions" validate constraint "prescriptions_supersedes_prescription_id_fkey";

alter table "public"."results_flat" add constraint "results_flat_performed_by_staff_fk" FOREIGN KEY (performed_by_staff_id) REFERENCES public.staff(id) not valid;

alter table "public"."results_flat" validate constraint "results_flat_performed_by_staff_fk";

alter table "public"."results_flat" add constraint "results_flat_unique_visit_analyte" UNIQUE using index "results_flat_unique_visit_analyte";

alter table "public"."section_assignments" add constraint "section_assignments_created_by_fkey" FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id) not valid;

alter table "public"."section_assignments" validate constraint "section_assignments_created_by_fkey";

alter table "public"."section_assignments" add constraint "section_assignments_hub_fkey" FOREIGN KEY (hub_code) REFERENCES public.hubs(code) not valid;

alter table "public"."section_assignments" validate constraint "section_assignments_hub_fkey";

alter table "public"."section_assignments" add constraint "section_assignments_staff_fkey" FOREIGN KEY (staff_id) REFERENCES public.staff(id) not valid;

alter table "public"."section_assignments" validate constraint "section_assignments_staff_fkey";

alter table "public"."staff" add constraint "staff_created_by_staff_id_fkey" FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id) not valid;

alter table "public"."staff" validate constraint "staff_created_by_staff_id_fkey";

alter table "public"."staff" add constraint "staff_login_code_has_role_prefix" CHECK ((POSITION(('-'::text) IN (login_code)) > 1)) not valid;

alter table "public"."staff" validate constraint "staff_login_code_has_role_prefix";

alter table "public"."staff" add constraint "staff_login_code_key" UNIQUE using index "staff_login_code_key";

alter table "public"."staff" add constraint "staff_staff_no_key" UNIQUE using index "staff_staff_no_key";

alter table "public"."staff" add constraint "staff_updated_by_staff_id_fkey" FOREIGN KEY (updated_by_staff_id) REFERENCES public.staff(id) not valid;

alter table "public"."staff" validate constraint "staff_updated_by_staff_id_fkey";

alter table "public"."supplies_batches" add constraint "supplies_batches_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.supplies_items(id) ON DELETE RESTRICT not valid;

alter table "public"."supplies_batches" validate constraint "supplies_batches_item_id_fkey";

alter table "public"."supplies_batches" add constraint "supplies_batches_remaining_le_total" CHECK ((remaining_pcs <= total_pcs)) not valid;

alter table "public"."supplies_batches" validate constraint "supplies_batches_remaining_le_total";

alter table "public"."supplies_batches" add constraint "supplies_batches_remaining_pcs_check" CHECK ((remaining_pcs >= 0)) not valid;

alter table "public"."supplies_batches" validate constraint "supplies_batches_remaining_pcs_check";

alter table "public"."supplies_batches" add constraint "supplies_batches_total_pcs_check" CHECK ((total_pcs >= 0)) not valid;

alter table "public"."supplies_batches" validate constraint "supplies_batches_total_pcs_check";

alter table "public"."supplies_dispenses" add constraint "supplies_dispenses_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES public.supplies_inventory(id) ON DELETE RESTRICT not valid;

alter table "public"."supplies_dispenses" validate constraint "supplies_dispenses_inventory_id_fkey";

alter table "public"."supplies_dispenses" add constraint "supplies_dispenses_qty_pcs_check" CHECK ((qty_pcs > 0)) not valid;

alter table "public"."supplies_dispenses" validate constraint "supplies_dispenses_qty_pcs_check";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.supplies_items(id) ON DELETE RESTRICT not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_item_id_fkey";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_packaging_count_check" CHECK ((packaging_count >= 0)) not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_packaging_count_check";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_remaining_le_total" CHECK ((remaining_pcs <= total_pcs)) not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_remaining_le_total";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_remaining_pcs_check" CHECK ((remaining_pcs >= 0)) not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_remaining_pcs_check";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_reorder_level_pcs_check" CHECK (((reorder_level_pcs IS NULL) OR (reorder_level_pcs >= 0))) not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_reorder_level_pcs_check";

alter table "public"."supplies_inventory" add constraint "supplies_inventory_total_pcs_check" CHECK ((total_pcs >= 0)) not valid;

alter table "public"."supplies_inventory" validate constraint "supplies_inventory_total_pcs_check";

alter table "public"."supplies_items" add constraint "supplies_items_pcs_per_package_check" CHECK ((pcs_per_package > 0)) not valid;

alter table "public"."supplies_items" validate constraint "supplies_items_pcs_per_package_check";

alter table "public"."tests_catalog" add constraint "tests_catalog_id_uq" UNIQUE using index "tests_catalog_id_uq";

alter table "public"."tests_catalog" add constraint "tests_catalog_test_code_uq" UNIQUE using index "tests_catalog_test_code_uq";

alter table "public"."user_hubs" add constraint "user_hubs_hub_code_fkey" FOREIGN KEY (hub_code) REFERENCES public.hubs(code) ON DELETE CASCADE not valid;

alter table "public"."user_hubs" validate constraint "user_hubs_hub_code_fkey";

alter table "public"."user_hubs" add constraint "user_hubs_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'doctor'::text, 'staff'::text]))) not valid;

alter table "public"."user_hubs" validate constraint "user_hubs_role_check";

alter table "public"."vitals_snapshots" add constraint "vitals_snapshots_consult_required_check" CHECK ((((source = ANY (ARRAY['staff'::text, 'doctor'::text])) AND (consultation_id IS NOT NULL)) OR (source = ANY (ARRAY['patient'::text, 'system'::text])))) not valid;

alter table "public"."vitals_snapshots" validate constraint "vitals_snapshots_consult_required_check";

alter table "public"."vitals_snapshots" add constraint "vitals_snapshots_consultation_id_fkey" FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE not valid;

alter table "public"."vitals_snapshots" validate constraint "vitals_snapshots_consultation_id_fkey";

alter table "public"."vitals_snapshots" add constraint "vitals_snapshots_encounter_id_fkey" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE not valid;

alter table "public"."vitals_snapshots" validate constraint "vitals_snapshots_encounter_id_fkey";

alter table "public"."vitals_snapshots" add constraint "vitals_snapshots_source_check" CHECK ((source = ANY (ARRAY['doctor'::text, 'staff'::text, 'patient'::text, 'system'::text]))) not valid;

alter table "public"."vitals_snapshots" validate constraint "vitals_snapshots_source_check";

alter table "public"."yakap_map_components" add constraint "yakap_map_components_sex_check" CHECK ((sex = ANY (ARRAY['ANY'::text, 'M'::text, 'F'::text]))) not valid;

alter table "public"."yakap_map_components" validate constraint "yakap_map_components_sex_check";

alter table "public"."yakap_map_components" add constraint "yakap_map_components_yakap_code_fkey" FOREIGN KEY (yakap_code) REFERENCES public.yakap_map_tests(yakap_code) ON DELETE CASCADE not valid;

alter table "public"."yakap_map_components" validate constraint "yakap_map_components_yakap_code_fkey";

alter table "public"."yakap_map_tests" add constraint "yakap_map_tests_type_check" CHECK ((type = ANY (ARRAY['single'::text, 'multi'::text]))) not valid;

alter table "public"."yakap_map_tests" validate constraint "yakap_map_tests_type_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clean_blank(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare s text;
begin
  if t is null then return null; end if;
  s := btrim(t);
  if s = '' then return null; end if;
  if lower(s) in ('-', 'n/a', 'na', 'null') then return null; end if;
  return s;
end; $function$
;

CREATE OR REPLACE FUNCTION public.consult_find_today_ph(p_patient_id text)
 RETURNS SETOF public.consultations
 LANGUAGE sql
 STABLE
AS $function$
  select *
  from consultations
  where patient_id = p_patient_id
    and (visit_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  order by visit_at desc
$function$
;

CREATE OR REPLACE FUNCTION public.doctor_login(p_code text, p_pin text)
 RETURNS TABLE(doctor_id uuid, display_name text, code text)
 LANGUAGE sql
 STABLE
AS $function$
  select d.doctor_id, d.display_name, d.code
  from public.doctors d
  where d.active = true
    and d.code = p_code
    and d.pin_hash = crypt(p_pin, d.pin_hash)
$function$
;

create or replace view "public"."encounters_today_v" as  SELECT id,
    patient_id,
    branch_code,
    visit_date_local,
    status,
    priority,
    is_philhealth_claim,
    yakap_flag,
    claim_notes,
    notes_frontdesk,
    locked_to_rmt,
    staging_synced,
    created_at,
    updated_at
   FROM public.encounters
  WHERE ((visit_date_local = (timezone('Asia/Manila'::text, now()))::date) AND (status <> 'cancelled'::text));


CREATE OR REPLACE FUNCTION public.enforce_upper_patient_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.patient_id := upper(new.patient_id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_ecg_reports_validate_and_fill()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  strip_patient text;
  enc_patient   text;
  d_active      boolean;
  d_name        text;
  d_full        text;
  d_creds       text;
  d_prc         text;
  d_ph_md_id    text;
  snap_name     text;
  snap_license  text;
begin
  -- external_results.patient_id
  select er.patient_id into strip_patient
  from public.external_results er
  where er.id = new.external_result_id;

  if strip_patient is null then
    raise exception 'external_result_id % not found in external_results', new.external_result_id;
  end if;

  -- encounters.patient_id
  select e.patient_id into enc_patient
  from public.encounters e
  where e.id = new.encounter_id;

  if enc_patient is null then
    raise exception 'encounter_id % not found in encounters', new.encounter_id;
  end if;

  -- enforce same patient across all 3 records
  if new.patient_id is null then
    new.patient_id := strip_patient;
  end if;

  if new.patient_id <> strip_patient then
    raise exception 'ecg_reports.patient_id (%) does not match strip patient_id (%)',
      new.patient_id, strip_patient;
  end if;

  if new.patient_id <> enc_patient then
    raise exception 'ecg_reports.patient_id (%) does not match encounter patient_id (%)',
      new.patient_id, enc_patient;
  end if;

  -- doctor must exist and be active; also fetch snapshot fields
  select active, display_name, full_name, credentials, prc_no, philhealth_md_id
    into d_active, d_name, d_full, d_creds, d_prc, d_ph_md_id
  from public.doctors
  where doctor_id = new.doctor_id;

  if d_active is null then
    raise exception 'doctor_id % not found in doctors', new.doctor_id;
  end if;

  if d_active = false then
    raise exception 'doctor_id % is inactive; cannot sign ECG report', new.doctor_id;
  end if;

  -- snapshot auto-fill if not provided
  if coalesce(nullif(trim(new.interpreted_name), ''), '') = '' then
    -- prefer display_name; else full_name + credentials
    if coalesce(nullif(trim(d_name), ''), '') <> '' then
      snap_name := d_name;
    else
      snap_name := coalesce(nullif(trim(d_full), ''), '');
      if coalesce(nullif(trim(d_creds), ''), '') <> '' then
        if snap_name = '' then
          snap_name := d_creds;
        else
          snap_name := snap_name || ', ' || d_creds;
        end if;
      end if;
      if snap_name = '' then
        snap_name := 'Doctor';
      end if;
    end if;
    new.interpreted_name := snap_name;
  end if;

  if coalesce(nullif(trim(new.interpreted_license), ''), '') = '' then
    -- prefer PRC; else PhilHealth MD ID (if any)
    if coalesce(nullif(trim(d_prc), ''), '') <> '' then
      snap_license := d_prc;
    elsif coalesce(nullif(trim(d_ph_md_id), ''), '') <> '' then
      snap_license := d_ph_md_id;
    else
      snap_license := null;
    end if;
    new.interpreted_license := snap_license;
  end if;

  -- ensure interpreted_at is set
  if new.interpreted_at is null then
    new.interpreted_at := now();
  end if;

  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.get_section_rmt_for_test(p_hub_code text, p_analyte_key text, p_date_of_test date)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  with analyte as (
    select section
    from public.ranges
    where analyte_key = p_analyte_key
  )
  select sa.staff_id
  from analyte a
  join public.section_assignments sa
    on sa.section = a.section
   and sa.hub_code = p_hub_code
   and sa.effective_from <= p_date_of_test
   and (sa.effective_to is null or sa.effective_to >= p_date_of_test)
  order by sa.effective_from desc   -- newest applicable assignment wins
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.log_encounter_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into public.encounter_events(encounter_id, event_type, actor_role)
  values (new.id, 'checkin', 'system');
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.log_encounter_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.status is distinct from old.status then
    insert into public.encounter_events(encounter_id, event_type, actor_role)
    values (
      new.id,
      case new.status
        when 'for-extract' then 'queued'
        when 'extracted' then 'start_extraction'
        when 'for-processing' then 'specimen_received'
        when 'done' then 'done'
        when 'cancelled' then 'cancelled'
        else 'status_change'
      end,
      'system'
    );
  end if;
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.merge_config_import()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  merge into config c
  using (
    select btrim(key) as key, coalesce(value,'') as value
    from config_import
    where btrim(coalesce(key,'')) <> ''
  ) i
  on (c.key = i.key)

  when not matched then
    insert (key, value) values (i.key, i.value)

  when matched then update set
    value = i.value;

  truncate table config_import;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_patients_import()
 RETURNS TABLE(inserted integer, updated integer)
 LANGUAGE plpgsql
AS $function$
declare 
  v_ins int := 0;
  v_upd int := 0;
begin
  /* INSERT new rows + UPDATE existing rows (fill blanks only) in one go via CTEs */
  with src as (
    select
      upper(btrim(pi.patient_id))                                   as patient_id,
      clean_blank(pi.full_name)                                     as full_name,
      clean_blank(pi.sex)                                           as sex,
      /* Sheets birthday MM/DD/YYYY -> DATE (nullable-safe) */
      case 
        when clean_blank(pi.birthday) is null then null
        else to_date(clean_blank(pi.birthday), 'MM/DD/YYYY')
      end                                                          as birthday,
      clean_blank(pi.contact)                                       as contact,
      clean_blank(pi.address)                                       as address,
      clean_blank(pi.email)                                         as email,
      clean_blank(pi.height_ft)                                     as height_ft,
      clean_blank(pi.height_inch)                                   as height_inch,
      clean_blank(pi.weight_kg)                                     as weight_kg,
      clean_blank(pi.systolic_bp)                                   as systolic_bp,
      clean_blank(pi.diastolic_bp)                                  as diastolic_bp,
      clean_blank(pi.chief_complaint)                               as chief_complaint,
      clean_blank(pi.present_illness_history)                       as present_illness_history,
      clean_blank(pi.past_medical_history)                          as past_medical_history,
      clean_blank(pi.past_surgical_history)                         as past_surgical_history,
      clean_blank(pi.allergies_text)                                as allergies_text,
      clean_blank(pi.medications_current)                           as medications_current,
      clean_blank(pi.family_hx)                                     as family_hx,
      clean_blank(pi.smoking_hx)                                    as smoking_hx,
      clean_blank(pi.alcohol_hx)                                    as alcohol_hx,
      /* keep as TEXT to match patients.last_updated text */
      clean_blank(pi.last_updated)                                  as last_updated
    from public.patients_import pi
  ),
  src_ok as (
    select * from src where coalesce(patient_id,'') <> ''
  ),
  upd as (
    update public.patients p
       set full_name                 = coalesce(p.full_name,                 s.full_name),
           sex                       = coalesce(p.sex,                       s.sex),
           birthday                  = coalesce(p.birthday,                  s.birthday),
           contact                   = coalesce(p.contact,                   s.contact),
           address                   = coalesce(p.address,                   s.address),
           email                     = coalesce(p.email,                     s.email),
           height_ft                 = coalesce(p.height_ft,                 s.height_ft),
           height_inch               = coalesce(p.height_inch,               s.height_inch),
           weight_kg                 = coalesce(p.weight_kg,                 s.weight_kg),
           systolic_bp               = coalesce(p.systolic_bp,               s.systolic_bp),
           diastolic_bp              = coalesce(p.diastolic_bp,              s.diastolic_bp),
           chief_complaint           = coalesce(p.chief_complaint,           s.chief_complaint),
           present_illness_history   = coalesce(p.present_illness_history,   s.present_illness_history),
           past_medical_history      = coalesce(p.past_medical_history,      s.past_medical_history),
           past_surgical_history     = coalesce(p.past_surgical_history,     s.past_surgical_history),
           allergies_text            = coalesce(p.allergies_text,            s.allergies_text),
           medications_current       = coalesce(p.medications_current,       s.medications_current),
           family_hx                 = coalesce(p.family_hx,                 s.family_hx),
           smoking_hx                = coalesce(p.smoking_hx,                s.smoking_hx),
           alcohol_hx                = coalesce(p.alcohol_hx,                s.alcohol_hx),
           last_updated              = coalesce(p.last_updated,              s.last_updated),
           updated_at                = now()
      from src_ok s
     where p.patient_id = s.patient_id
       /* run only if at least one NULL will be filled */
       and (
            (p.full_name               is null and s.full_name               is not null) or
            (p.sex                     is null and s.sex                     is not null) or
            (p.birthday                is null and s.birthday                is not null) or
            (p.contact                 is null and s.contact                 is not null) or
            (p.address                 is null and s.address                 is not null) or
            (p.email                   is null and s.email                   is not null) or
            (p.height_ft               is null and s.height_ft               is not null) or
            (p.height_inch             is null and s.height_inch             is not null) or
            (p.weight_kg               is null and s.weight_kg               is not null) or
            (p.systolic_bp             is null and s.systolic_bp             is not null) or
            (p.diastolic_bp            is null and s.diastolic_bp            is not null) or
            (p.chief_complaint         is null and s.chief_complaint         is not null) or
            (p.present_illness_history is null and s.present_illness_history is not null) or
            (p.past_medical_history    is null and s.past_medical_history    is not null) or
            (p.past_surgical_history   is null and s.past_surgical_history   is not null) or
            (p.allergies_text          is null and s.allergies_text          is not null) or
            (p.medications_current     is null and s.medications_current     is not null) or
            (p.family_hx               is null and s.family_hx               is not null) or
            (p.smoking_hx              is null and s.smoking_hx              is not null) or
            (p.alcohol_hx              is null and s.alcohol_hx              is not null) or
            (p.last_updated            is null and s.last_updated            is not null)
       )
    returning 1
  ),
  ins as (
    insert into public.patients (
      patient_id, full_name, sex, birthday, contact, address, email,
      height_ft, height_inch, weight_kg, systolic_bp, diastolic_bp,
      chief_complaint, present_illness_history, past_medical_history,
      past_surgical_history, allergies_text, medications_current,
      family_hx, smoking_hx, alcohol_hx, last_updated
    )
    select
      s.patient_id, s.full_name, s.sex, s.birthday, s.contact, s.address, s.email,
      s.height_ft, s.height_inch, s.weight_kg, s.systolic_bp, s.diastolic_bp,
      s.chief_complaint, s.present_illness_history, s.past_medical_history,
      s.past_surgical_history, s.allergies_text, s.medications_current,
      s.family_hx, s.smoking_hx, s.alcohol_hx, s.last_updated
    from src_ok s
    where not exists (select 1 from public.patients p where p.patient_id = s.patient_id)
    returning 1
  )
  select (select count(*) from ins), (select count(*) from upd)
    into v_ins, v_upd;

  /* Delete processed import rows WITHOUT referencing CTEs */
  delete from public.patients_import pi
  where coalesce(upper(btrim(pi.patient_id)),'') <> '';

  return query select v_ins, v_upd;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_ranges_import()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  with cleaned as (
    select
      lower(btrim(analyte_key))                       as analyte_key,
      clean_blank(label)                              as label,
      clean_blank(section)                            as section,
      clean_blank(unit)                               as unit,
      clean_blank(type)                               as type,
      num_or_null(decimals)                           as decimals,
      case
        when clean_blank(sex) is null then ''
        when lower(clean_blank(sex)) in ('any','all','*','both') then ''
        when upper(clean_blank(sex)) like 'M%' then 'M'
        when upper(clean_blank(sex)) like 'F%' then 'F'
        else ''  -- unknown -> treat as both sexes
      end                                             as sex,
      coalesce(num_or_null(age_min), -1)              as age_min,
      coalesce(num_or_null(age_max), 999)             as age_max,
      num_or_null(low)                                as low,
      num_or_null(high)                               as high,
      clean_blank(normal_values)                      as normal_values,
      clean_blank(scaling_order)                      as scaling_order
    from ranges_import
    where btrim(coalesce(analyte_key,'')) <> ''
  ),
  -- keep only ONE row per composite key, preferring rows with more filled fields
  dedup as (
    select distinct on (analyte_key, sex, age_min, age_max)
      analyte_key, label, section, unit, type,
      coalesce(decimals, 0)                           as decimals,
      sex, age_min, age_max, low, high, normal_values, scaling_order
    from cleaned
    order by
      analyte_key, sex, age_min, age_max,
      (label is null),
      (section is null),
      (unit is null),
      (type is null),
      (decimals is null),
      (low is null),
      (high is null),
      (normal_values is null),
      (scaling_order is null)
  )
  merge into ranges r
  using dedup i
  on (r.analyte_key=i.analyte_key and r.sex=i.sex and r.age_min=i.age_min and r.age_max=i.age_max)

  when not matched then
    insert (analyte_key, label, section, unit, type, decimals, sex, age_min, age_max, low, high, normal_values, scaling_order)
    values (i.analyte_key, i.label, i.section, i.unit, i.type, i.decimals, i.sex, i.age_min, i.age_max, i.low, i.high, i.normal_values, i.scaling_order)

  when matched then update set
    label         = coalesce(i.label,         r.label),
    section       = coalesce(i.section,       r.section),
    unit          = coalesce(i.unit,          r.unit),
    type          = coalesce(i.type,          r.type),
    decimals      = coalesce(i.decimals,      r.decimals),
    low           = coalesce(i.low,           r.low),
    high          = coalesce(i.high,          r.high),
    normal_values = coalesce(i.normal_values, r.normal_values),
    scaling_order = coalesce(i.scaling_order, r.scaling_order);

  -- only truncate if everything above succeeded
  truncate table ranges_import;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_results_wide_import()
 RETURNS void
 LANGUAGE plpgsql
AS $function$begin
  merge into results_wide t
  using (
    select
      upper(btrim(patient_id)) as patient_id,
      btrim(coalesce(date_of_test,'')) as date_of_test,
      btrim(coalesce(barcode,'')) as barcode,
      -- NEW: pull from import
      encounter_id,                                                    -- NEW
      full_name, age, sex, birthday, contact, address, notes,
      hema_100, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct,
      hema_mcv, hema_mch, hema_mchc, hema_plt, hema_bt, hema_remarks,
      chem_ogbase, chem_og1st, chem_og2nd, chem_fbs, chem_rbs, chem_chole, chem_trigly,
      chem_hdl, chem_ldl, chem_vldl, chem_bun, chem_crea, chem_bua, chem_ast, chem_alt,
      chem_hba1c, chem_tsh, chem_ft3, chem_ft4, chem_t3, chem_t4, chem_psa, chem_remarks,
      ua_color, ua_trans, ua_glu, ua_pro, ua_ph, ua_sg, ua_blood, ua_bilirubin, ua_urobili,
      ua_ketones, ua_nitrites, ua_le, ua_cast, ua_casttype, ua_crystals, ua_crystalstype,
      ua_epi, ua_muc, ua_ura, ua_pho, ua_bac, ua_pus, ua_rbc, ua_remarks,
      fa_color, fa_cons, fa_pus, fa_rbc, fa_bac, fa_yeast, fa_fat, fa_para, fa_paratype, fa_fobt, fa_remarks,
      sero_dengns1, sero_dengm, sero_dengg, sero_hepab, sero_rpv, sero_hiv, sero_hcv, sero_pt, sero_remarks,
      branch
    from results_wide_import
    where btrim(coalesce(patient_id,'')) <> ''
      and btrim(coalesce(date_of_test,'')) <> ''
      and btrim(coalesce(barcode,'')) <> ''
  ) s
  on (t.patient_id = s.patient_id and t.date_of_test = s.date_of_test and t.barcode = s.barcode)

  when not matched then
    insert (patient_id, date_of_test, barcode,
            encounter_id,                                                   -- NEW (target list)
            full_name, age, sex, birthday, contact, address, notes,
            hema_100, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct,
            hema_mcv, hema_mch, hema_mchc, hema_plt, hema_bt, hema_remarks,
            chem_ogbase, chem_og1st, chem_og2nd, chem_fbs, chem_rbs, chem_chole, chem_trigly,
            chem_hdl, chem_ldl, chem_vldl, chem_bun, chem_crea, chem_bua, chem_ast, chem_alt,
            chem_hba1c, chem_tsh, chem_ft3, chem_ft4, chem_t3, chem_t4, chem_psa, chem_remarks,
            ua_color, ua_trans, ua_glu, ua_pro, ua_ph, ua_sg, ua_blood, ua_bilirubin, ua_urobili,
            ua_ketones, ua_nitrites, ua_le, ua_cast, ua_casttype, ua_crystals, ua_crystalstype,
            ua_epi, ua_muc, ua_ura, ua_pho, ua_bac, ua_pus, ua_rbc, ua_remarks,
            fa_color, fa_cons, fa_pus, fa_rbc, fa_bac, fa_yeast, fa_fat, fa_para, fa_paratype, fa_fobt, fa_remarks,
            sero_dengns1, sero_dengm, sero_dengg, sero_hepab, sero_rpv, sero_hiv, sero_hcv, sero_pt, sero_remarks,
            branch)
    values (s.patient_id, s.date_of_test, s.barcode,
            s.encounter_id,                                                -- NEW (values)
            s.full_name, s.age, s.sex, s.birthday, s.contact, s.address, s.notes,
            s.hema_100, s.hema_wbc, s.hema_lymph, s.hema_mid, s.hema_gran, s.hema_rbc, s.hema_hgb, s.hema_hct,
            s.hema_mcv, s.hema_mch, s.hema_mchc, s.hema_plt, s.hema_bt, s.hema_remarks,
            s.chem_ogbase, s.chem_og1st, s.chem_og2nd, s.chem_fbs, s.chem_rbs, s.chem_chole, s.chem_trigly,
            s.chem_hdl, s.chem_ldl, s.chem_vldl, s.chem_bun, s.chem_crea, s.chem_bua, s.chem_ast, s.chem_alt,
            s.chem_hba1c, s.chem_tsh, s.chem_ft3, s.chem_ft4, s.chem_t3, s.chem_t4, s.chem_psa, s.chem_remarks,
            s.ua_color, s.ua_trans, s.ua_glu, s.ua_pro, s.ua_ph, s.ua_sg, s.ua_blood, s.ua_bilirubin, s.ua_urobili,
            s.ua_ketones, s.ua_nitrites, s.ua_le, s.ua_cast, s.ua_casttype, s.ua_crystals, s.ua_crystalstype,
            s.ua_epi, s.ua_muc, s.ua_ura, s.ua_pho, s.ua_bac, s.ua_pus, s.ua_rbc, s.ua_remarks,
            s.fa_color, s.fa_cons, s.fa_pus, s.fa_rbc, s.fa_bac, s.fa_yeast, s.fa_fat, s.fa_para, s.fa_paratype, s.fa_fobt, s.fa_remarks,
            s.sero_dengns1, s.sero_dengm, s.sero_dengg, s.sero_hepab, s.sero_rpv, s.sero_hiv, s.sero_hcv, s.sero_pt, s.sero_remarks,
            s.branch)

  when matched then
    update set
      encounter_id = coalesce(s.encounter_id, t.encounter_id),              -- NEW: keep existing if s.encounter_id null
      full_name=s.full_name, age=s.age, sex=s.sex, birthday=s.birthday, contact=s.contact, address=s.address, notes=s.notes,
      hema_100=s.hema_100, hema_wbc=s.hema_wbc, hema_lymph=s.hema_lymph, hema_mid=s.hema_mid, hema_gran=s.hema_gran, hema_rbc=s.hema_rbc, hema_hgb=s.hema_hgb, hema_hct=s.hema_hct,
      hema_mcv=s.hema_mcv, hema_mch=s.hema_mch, hema_mchc=s.hema_mchc, hema_plt=s.hema_plt, hema_bt=s.hema_bt, hema_remarks=s.hema_remarks,
      chem_ogbase=s.chem_ogbase, chem_og1st=s.chem_og1st, chem_og2nd=s.chem_og2nd, chem_fbs=s.chem_fbs, chem_rbs=s.chem_rbs, chem_chole=s.chem_chole, chem_trigly=s.chem_trigly,
      chem_hdl=s.chem_hdl, chem_ldl=s.chem_ldl, chem_vldl=s.chem_vldl, chem_bun=s.chem_bun, chem_crea=s.chem_crea, chem_bua=s.chem_bua, chem_ast=s.chem_ast, chem_alt=s.chem_alt,
      chem_hba1c=s.chem_hba1c, chem_tsh=s.chem_tsh, chem_ft3=s.chem_ft3, chem_ft4=s.chem_ft4, chem_t3=s.chem_t3, chem_t4=s.chem_t4, chem_psa=s.chem_psa, chem_remarks=s.chem_remarks,
      ua_color=s.ua_color, ua_trans=s.ua_trans, ua_glu=s.ua_glu, ua_pro=s.ua_pro, ua_ph=s.ua_ph, ua_sg=s.ua_sg, ua_blood=s.ua_blood, ua_bilirubin=s.ua_bilirubin, ua_urobili=s.ua_urobili,
      ua_ketones=s.ua_ketones, ua_nitrites=s.ua_nitrites, ua_le=s.ua_le, ua_cast=s.ua_cast, ua_casttype=s.ua_casttype, ua_crystals=s.ua_crystals, ua_crystalstype=s.ua_crystalstype,
      ua_epi=s.ua_epi, ua_muc=s.ua_muc, ua_ura=s.ua_ura, ua_pho=s.ua_pho, ua_bac=s.ua_bac, ua_pus=s.ua_pus, ua_rbc=s.ua_rbc, ua_remarks=s.ua_remarks,
      fa_color=s.fa_color, fa_cons=s.fa_cons, fa_pus=s.fa_pus, fa_rbc=s.fa_rbc, fa_bac=s.fa_bac, fa_yeast=s.fa_yeast, fa_fat=s.fa_fat, fa_para=s.fa_para, fa_paratype=s.fa_paratype, fa_fobt=s.fa_fobt, fa_remarks=s.fa_remarks,
      sero_dengns1=s.sero_dengns1, sero_dengm=s.sero_dengm, sero_dengg=s.sero_dengg, sero_hepab=s.sero_hepab, sero_rpv=s.sero_rpv, sero_hiv=s.sero_hiv, sero_hcv=s.sero_hcv, sero_pt=s.sero_pt, sero_remarks=s.sero_remarks,
      branch=s.branch;

  -- Clear staging so repeated uploads are always fresh
  truncate table results_wide_import;
end;$function$
;

CREATE OR REPLACE FUNCTION public.normalize_results_flat()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.patient_id   := upper(btrim(new.patient_id));
  new.barcode      := btrim(coalesce(new.barcode,''));
  new.date_of_test := btrim(coalesce(new.date_of_test,''));
  new.analyte_key  := lower(btrim(new.analyte_key)); -- keys are snake_case
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.normalize_results_wide()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.patient_id   := upper(btrim(new.patient_id));
  new.barcode      := btrim(coalesce(new.barcode,''));
  new.date_of_test := btrim(coalesce(new.date_of_test,''));
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.num_or_null(t text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare s text;
begin
  s := clean_blank(t);
  if s is null then return null; end if;
  if s ~ '^\s*-?\d+(\.\d+)?\s*$' then
    return s::numeric;
  end if;
  return null;
end; $function$
;

CREATE OR REPLACE FUNCTION public.patients_uppercase_pid()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.patient_id := upper(btrim(new.patient_id));
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.recompute_patient_ages()
 RETURNS void
 LANGUAGE sql
AS $function$
  update public.patients
  set age = floor(extract(year from age(current_date, birthday)))
  where birthday is not null
    -- only touch rows that actually need a change:
    and age is distinct from floor(extract(year from age(current_date, birthday)));
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_results_flat_from_wide(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(inserted integer, updated integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_ins int := 0;
  v_upd int := 0;
begin
  -- be gentle about locks
  perform set_config('lock_timeout','2s', true);

  with
  -- Only the analyte keys we care about
  rkeys as (
    select distinct analyte_key from ranges
  ),

  -- Narrow results_wide to recently changed rows; optionally cap volume
  wide as (
    select *
    from results_wide w
    where p_since is null or w.updated_at >= p_since
    order by w.updated_at
    limit coalesce(p_limit, 2147483647)
  ),

  -- Explode wide → tall using keys present in JSONB
  src as (
    select
      upper(btrim(w.patient_id))                   as patient_id,
      btrim(coalesce(w.date_of_test,''))           as date_of_test,
      btrim(coalesce(w.barcode,''))                as barcode,
      r.analyte_key,
      nullif(trim(to_jsonb(w)->>r.analyte_key),'') as value,
      w.notes,
      w.branch,
      w.encounter_id                               as encounter_id
    from wide w
    join rkeys r on (to_jsonb(w) ? r.analyte_key)
  ),

  -- Basic validations
  src_ok as (
    select *
    from src
    where value is not null
      and patient_id <> ''
      and date_of_test <> ''
  ),

  -- Deduplicate within this batch
  src_uniq as (
    select
      patient_id, date_of_test, barcode, analyte_key,
      max(value)        as value,
      max(notes)        as notes,
      max(branch)       as branch,
      max(encounter_id) as encounter_id
    from src_ok
    group by 1,2,3,4
  ),

  -- Only perform updates that actually change something
  upd as (
    update results_flat f
       set value        = s.value,
           notes        = s.notes,
           branch       = s.branch,
           encounter_id = coalesce(s.encounter_id, f.encounter_id),
           updated_at   = now()
           -- NOTE: we intentionally do NOT touch performed_by_staff_id here,
           -- so the original performer remains the same even if values/notes change.
      from src_uniq s
     where f.patient_id   = s.patient_id
       and f.date_of_test = s.date_of_test
       and f.barcode      = s.barcode
       and f.analyte_key  = s.analyte_key
       and (
            f.value        is distinct from s.value
         or f.notes        is distinct from s.notes
         or f.branch       is distinct from s.branch
         or (s.encounter_id is not null and f.encounter_id is distinct from s.encounter_id)
       )
    returning 1
  ),

  -- Insert only genuinely new rows (anti-join is faster than NOT EXISTS on big tables)
  ins as (
    insert into results_flat (
      patient_id,
      date_of_test,
      barcode,
      analyte_key,
      value,
      notes,
      branch,
      encounter_id,
      performed_by_staff_id       -- NEW: tag performer at insert time
    )
    select
      s.patient_id,
      s.date_of_test,
      s.barcode,
      s.analyte_key,
      s.value,
      s.notes,
      s.branch,
      s.encounter_id,
      -- NEW: resolve RMT based on hub/branch, analyte, and date_of_test (Option B)
      public.get_section_rmt_for_test(
        s.branch,                 -- assumes branch matches hubs.code
        s.analyte_key,
        s.date_of_test::date      -- date_of_test is text; cast to date
      ) as performed_by_staff_id
    from src_uniq s
    left join results_flat f
      on  f.patient_id   = s.patient_id
      and f.date_of_test = s.date_of_test
      and f.barcode      = s.barcode
      and f.analyte_key  = s.analyte_key
    where f.patient_id is null
    returning 1
  )

  select (select count(*) from ins), (select count(*) from upd)
  into v_ins, v_upd;

  return query select v_ins, v_upd;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_age_from_birthday()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.birthday IS NULL THEN
    NEW.age := NULL;
  ELSE
    NEW.age := FLOOR(EXTRACT(year FROM age(current_date, NEW.birthday)));
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_last_updated_ph()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.last_updated := timezone('Asia/Manila', now());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_note_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.supplies_dispense(p_branch_code text, p_item_id uuid, p_qty_pcs integer, p_staff_id uuid DEFAULT NULL::uuid, p_patient_id uuid DEFAULT NULL::uuid, p_encounter_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(inventory_id uuid, remaining_pcs integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_inventory_id uuid;
  v_remaining integer;
begin
  if p_qty_pcs is null or p_qty_pcs <= 0 then
    raise exception 'qty must be > 0';
  end if;

  -- Lock the inventory row for this branch+item
  select si.id, si.remaining_pcs
    into v_inventory_id, v_remaining
  from public.supplies_inventory si
  where si.branch_code = p_branch_code
    and si.item_id = p_item_id
  for update;

  if v_inventory_id is null then
    raise exception 'No inventory row for branch % and item %', p_branch_code, p_item_id;
  end if;

  if v_remaining < p_qty_pcs then
    raise exception 'Insufficient stock. Remaining %, requested %', v_remaining, p_qty_pcs;
  end if;

  update public.supplies_inventory
    set remaining_pcs = remaining_pcs - p_qty_pcs,
        last_dispensed_at = now(),
        updated_by_staff_id = p_staff_id
  where id = v_inventory_id;

  insert into public.supplies_dispenses (
    inventory_id,
    qty_pcs,
    dispensed_by_staff_id,
    patient_id,
    encounter_id,
    reference,
    notes
  ) values (
    v_inventory_id,
    p_qty_pcs,
    p_staff_id,
    p_patient_id,
    p_encounter_id,
    p_reference,
    p_notes
  );

  select si.remaining_pcs into v_remaining
  from public.supplies_inventory si
  where si.id = v_inventory_id;

  inventory_id := v_inventory_id;
  remaining_pcs := v_remaining;
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.supplies_dispense_fefo(p_branch_code text, p_item_id uuid, p_qty_pcs integer, p_staff_id uuid DEFAULT NULL::uuid, p_patient_id uuid DEFAULT NULL::uuid, p_encounter_id uuid DEFAULT NULL::uuid, p_reference text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(dispensed_total integer, remaining_after_available integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_need int := p_qty_pcs;
  v_batch record;
  v_take int;
  v_remaining_available int;
begin
  if p_qty_pcs is null or p_qty_pcs <= 0 then
    raise exception 'qty must be > 0';
  end if;

  -- Total AVAILABLE across non-expired batches
  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_available
  from public.supplies_batches
  where branch_code = p_branch_code
    and item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  if v_remaining_available < v_need then
    raise exception 'Insufficient AVAILABLE stock. Remaining %, requested %', v_remaining_available, v_need;
  end if;

  -- Consume earliest AVAILABLE expiry first (FEFO)
  for v_batch in
    select id, remaining_pcs, expiry_date
    from public.supplies_batches
    where branch_code = p_branch_code
      and item_id = p_item_id
      and remaining_pcs > 0
      and expiry_date >= current_date
    order by expiry_date asc, created_at asc
    for update
  loop
    exit when v_need <= 0;

    v_take := least(v_need, v_batch.remaining_pcs);

    update public.supplies_batches
      set remaining_pcs = remaining_pcs - v_take,
          updated_by_staff_id = p_staff_id
    where id = v_batch.id;

    insert into public.supplies_dispenses (
      batch_id,
      qty_pcs,
      dispensed_by_staff_id,
      patient_id,
      encounter_id,
      reference,
      notes
    ) values (
      v_batch.id,
      v_take,
      p_staff_id,
      p_patient_id,
      p_encounter_id,
      p_reference,
      p_notes
    );

    v_need := v_need - v_take;
  end loop;

  -- Remaining AVAILABLE after dispense
  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_available
  from public.supplies_batches
  where branch_code = p_branch_code
    and item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  dispensed_total := p_qty_pcs;
  remaining_after_available := v_remaining_available;
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.supplies_receive(p_branch_code text, p_item_id uuid, p_added_pcs integer, p_expiry_date date, p_staff_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(batch_id uuid, remaining_pcs integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_id uuid;
  v_remaining int;
begin
  if p_added_pcs is null or p_added_pcs <= 0 then
    raise exception 'added pcs must be > 0';
  end if;
  if p_expiry_date is null then
    raise exception 'expiry_date is required';
  end if;

  -- Try to lock existing batch for same expiry
  select sb.id, sb.remaining_pcs
    into v_id, v_remaining
  from public.supplies_batches sb
  where sb.branch_code = p_branch_code
    and sb.item_id = p_item_id
    and sb.expiry_date = p_expiry_date
  for update;

  if v_id is null then
    insert into public.supplies_batches as sb (
      branch_code, item_id, expiry_date,
      total_pcs, remaining_pcs,
      created_by_staff_id, updated_by_staff_id
    ) values (
      p_branch_code, p_item_id, p_expiry_date,
      p_added_pcs, p_added_pcs,
      p_staff_id, p_staff_id
    )
    returning sb.id, sb.remaining_pcs into v_id, v_remaining;
  else
    update public.supplies_batches sb
      set total_pcs = sb.total_pcs + p_added_pcs,
          remaining_pcs = sb.remaining_pcs + p_added_pcs,
          updated_by_staff_id = p_staff_id
    where sb.id = v_id;

    select sb.remaining_pcs
      into v_remaining
    from public.supplies_batches sb
    where sb.id = v_id;
  end if;

  batch_id := v_id;
  remaining_pcs := v_remaining;
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_patient_flat_vitals(p_patient_id text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v record;
  new_height_ft integer;
  new_height_inch integer;
  height_cm_val numeric(5,2);
begin
  select *
    into v
  from public.vitals_latest_per_patient
  where patient_id = p_patient_id;

  if not found then
    update public.patients
       set height_ft   = null,
           height_inch = null,
           weight_kg   = null,
           systolic_bp = null,
           diastolic_bp= null,
           last_updated = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS')
     where patient_id = p_patient_id;
    return;
  end if;

  height_cm_val := v.height_cm;
  if height_cm_val is not null then
    new_height_ft := floor(height_cm_val / 30.48);
    new_height_inch := round((height_cm_val - (new_height_ft * 30.48)) / 2.54);
  else
    new_height_ft := null;
    new_height_inch := null;
  end if;

  update public.patients p
     set height_ft   = case when height_cm_val is not null then new_height_ft::text else null end,
         height_inch = case when height_cm_val is not null then new_height_inch::text else null end,
         weight_kg   = case when v.weight_kg is not null then v.weight_kg::text else null end,
         systolic_bp = case when v.systolic_bp is not null then v.systolic_bp::text else null end,
         diastolic_bp= case when v.diastolic_bp is not null then v.diastolic_bp::text else null end,
         last_updated = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS')
   where p.patient_id = p_patient_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_psm_auto_enable_from_patient_vitals()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  has_bp boolean;
  has_weight boolean;
  has_glucose boolean;
begin
  if new.source <> 'patient' then
    return new;
  end if;

  has_bp := (new.systolic_bp is not null) or (new.diastolic_bp is not null);
  has_weight := (new.weight_kg is not null);
  has_glucose := (new.blood_glucose_mgdl is not null);

  if has_bp then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'bp', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      -- do not overwrite doctor_requested if already true
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      -- keep the strongest context we have
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  if has_weight then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'weight', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  if has_glucose then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'glucose', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_vitals_autofill_and_bmi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  last_height numeric(5,2);
  height_m numeric;
begin
  -- If height missing, try carry-forward latest height for this patient.
  if new.height_cm is null and new.patient_id is not null then
    select vs.height_cm
      into last_height
    from public.vitals_snapshots vs
    where vs.patient_id = new.patient_id
      and vs.height_cm is not null
      and (tg_op = 'INSERT' or vs.id <> new.id)
    order by vs.measured_at desc
    limit 1;

    if last_height is not null then
      new.height_cm := last_height;
    end if;
  end if;

  -- Auto-calc BMI if weight + height available.
  if new.weight_kg is not null and new.height_cm is not null then
    height_m := (new.height_cm / 100.0);
    if height_m > 0 then
      new.bmi := round((new.weight_kg / (height_m * height_m))::numeric, 2);
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_vitals_snapshots_sync_patients()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.sync_patient_flat_vitals(coalesce(new.patient_id, old.patient_id));
  return null;
end;
$function$
;

create or replace view "public"."v_latest_consent_per_encounter" as  SELECT DISTINCT ON (encounter_id) encounter_id,
    consultation_id,
    id AS consent_id,
    created_at,
    consent_hash
   FROM public.patient_consents
  ORDER BY encounter_id, created_at DESC;


create or replace view "public"."v_supplies_inventory_summary" as  SELECT branch_code,
    item_id,
    (sum(total_pcs))::integer AS total_pcs_all,
    (sum(remaining_pcs))::integer AS remaining_pcs_all,
    (sum(total_pcs) FILTER (WHERE (expiry_date >= CURRENT_DATE)))::integer AS total_pcs_available,
    (sum(remaining_pcs) FILTER (WHERE (expiry_date >= CURRENT_DATE)))::integer AS remaining_pcs_available,
    min(expiry_date) FILTER (WHERE ((expiry_date >= CURRENT_DATE) AND (remaining_pcs > 0))) AS nearest_expiry_date,
    count(*) FILTER (WHERE ((expiry_date >= CURRENT_DATE) AND (remaining_pcs > 0))) AS active_batches_count
   FROM public.supplies_batches b
  GROUP BY branch_code, item_id;


create or replace view "public"."v_supplies_next_expiries" as  SELECT branch_code,
    item_id,
    expiry_date,
    (sum(remaining_pcs))::integer AS remaining_pcs
   FROM public.supplies_batches b
  WHERE (expiry_date >= CURRENT_DATE)
  GROUP BY branch_code, item_id, expiry_date
  ORDER BY branch_code, item_id, expiry_date;


create or replace view "public"."vitals_by_encounter" as  SELECT v.id,
    v.consultation_id,
    v.encounter_id,
    v.patient_id,
    v.measured_at,
    v.systolic_bp,
    v.diastolic_bp,
    v.hr,
    v.rr,
    v.temp_c,
    v.height_cm,
    v.weight_kg,
    v.bmi,
    v.o2sat,
    v.notes,
    v.source,
    v.created_by,
    v.created_at,
    v.created_by_initials,
    c.visit_at,
    c.branch,
    e.branch_code,
    e.visit_date_local
   FROM ((public.vitals_snapshots v
     LEFT JOIN public.consultations c ON ((c.id = v.consultation_id)))
     LEFT JOIN public.encounters e ON ((e.id = v.encounter_id)));


create or replace view "public"."vitals_latest_patient_self_by_param" as  SELECT psm.patient_id,
    psm.parameter_key,
    psm.enabled,
    psm.doctor_requested,
    psm.frequency,
    psm.instructions,
    psm.consultation_id AS prescribed_consultation_id,
    psm.encounter_id AS prescribed_encounter_id,
    psm.doctor_id,
    psm.updated_at AS monitoring_updated_at,
    v.id AS latest_vital_id,
    v.measured_at AS latest_measured_at,
    v.encounter_id AS latest_encounter_id,
    v.systolic_bp,
    v.diastolic_bp,
    v.weight_kg,
    v.blood_glucose_mgdl
   FROM (public.patient_self_monitoring psm
     LEFT JOIN LATERAL ( SELECT vs.id,
            vs.consultation_id,
            vs.encounter_id,
            vs.patient_id,
            vs.measured_at,
            vs.systolic_bp,
            vs.diastolic_bp,
            vs.hr,
            vs.rr,
            vs.temp_c,
            vs.height_cm,
            vs.weight_kg,
            vs.bmi,
            vs.o2sat,
            vs.notes,
            vs.source,
            vs.created_by,
            vs.created_at,
            vs.created_by_initials,
            vs.blood_glucose_mgdl
           FROM public.vitals_snapshots vs
          WHERE ((vs.patient_id = psm.patient_id) AND (vs.source = 'patient'::text) AND (((psm.parameter_key = 'bp'::text) AND ((vs.systolic_bp IS NOT NULL) OR (vs.diastolic_bp IS NOT NULL))) OR ((psm.parameter_key = 'weight'::text) AND (vs.weight_kg IS NOT NULL)) OR ((psm.parameter_key = 'glucose'::text) AND (vs.blood_glucose_mgdl IS NOT NULL))))
          ORDER BY vs.measured_at DESC
         LIMIT 1) v ON (true));


create or replace view "public"."vitals_latest_per_patient" as  SELECT DISTINCT ON (patient_id) id AS snapshot_id,
    patient_id,
    consultation_id,
    encounter_id,
    measured_at,
    systolic_bp,
    diastolic_bp,
    hr,
    rr,
    temp_c,
    height_cm,
    weight_kg,
    bmi,
    o2sat,
    notes,
    source,
    created_by_initials,
    created_at
   FROM public.vitals_snapshots
  ORDER BY patient_id, measured_at DESC;


grant delete on table "public"."config" to "anon";

grant insert on table "public"."config" to "anon";

grant references on table "public"."config" to "anon";

grant select on table "public"."config" to "anon";

grant trigger on table "public"."config" to "anon";

grant truncate on table "public"."config" to "anon";

grant update on table "public"."config" to "anon";

grant delete on table "public"."config" to "authenticated";

grant insert on table "public"."config" to "authenticated";

grant references on table "public"."config" to "authenticated";

grant select on table "public"."config" to "authenticated";

grant trigger on table "public"."config" to "authenticated";

grant truncate on table "public"."config" to "authenticated";

grant update on table "public"."config" to "authenticated";

grant delete on table "public"."config" to "service_role";

grant insert on table "public"."config" to "service_role";

grant references on table "public"."config" to "service_role";

grant select on table "public"."config" to "service_role";

grant trigger on table "public"."config" to "service_role";

grant truncate on table "public"."config" to "service_role";

grant update on table "public"."config" to "service_role";

grant delete on table "public"."config_import" to "anon";

grant insert on table "public"."config_import" to "anon";

grant references on table "public"."config_import" to "anon";

grant select on table "public"."config_import" to "anon";

grant trigger on table "public"."config_import" to "anon";

grant truncate on table "public"."config_import" to "anon";

grant update on table "public"."config_import" to "anon";

grant delete on table "public"."config_import" to "authenticated";

grant insert on table "public"."config_import" to "authenticated";

grant references on table "public"."config_import" to "authenticated";

grant select on table "public"."config_import" to "authenticated";

grant trigger on table "public"."config_import" to "authenticated";

grant truncate on table "public"."config_import" to "authenticated";

grant update on table "public"."config_import" to "authenticated";

grant delete on table "public"."config_import" to "service_role";

grant insert on table "public"."config_import" to "service_role";

grant references on table "public"."config_import" to "service_role";

grant select on table "public"."config_import" to "service_role";

grant trigger on table "public"."config_import" to "service_role";

grant truncate on table "public"."config_import" to "service_role";

grant update on table "public"."config_import" to "service_role";

grant delete on table "public"."consent_templates" to "anon";

grant insert on table "public"."consent_templates" to "anon";

grant references on table "public"."consent_templates" to "anon";

grant select on table "public"."consent_templates" to "anon";

grant trigger on table "public"."consent_templates" to "anon";

grant truncate on table "public"."consent_templates" to "anon";

grant update on table "public"."consent_templates" to "anon";

grant delete on table "public"."consent_templates" to "authenticated";

grant insert on table "public"."consent_templates" to "authenticated";

grant references on table "public"."consent_templates" to "authenticated";

grant select on table "public"."consent_templates" to "authenticated";

grant trigger on table "public"."consent_templates" to "authenticated";

grant truncate on table "public"."consent_templates" to "authenticated";

grant update on table "public"."consent_templates" to "authenticated";

grant delete on table "public"."consent_templates" to "service_role";

grant insert on table "public"."consent_templates" to "service_role";

grant references on table "public"."consent_templates" to "service_role";

grant select on table "public"."consent_templates" to "service_role";

grant trigger on table "public"."consent_templates" to "service_role";

grant truncate on table "public"."consent_templates" to "service_role";

grant update on table "public"."consent_templates" to "service_role";

grant delete on table "public"."consultation_diagnoses" to "anon";

grant insert on table "public"."consultation_diagnoses" to "anon";

grant references on table "public"."consultation_diagnoses" to "anon";

grant select on table "public"."consultation_diagnoses" to "anon";

grant trigger on table "public"."consultation_diagnoses" to "anon";

grant truncate on table "public"."consultation_diagnoses" to "anon";

grant update on table "public"."consultation_diagnoses" to "anon";

grant delete on table "public"."consultation_diagnoses" to "authenticated";

grant insert on table "public"."consultation_diagnoses" to "authenticated";

grant references on table "public"."consultation_diagnoses" to "authenticated";

grant select on table "public"."consultation_diagnoses" to "authenticated";

grant trigger on table "public"."consultation_diagnoses" to "authenticated";

grant truncate on table "public"."consultation_diagnoses" to "authenticated";

grant update on table "public"."consultation_diagnoses" to "authenticated";

grant delete on table "public"."consultation_diagnoses" to "service_role";

grant insert on table "public"."consultation_diagnoses" to "service_role";

grant references on table "public"."consultation_diagnoses" to "service_role";

grant select on table "public"."consultation_diagnoses" to "service_role";

grant trigger on table "public"."consultation_diagnoses" to "service_role";

grant truncate on table "public"."consultation_diagnoses" to "service_role";

grant update on table "public"."consultation_diagnoses" to "service_role";

grant delete on table "public"."consultations" to "anon";

grant insert on table "public"."consultations" to "anon";

grant references on table "public"."consultations" to "anon";

grant select on table "public"."consultations" to "anon";

grant trigger on table "public"."consultations" to "anon";

grant truncate on table "public"."consultations" to "anon";

grant update on table "public"."consultations" to "anon";

grant delete on table "public"."consultations" to "authenticated";

grant insert on table "public"."consultations" to "authenticated";

grant references on table "public"."consultations" to "authenticated";

grant select on table "public"."consultations" to "authenticated";

grant trigger on table "public"."consultations" to "authenticated";

grant truncate on table "public"."consultations" to "authenticated";

grant update on table "public"."consultations" to "authenticated";

grant delete on table "public"."consultations" to "service_role";

grant insert on table "public"."consultations" to "service_role";

grant references on table "public"."consultations" to "service_role";

grant select on table "public"."consultations" to "service_role";

grant trigger on table "public"."consultations" to "service_role";

grant truncate on table "public"."consultations" to "service_role";

grant update on table "public"."consultations" to "service_role";

grant delete on table "public"."doctor_notes" to "anon";

grant insert on table "public"."doctor_notes" to "anon";

grant references on table "public"."doctor_notes" to "anon";

grant select on table "public"."doctor_notes" to "anon";

grant trigger on table "public"."doctor_notes" to "anon";

grant truncate on table "public"."doctor_notes" to "anon";

grant update on table "public"."doctor_notes" to "anon";

grant delete on table "public"."doctor_notes" to "authenticated";

grant insert on table "public"."doctor_notes" to "authenticated";

grant references on table "public"."doctor_notes" to "authenticated";

grant select on table "public"."doctor_notes" to "authenticated";

grant trigger on table "public"."doctor_notes" to "authenticated";

grant truncate on table "public"."doctor_notes" to "authenticated";

grant update on table "public"."doctor_notes" to "authenticated";

grant delete on table "public"."doctor_notes" to "service_role";

grant insert on table "public"."doctor_notes" to "service_role";

grant references on table "public"."doctor_notes" to "service_role";

grant select on table "public"."doctor_notes" to "service_role";

grant trigger on table "public"."doctor_notes" to "service_role";

grant truncate on table "public"."doctor_notes" to "service_role";

grant update on table "public"."doctor_notes" to "service_role";

grant delete on table "public"."doctors" to "anon";

grant insert on table "public"."doctors" to "anon";

grant references on table "public"."doctors" to "anon";

grant select on table "public"."doctors" to "anon";

grant trigger on table "public"."doctors" to "anon";

grant truncate on table "public"."doctors" to "anon";

grant update on table "public"."doctors" to "anon";

grant delete on table "public"."doctors" to "authenticated";

grant insert on table "public"."doctors" to "authenticated";

grant references on table "public"."doctors" to "authenticated";

grant select on table "public"."doctors" to "authenticated";

grant trigger on table "public"."doctors" to "authenticated";

grant truncate on table "public"."doctors" to "authenticated";

grant update on table "public"."doctors" to "authenticated";

grant delete on table "public"."doctors" to "service_role";

grant insert on table "public"."doctors" to "service_role";

grant references on table "public"."doctors" to "service_role";

grant select on table "public"."doctors" to "service_role";

grant trigger on table "public"."doctors" to "service_role";

grant truncate on table "public"."doctors" to "service_role";

grant update on table "public"."doctors" to "service_role";

grant delete on table "public"."ecg_cases" to "anon";

grant insert on table "public"."ecg_cases" to "anon";

grant references on table "public"."ecg_cases" to "anon";

grant select on table "public"."ecg_cases" to "anon";

grant trigger on table "public"."ecg_cases" to "anon";

grant truncate on table "public"."ecg_cases" to "anon";

grant update on table "public"."ecg_cases" to "anon";

grant delete on table "public"."ecg_cases" to "authenticated";

grant insert on table "public"."ecg_cases" to "authenticated";

grant references on table "public"."ecg_cases" to "authenticated";

grant select on table "public"."ecg_cases" to "authenticated";

grant trigger on table "public"."ecg_cases" to "authenticated";

grant truncate on table "public"."ecg_cases" to "authenticated";

grant update on table "public"."ecg_cases" to "authenticated";

grant delete on table "public"."ecg_cases" to "service_role";

grant insert on table "public"."ecg_cases" to "service_role";

grant references on table "public"."ecg_cases" to "service_role";

grant select on table "public"."ecg_cases" to "service_role";

grant trigger on table "public"."ecg_cases" to "service_role";

grant truncate on table "public"."ecg_cases" to "service_role";

grant update on table "public"."ecg_cases" to "service_role";

grant delete on table "public"."ecg_reports" to "anon";

grant insert on table "public"."ecg_reports" to "anon";

grant references on table "public"."ecg_reports" to "anon";

grant select on table "public"."ecg_reports" to "anon";

grant trigger on table "public"."ecg_reports" to "anon";

grant truncate on table "public"."ecg_reports" to "anon";

grant update on table "public"."ecg_reports" to "anon";

grant delete on table "public"."ecg_reports" to "authenticated";

grant insert on table "public"."ecg_reports" to "authenticated";

grant references on table "public"."ecg_reports" to "authenticated";

grant select on table "public"."ecg_reports" to "authenticated";

grant trigger on table "public"."ecg_reports" to "authenticated";

grant truncate on table "public"."ecg_reports" to "authenticated";

grant update on table "public"."ecg_reports" to "authenticated";

grant delete on table "public"."ecg_reports" to "service_role";

grant insert on table "public"."ecg_reports" to "service_role";

grant references on table "public"."ecg_reports" to "service_role";

grant select on table "public"."ecg_reports" to "service_role";

grant trigger on table "public"."ecg_reports" to "service_role";

grant truncate on table "public"."ecg_reports" to "service_role";

grant update on table "public"."ecg_reports" to "service_role";

grant delete on table "public"."encounter_events" to "anon";

grant insert on table "public"."encounter_events" to "anon";

grant references on table "public"."encounter_events" to "anon";

grant select on table "public"."encounter_events" to "anon";

grant trigger on table "public"."encounter_events" to "anon";

grant truncate on table "public"."encounter_events" to "anon";

grant update on table "public"."encounter_events" to "anon";

grant delete on table "public"."encounter_events" to "authenticated";

grant insert on table "public"."encounter_events" to "authenticated";

grant references on table "public"."encounter_events" to "authenticated";

grant select on table "public"."encounter_events" to "authenticated";

grant trigger on table "public"."encounter_events" to "authenticated";

grant truncate on table "public"."encounter_events" to "authenticated";

grant update on table "public"."encounter_events" to "authenticated";

grant delete on table "public"."encounter_events" to "service_role";

grant insert on table "public"."encounter_events" to "service_role";

grant references on table "public"."encounter_events" to "service_role";

grant select on table "public"."encounter_events" to "service_role";

grant trigger on table "public"."encounter_events" to "service_role";

grant truncate on table "public"."encounter_events" to "service_role";

grant update on table "public"."encounter_events" to "service_role";

grant delete on table "public"."encounter_orders" to "anon";

grant insert on table "public"."encounter_orders" to "anon";

grant references on table "public"."encounter_orders" to "anon";

grant select on table "public"."encounter_orders" to "anon";

grant trigger on table "public"."encounter_orders" to "anon";

grant truncate on table "public"."encounter_orders" to "anon";

grant update on table "public"."encounter_orders" to "anon";

grant delete on table "public"."encounter_orders" to "authenticated";

grant insert on table "public"."encounter_orders" to "authenticated";

grant references on table "public"."encounter_orders" to "authenticated";

grant select on table "public"."encounter_orders" to "authenticated";

grant trigger on table "public"."encounter_orders" to "authenticated";

grant truncate on table "public"."encounter_orders" to "authenticated";

grant update on table "public"."encounter_orders" to "authenticated";

grant delete on table "public"."encounter_orders" to "service_role";

grant insert on table "public"."encounter_orders" to "service_role";

grant references on table "public"."encounter_orders" to "service_role";

grant select on table "public"."encounter_orders" to "service_role";

grant trigger on table "public"."encounter_orders" to "service_role";

grant truncate on table "public"."encounter_orders" to "service_role";

grant update on table "public"."encounter_orders" to "service_role";

grant delete on table "public"."encounters" to "anon";

grant insert on table "public"."encounters" to "anon";

grant references on table "public"."encounters" to "anon";

grant select on table "public"."encounters" to "anon";

grant trigger on table "public"."encounters" to "anon";

grant truncate on table "public"."encounters" to "anon";

grant update on table "public"."encounters" to "anon";

grant delete on table "public"."encounters" to "authenticated";

grant insert on table "public"."encounters" to "authenticated";

grant references on table "public"."encounters" to "authenticated";

grant select on table "public"."encounters" to "authenticated";

grant trigger on table "public"."encounters" to "authenticated";

grant truncate on table "public"."encounters" to "authenticated";

grant update on table "public"."encounters" to "authenticated";

grant delete on table "public"."encounters" to "service_role";

grant insert on table "public"."encounters" to "service_role";

grant references on table "public"."encounters" to "service_role";

grant select on table "public"."encounters" to "service_role";

grant trigger on table "public"."encounters" to "service_role";

grant truncate on table "public"."encounters" to "service_role";

grant update on table "public"."encounters" to "service_role";

grant delete on table "public"."external_results" to "anon";

grant insert on table "public"."external_results" to "anon";

grant references on table "public"."external_results" to "anon";

grant select on table "public"."external_results" to "anon";

grant trigger on table "public"."external_results" to "anon";

grant truncate on table "public"."external_results" to "anon";

grant update on table "public"."external_results" to "anon";

grant delete on table "public"."external_results" to "authenticated";

grant insert on table "public"."external_results" to "authenticated";

grant references on table "public"."external_results" to "authenticated";

grant select on table "public"."external_results" to "authenticated";

grant trigger on table "public"."external_results" to "authenticated";

grant truncate on table "public"."external_results" to "authenticated";

grant update on table "public"."external_results" to "authenticated";

grant delete on table "public"."external_results" to "service_role";

grant insert on table "public"."external_results" to "service_role";

grant references on table "public"."external_results" to "service_role";

grant select on table "public"."external_results" to "service_role";

grant trigger on table "public"."external_results" to "service_role";

grant truncate on table "public"."external_results" to "service_role";

grant update on table "public"."external_results" to "service_role";

grant delete on table "public"."followup_attempts" to "anon";

grant insert on table "public"."followup_attempts" to "anon";

grant references on table "public"."followup_attempts" to "anon";

grant select on table "public"."followup_attempts" to "anon";

grant trigger on table "public"."followup_attempts" to "anon";

grant truncate on table "public"."followup_attempts" to "anon";

grant update on table "public"."followup_attempts" to "anon";

grant delete on table "public"."followup_attempts" to "authenticated";

grant insert on table "public"."followup_attempts" to "authenticated";

grant references on table "public"."followup_attempts" to "authenticated";

grant select on table "public"."followup_attempts" to "authenticated";

grant trigger on table "public"."followup_attempts" to "authenticated";

grant truncate on table "public"."followup_attempts" to "authenticated";

grant update on table "public"."followup_attempts" to "authenticated";

grant delete on table "public"."followup_attempts" to "service_role";

grant insert on table "public"."followup_attempts" to "service_role";

grant references on table "public"."followup_attempts" to "service_role";

grant select on table "public"."followup_attempts" to "service_role";

grant trigger on table "public"."followup_attempts" to "service_role";

grant truncate on table "public"."followup_attempts" to "service_role";

grant update on table "public"."followup_attempts" to "service_role";

grant delete on table "public"."followups" to "anon";

grant insert on table "public"."followups" to "anon";

grant references on table "public"."followups" to "anon";

grant select on table "public"."followups" to "anon";

grant trigger on table "public"."followups" to "anon";

grant truncate on table "public"."followups" to "anon";

grant update on table "public"."followups" to "anon";

grant delete on table "public"."followups" to "authenticated";

grant insert on table "public"."followups" to "authenticated";

grant references on table "public"."followups" to "authenticated";

grant select on table "public"."followups" to "authenticated";

grant trigger on table "public"."followups" to "authenticated";

grant truncate on table "public"."followups" to "authenticated";

grant update on table "public"."followups" to "authenticated";

grant delete on table "public"."followups" to "service_role";

grant insert on table "public"."followups" to "service_role";

grant references on table "public"."followups" to "service_role";

grant select on table "public"."followups" to "service_role";

grant trigger on table "public"."followups" to "service_role";

grant truncate on table "public"."followups" to "service_role";

grant update on table "public"."followups" to "service_role";

grant delete on table "public"."hubs" to "anon";

grant insert on table "public"."hubs" to "anon";

grant references on table "public"."hubs" to "anon";

grant select on table "public"."hubs" to "anon";

grant trigger on table "public"."hubs" to "anon";

grant truncate on table "public"."hubs" to "anon";

grant update on table "public"."hubs" to "anon";

grant delete on table "public"."hubs" to "authenticated";

grant insert on table "public"."hubs" to "authenticated";

grant references on table "public"."hubs" to "authenticated";

grant select on table "public"."hubs" to "authenticated";

grant trigger on table "public"."hubs" to "authenticated";

grant truncate on table "public"."hubs" to "authenticated";

grant update on table "public"."hubs" to "authenticated";

grant delete on table "public"."hubs" to "service_role";

grant insert on table "public"."hubs" to "service_role";

grant references on table "public"."hubs" to "service_role";

grant select on table "public"."hubs" to "service_role";

grant trigger on table "public"."hubs" to "service_role";

grant truncate on table "public"."hubs" to "service_role";

grant update on table "public"."hubs" to "service_role";

grant delete on table "public"."icd10" to "anon";

grant insert on table "public"."icd10" to "anon";

grant references on table "public"."icd10" to "anon";

grant select on table "public"."icd10" to "anon";

grant trigger on table "public"."icd10" to "anon";

grant truncate on table "public"."icd10" to "anon";

grant update on table "public"."icd10" to "anon";

grant delete on table "public"."icd10" to "authenticated";

grant insert on table "public"."icd10" to "authenticated";

grant references on table "public"."icd10" to "authenticated";

grant select on table "public"."icd10" to "authenticated";

grant trigger on table "public"."icd10" to "authenticated";

grant truncate on table "public"."icd10" to "authenticated";

grant update on table "public"."icd10" to "authenticated";

grant delete on table "public"."icd10" to "service_role";

grant insert on table "public"."icd10" to "service_role";

grant references on table "public"."icd10" to "service_role";

grant select on table "public"."icd10" to "service_role";

grant trigger on table "public"."icd10" to "service_role";

grant truncate on table "public"."icd10" to "service_role";

grant update on table "public"."icd10" to "service_role";

grant delete on table "public"."icd10_catalog" to "anon";

grant insert on table "public"."icd10_catalog" to "anon";

grant references on table "public"."icd10_catalog" to "anon";

grant select on table "public"."icd10_catalog" to "anon";

grant trigger on table "public"."icd10_catalog" to "anon";

grant truncate on table "public"."icd10_catalog" to "anon";

grant update on table "public"."icd10_catalog" to "anon";

grant delete on table "public"."icd10_catalog" to "authenticated";

grant insert on table "public"."icd10_catalog" to "authenticated";

grant references on table "public"."icd10_catalog" to "authenticated";

grant select on table "public"."icd10_catalog" to "authenticated";

grant trigger on table "public"."icd10_catalog" to "authenticated";

grant truncate on table "public"."icd10_catalog" to "authenticated";

grant update on table "public"."icd10_catalog" to "authenticated";

grant delete on table "public"."icd10_catalog" to "service_role";

grant insert on table "public"."icd10_catalog" to "service_role";

grant references on table "public"."icd10_catalog" to "service_role";

grant select on table "public"."icd10_catalog" to "service_role";

grant trigger on table "public"."icd10_catalog" to "service_role";

grant truncate on table "public"."icd10_catalog" to "service_role";

grant update on table "public"."icd10_catalog" to "service_role";

grant delete on table "public"."medical_certificate_supporting_items" to "anon";

grant insert on table "public"."medical_certificate_supporting_items" to "anon";

grant references on table "public"."medical_certificate_supporting_items" to "anon";

grant select on table "public"."medical_certificate_supporting_items" to "anon";

grant trigger on table "public"."medical_certificate_supporting_items" to "anon";

grant truncate on table "public"."medical_certificate_supporting_items" to "anon";

grant update on table "public"."medical_certificate_supporting_items" to "anon";

grant delete on table "public"."medical_certificate_supporting_items" to "authenticated";

grant insert on table "public"."medical_certificate_supporting_items" to "authenticated";

grant references on table "public"."medical_certificate_supporting_items" to "authenticated";

grant select on table "public"."medical_certificate_supporting_items" to "authenticated";

grant trigger on table "public"."medical_certificate_supporting_items" to "authenticated";

grant truncate on table "public"."medical_certificate_supporting_items" to "authenticated";

grant update on table "public"."medical_certificate_supporting_items" to "authenticated";

grant delete on table "public"."medical_certificate_supporting_items" to "service_role";

grant insert on table "public"."medical_certificate_supporting_items" to "service_role";

grant references on table "public"."medical_certificate_supporting_items" to "service_role";

grant select on table "public"."medical_certificate_supporting_items" to "service_role";

grant trigger on table "public"."medical_certificate_supporting_items" to "service_role";

grant truncate on table "public"."medical_certificate_supporting_items" to "service_role";

grant update on table "public"."medical_certificate_supporting_items" to "service_role";

grant delete on table "public"."medical_certificates" to "anon";

grant insert on table "public"."medical_certificates" to "anon";

grant references on table "public"."medical_certificates" to "anon";

grant select on table "public"."medical_certificates" to "anon";

grant trigger on table "public"."medical_certificates" to "anon";

grant truncate on table "public"."medical_certificates" to "anon";

grant update on table "public"."medical_certificates" to "anon";

grant delete on table "public"."medical_certificates" to "authenticated";

grant insert on table "public"."medical_certificates" to "authenticated";

grant references on table "public"."medical_certificates" to "authenticated";

grant select on table "public"."medical_certificates" to "authenticated";

grant trigger on table "public"."medical_certificates" to "authenticated";

grant truncate on table "public"."medical_certificates" to "authenticated";

grant update on table "public"."medical_certificates" to "authenticated";

grant delete on table "public"."medical_certificates" to "service_role";

grant insert on table "public"."medical_certificates" to "service_role";

grant references on table "public"."medical_certificates" to "service_role";

grant select on table "public"."medical_certificates" to "service_role";

grant trigger on table "public"."medical_certificates" to "service_role";

grant truncate on table "public"."medical_certificates" to "service_role";

grant update on table "public"."medical_certificates" to "service_role";

grant delete on table "public"."meds" to "anon";

grant insert on table "public"."meds" to "anon";

grant references on table "public"."meds" to "anon";

grant select on table "public"."meds" to "anon";

grant trigger on table "public"."meds" to "anon";

grant truncate on table "public"."meds" to "anon";

grant update on table "public"."meds" to "anon";

grant delete on table "public"."meds" to "authenticated";

grant insert on table "public"."meds" to "authenticated";

grant references on table "public"."meds" to "authenticated";

grant select on table "public"."meds" to "authenticated";

grant trigger on table "public"."meds" to "authenticated";

grant truncate on table "public"."meds" to "authenticated";

grant update on table "public"."meds" to "authenticated";

grant delete on table "public"."meds" to "service_role";

grant insert on table "public"."meds" to "service_role";

grant references on table "public"."meds" to "service_role";

grant select on table "public"."meds" to "service_role";

grant trigger on table "public"."meds" to "service_role";

grant truncate on table "public"."meds" to "service_role";

grant update on table "public"."meds" to "service_role";

grant delete on table "public"."note_templates" to "anon";

grant insert on table "public"."note_templates" to "anon";

grant references on table "public"."note_templates" to "anon";

grant select on table "public"."note_templates" to "anon";

grant trigger on table "public"."note_templates" to "anon";

grant truncate on table "public"."note_templates" to "anon";

grant update on table "public"."note_templates" to "anon";

grant delete on table "public"."note_templates" to "authenticated";

grant insert on table "public"."note_templates" to "authenticated";

grant references on table "public"."note_templates" to "authenticated";

grant select on table "public"."note_templates" to "authenticated";

grant trigger on table "public"."note_templates" to "authenticated";

grant truncate on table "public"."note_templates" to "authenticated";

grant update on table "public"."note_templates" to "authenticated";

grant delete on table "public"."note_templates" to "service_role";

grant insert on table "public"."note_templates" to "service_role";

grant references on table "public"."note_templates" to "service_role";

grant select on table "public"."note_templates" to "service_role";

grant trigger on table "public"."note_templates" to "service_role";

grant truncate on table "public"."note_templates" to "service_role";

grant update on table "public"."note_templates" to "service_role";

grant delete on table "public"."order_items" to "anon";

grant insert on table "public"."order_items" to "anon";

grant references on table "public"."order_items" to "anon";

grant select on table "public"."order_items" to "anon";

grant trigger on table "public"."order_items" to "anon";

grant truncate on table "public"."order_items" to "anon";

grant update on table "public"."order_items" to "anon";

grant delete on table "public"."order_items" to "authenticated";

grant insert on table "public"."order_items" to "authenticated";

grant references on table "public"."order_items" to "authenticated";

grant select on table "public"."order_items" to "authenticated";

grant trigger on table "public"."order_items" to "authenticated";

grant truncate on table "public"."order_items" to "authenticated";

grant update on table "public"."order_items" to "authenticated";

grant delete on table "public"."order_items" to "service_role";

grant insert on table "public"."order_items" to "service_role";

grant references on table "public"."order_items" to "service_role";

grant select on table "public"."order_items" to "service_role";

grant trigger on table "public"."order_items" to "service_role";

grant truncate on table "public"."order_items" to "service_role";

grant update on table "public"."order_items" to "service_role";

grant delete on table "public"."package_items" to "anon";

grant insert on table "public"."package_items" to "anon";

grant references on table "public"."package_items" to "anon";

grant select on table "public"."package_items" to "anon";

grant trigger on table "public"."package_items" to "anon";

grant truncate on table "public"."package_items" to "anon";

grant update on table "public"."package_items" to "anon";

grant delete on table "public"."package_items" to "authenticated";

grant insert on table "public"."package_items" to "authenticated";

grant references on table "public"."package_items" to "authenticated";

grant select on table "public"."package_items" to "authenticated";

grant trigger on table "public"."package_items" to "authenticated";

grant truncate on table "public"."package_items" to "authenticated";

grant update on table "public"."package_items" to "authenticated";

grant delete on table "public"."package_items" to "service_role";

grant insert on table "public"."package_items" to "service_role";

grant references on table "public"."package_items" to "service_role";

grant select on table "public"."package_items" to "service_role";

grant trigger on table "public"."package_items" to "service_role";

grant truncate on table "public"."package_items" to "service_role";

grant update on table "public"."package_items" to "service_role";

grant delete on table "public"."packages" to "anon";

grant insert on table "public"."packages" to "anon";

grant references on table "public"."packages" to "anon";

grant select on table "public"."packages" to "anon";

grant trigger on table "public"."packages" to "anon";

grant truncate on table "public"."packages" to "anon";

grant update on table "public"."packages" to "anon";

grant delete on table "public"."packages" to "authenticated";

grant insert on table "public"."packages" to "authenticated";

grant references on table "public"."packages" to "authenticated";

grant select on table "public"."packages" to "authenticated";

grant trigger on table "public"."packages" to "authenticated";

grant truncate on table "public"."packages" to "authenticated";

grant update on table "public"."packages" to "authenticated";

grant delete on table "public"."packages" to "service_role";

grant insert on table "public"."packages" to "service_role";

grant references on table "public"."packages" to "service_role";

grant select on table "public"."packages" to "service_role";

grant trigger on table "public"."packages" to "service_role";

grant truncate on table "public"."packages" to "service_role";

grant update on table "public"."packages" to "service_role";

grant delete on table "public"."patient_consents" to "anon";

grant insert on table "public"."patient_consents" to "anon";

grant references on table "public"."patient_consents" to "anon";

grant select on table "public"."patient_consents" to "anon";

grant trigger on table "public"."patient_consents" to "anon";

grant truncate on table "public"."patient_consents" to "anon";

grant update on table "public"."patient_consents" to "anon";

grant delete on table "public"."patient_consents" to "authenticated";

grant insert on table "public"."patient_consents" to "authenticated";

grant references on table "public"."patient_consents" to "authenticated";

grant select on table "public"."patient_consents" to "authenticated";

grant trigger on table "public"."patient_consents" to "authenticated";

grant truncate on table "public"."patient_consents" to "authenticated";

grant update on table "public"."patient_consents" to "authenticated";

grant delete on table "public"."patient_consents" to "service_role";

grant insert on table "public"."patient_consents" to "service_role";

grant references on table "public"."patient_consents" to "service_role";

grant select on table "public"."patient_consents" to "service_role";

grant trigger on table "public"."patient_consents" to "service_role";

grant truncate on table "public"."patient_consents" to "service_role";

grant update on table "public"."patient_consents" to "service_role";

grant delete on table "public"."patient_pin_reset_tokens" to "anon";

grant insert on table "public"."patient_pin_reset_tokens" to "anon";

grant references on table "public"."patient_pin_reset_tokens" to "anon";

grant select on table "public"."patient_pin_reset_tokens" to "anon";

grant trigger on table "public"."patient_pin_reset_tokens" to "anon";

grant truncate on table "public"."patient_pin_reset_tokens" to "anon";

grant update on table "public"."patient_pin_reset_tokens" to "anon";

grant delete on table "public"."patient_pin_reset_tokens" to "authenticated";

grant insert on table "public"."patient_pin_reset_tokens" to "authenticated";

grant references on table "public"."patient_pin_reset_tokens" to "authenticated";

grant select on table "public"."patient_pin_reset_tokens" to "authenticated";

grant trigger on table "public"."patient_pin_reset_tokens" to "authenticated";

grant truncate on table "public"."patient_pin_reset_tokens" to "authenticated";

grant update on table "public"."patient_pin_reset_tokens" to "authenticated";

grant delete on table "public"."patient_pin_reset_tokens" to "service_role";

grant insert on table "public"."patient_pin_reset_tokens" to "service_role";

grant references on table "public"."patient_pin_reset_tokens" to "service_role";

grant select on table "public"."patient_pin_reset_tokens" to "service_role";

grant trigger on table "public"."patient_pin_reset_tokens" to "service_role";

grant truncate on table "public"."patient_pin_reset_tokens" to "service_role";

grant update on table "public"."patient_pin_reset_tokens" to "service_role";

grant delete on table "public"."patient_self_monitoring" to "anon";

grant insert on table "public"."patient_self_monitoring" to "anon";

grant references on table "public"."patient_self_monitoring" to "anon";

grant select on table "public"."patient_self_monitoring" to "anon";

grant trigger on table "public"."patient_self_monitoring" to "anon";

grant truncate on table "public"."patient_self_monitoring" to "anon";

grant update on table "public"."patient_self_monitoring" to "anon";

grant delete on table "public"."patient_self_monitoring" to "authenticated";

grant insert on table "public"."patient_self_monitoring" to "authenticated";

grant references on table "public"."patient_self_monitoring" to "authenticated";

grant select on table "public"."patient_self_monitoring" to "authenticated";

grant trigger on table "public"."patient_self_monitoring" to "authenticated";

grant truncate on table "public"."patient_self_monitoring" to "authenticated";

grant update on table "public"."patient_self_monitoring" to "authenticated";

grant delete on table "public"."patient_self_monitoring" to "service_role";

grant insert on table "public"."patient_self_monitoring" to "service_role";

grant references on table "public"."patient_self_monitoring" to "service_role";

grant select on table "public"."patient_self_monitoring" to "service_role";

grant trigger on table "public"."patient_self_monitoring" to "service_role";

grant truncate on table "public"."patient_self_monitoring" to "service_role";

grant update on table "public"."patient_self_monitoring" to "service_role";

grant delete on table "public"."patients" to "anon";

grant insert on table "public"."patients" to "anon";

grant references on table "public"."patients" to "anon";

grant select on table "public"."patients" to "anon";

grant trigger on table "public"."patients" to "anon";

grant truncate on table "public"."patients" to "anon";

grant update on table "public"."patients" to "anon";

grant delete on table "public"."patients" to "authenticated";

grant insert on table "public"."patients" to "authenticated";

grant references on table "public"."patients" to "authenticated";

grant select on table "public"."patients" to "authenticated";

grant trigger on table "public"."patients" to "authenticated";

grant truncate on table "public"."patients" to "authenticated";

grant update on table "public"."patients" to "authenticated";

grant delete on table "public"."patients" to "service_role";

grant insert on table "public"."patients" to "service_role";

grant references on table "public"."patients" to "service_role";

grant select on table "public"."patients" to "service_role";

grant trigger on table "public"."patients" to "service_role";

grant truncate on table "public"."patients" to "service_role";

grant update on table "public"."patients" to "service_role";

grant delete on table "public"."patients_import" to "anon";

grant insert on table "public"."patients_import" to "anon";

grant references on table "public"."patients_import" to "anon";

grant select on table "public"."patients_import" to "anon";

grant trigger on table "public"."patients_import" to "anon";

grant truncate on table "public"."patients_import" to "anon";

grant update on table "public"."patients_import" to "anon";

grant delete on table "public"."patients_import" to "authenticated";

grant insert on table "public"."patients_import" to "authenticated";

grant references on table "public"."patients_import" to "authenticated";

grant select on table "public"."patients_import" to "authenticated";

grant trigger on table "public"."patients_import" to "authenticated";

grant truncate on table "public"."patients_import" to "authenticated";

grant update on table "public"."patients_import" to "authenticated";

grant delete on table "public"."patients_import" to "service_role";

grant insert on table "public"."patients_import" to "service_role";

grant references on table "public"."patients_import" to "service_role";

grant select on table "public"."patients_import" to "service_role";

grant trigger on table "public"."patients_import" to "service_role";

grant truncate on table "public"."patients_import" to "service_role";

grant update on table "public"."patients_import" to "service_role";

grant delete on table "public"."prescription_items" to "anon";

grant insert on table "public"."prescription_items" to "anon";

grant references on table "public"."prescription_items" to "anon";

grant select on table "public"."prescription_items" to "anon";

grant trigger on table "public"."prescription_items" to "anon";

grant truncate on table "public"."prescription_items" to "anon";

grant update on table "public"."prescription_items" to "anon";

grant delete on table "public"."prescription_items" to "authenticated";

grant insert on table "public"."prescription_items" to "authenticated";

grant references on table "public"."prescription_items" to "authenticated";

grant select on table "public"."prescription_items" to "authenticated";

grant trigger on table "public"."prescription_items" to "authenticated";

grant truncate on table "public"."prescription_items" to "authenticated";

grant update on table "public"."prescription_items" to "authenticated";

grant delete on table "public"."prescription_items" to "service_role";

grant insert on table "public"."prescription_items" to "service_role";

grant references on table "public"."prescription_items" to "service_role";

grant select on table "public"."prescription_items" to "service_role";

grant trigger on table "public"."prescription_items" to "service_role";

grant truncate on table "public"."prescription_items" to "service_role";

grant update on table "public"."prescription_items" to "service_role";

grant delete on table "public"."prescriptions" to "anon";

grant insert on table "public"."prescriptions" to "anon";

grant references on table "public"."prescriptions" to "anon";

grant select on table "public"."prescriptions" to "anon";

grant trigger on table "public"."prescriptions" to "anon";

grant truncate on table "public"."prescriptions" to "anon";

grant update on table "public"."prescriptions" to "anon";

grant delete on table "public"."prescriptions" to "authenticated";

grant insert on table "public"."prescriptions" to "authenticated";

grant references on table "public"."prescriptions" to "authenticated";

grant select on table "public"."prescriptions" to "authenticated";

grant trigger on table "public"."prescriptions" to "authenticated";

grant truncate on table "public"."prescriptions" to "authenticated";

grant update on table "public"."prescriptions" to "authenticated";

grant delete on table "public"."prescriptions" to "service_role";

grant insert on table "public"."prescriptions" to "service_role";

grant references on table "public"."prescriptions" to "service_role";

grant select on table "public"."prescriptions" to "service_role";

grant trigger on table "public"."prescriptions" to "service_role";

grant truncate on table "public"."prescriptions" to "service_role";

grant update on table "public"."prescriptions" to "service_role";

grant delete on table "public"."ranges" to "anon";

grant insert on table "public"."ranges" to "anon";

grant references on table "public"."ranges" to "anon";

grant select on table "public"."ranges" to "anon";

grant trigger on table "public"."ranges" to "anon";

grant truncate on table "public"."ranges" to "anon";

grant update on table "public"."ranges" to "anon";

grant delete on table "public"."ranges" to "authenticated";

grant insert on table "public"."ranges" to "authenticated";

grant references on table "public"."ranges" to "authenticated";

grant select on table "public"."ranges" to "authenticated";

grant trigger on table "public"."ranges" to "authenticated";

grant truncate on table "public"."ranges" to "authenticated";

grant update on table "public"."ranges" to "authenticated";

grant delete on table "public"."ranges" to "service_role";

grant insert on table "public"."ranges" to "service_role";

grant references on table "public"."ranges" to "service_role";

grant select on table "public"."ranges" to "service_role";

grant trigger on table "public"."ranges" to "service_role";

grant truncate on table "public"."ranges" to "service_role";

grant update on table "public"."ranges" to "service_role";

grant delete on table "public"."ranges_import" to "anon";

grant insert on table "public"."ranges_import" to "anon";

grant references on table "public"."ranges_import" to "anon";

grant select on table "public"."ranges_import" to "anon";

grant trigger on table "public"."ranges_import" to "anon";

grant truncate on table "public"."ranges_import" to "anon";

grant update on table "public"."ranges_import" to "anon";

grant delete on table "public"."ranges_import" to "authenticated";

grant insert on table "public"."ranges_import" to "authenticated";

grant references on table "public"."ranges_import" to "authenticated";

grant select on table "public"."ranges_import" to "authenticated";

grant trigger on table "public"."ranges_import" to "authenticated";

grant truncate on table "public"."ranges_import" to "authenticated";

grant update on table "public"."ranges_import" to "authenticated";

grant delete on table "public"."ranges_import" to "service_role";

grant insert on table "public"."ranges_import" to "service_role";

grant references on table "public"."ranges_import" to "service_role";

grant select on table "public"."ranges_import" to "service_role";

grant trigger on table "public"."ranges_import" to "service_role";

grant truncate on table "public"."ranges_import" to "service_role";

grant update on table "public"."ranges_import" to "service_role";

grant delete on table "public"."results_flat" to "anon";

grant insert on table "public"."results_flat" to "anon";

grant references on table "public"."results_flat" to "anon";

grant select on table "public"."results_flat" to "anon";

grant trigger on table "public"."results_flat" to "anon";

grant truncate on table "public"."results_flat" to "anon";

grant update on table "public"."results_flat" to "anon";

grant delete on table "public"."results_flat" to "authenticated";

grant insert on table "public"."results_flat" to "authenticated";

grant references on table "public"."results_flat" to "authenticated";

grant select on table "public"."results_flat" to "authenticated";

grant trigger on table "public"."results_flat" to "authenticated";

grant truncate on table "public"."results_flat" to "authenticated";

grant update on table "public"."results_flat" to "authenticated";

grant delete on table "public"."results_flat" to "service_role";

grant insert on table "public"."results_flat" to "service_role";

grant references on table "public"."results_flat" to "service_role";

grant select on table "public"."results_flat" to "service_role";

grant trigger on table "public"."results_flat" to "service_role";

grant truncate on table "public"."results_flat" to "service_role";

grant update on table "public"."results_flat" to "service_role";

grant delete on table "public"."results_wide" to "anon";

grant insert on table "public"."results_wide" to "anon";

grant references on table "public"."results_wide" to "anon";

grant select on table "public"."results_wide" to "anon";

grant trigger on table "public"."results_wide" to "anon";

grant truncate on table "public"."results_wide" to "anon";

grant update on table "public"."results_wide" to "anon";

grant delete on table "public"."results_wide" to "authenticated";

grant insert on table "public"."results_wide" to "authenticated";

grant references on table "public"."results_wide" to "authenticated";

grant select on table "public"."results_wide" to "authenticated";

grant trigger on table "public"."results_wide" to "authenticated";

grant truncate on table "public"."results_wide" to "authenticated";

grant update on table "public"."results_wide" to "authenticated";

grant delete on table "public"."results_wide" to "service_role";

grant insert on table "public"."results_wide" to "service_role";

grant references on table "public"."results_wide" to "service_role";

grant select on table "public"."results_wide" to "service_role";

grant trigger on table "public"."results_wide" to "service_role";

grant truncate on table "public"."results_wide" to "service_role";

grant update on table "public"."results_wide" to "service_role";

grant delete on table "public"."results_wide_import" to "anon";

grant insert on table "public"."results_wide_import" to "anon";

grant references on table "public"."results_wide_import" to "anon";

grant select on table "public"."results_wide_import" to "anon";

grant trigger on table "public"."results_wide_import" to "anon";

grant truncate on table "public"."results_wide_import" to "anon";

grant update on table "public"."results_wide_import" to "anon";

grant delete on table "public"."results_wide_import" to "authenticated";

grant insert on table "public"."results_wide_import" to "authenticated";

grant references on table "public"."results_wide_import" to "authenticated";

grant select on table "public"."results_wide_import" to "authenticated";

grant trigger on table "public"."results_wide_import" to "authenticated";

grant truncate on table "public"."results_wide_import" to "authenticated";

grant update on table "public"."results_wide_import" to "authenticated";

grant delete on table "public"."results_wide_import" to "service_role";

grant insert on table "public"."results_wide_import" to "service_role";

grant references on table "public"."results_wide_import" to "service_role";

grant select on table "public"."results_wide_import" to "service_role";

grant trigger on table "public"."results_wide_import" to "service_role";

grant truncate on table "public"."results_wide_import" to "service_role";

grant update on table "public"."results_wide_import" to "service_role";

grant delete on table "public"."section_assignments" to "anon";

grant insert on table "public"."section_assignments" to "anon";

grant references on table "public"."section_assignments" to "anon";

grant select on table "public"."section_assignments" to "anon";

grant trigger on table "public"."section_assignments" to "anon";

grant truncate on table "public"."section_assignments" to "anon";

grant update on table "public"."section_assignments" to "anon";

grant delete on table "public"."section_assignments" to "authenticated";

grant insert on table "public"."section_assignments" to "authenticated";

grant references on table "public"."section_assignments" to "authenticated";

grant select on table "public"."section_assignments" to "authenticated";

grant trigger on table "public"."section_assignments" to "authenticated";

grant truncate on table "public"."section_assignments" to "authenticated";

grant update on table "public"."section_assignments" to "authenticated";

grant delete on table "public"."section_assignments" to "service_role";

grant insert on table "public"."section_assignments" to "service_role";

grant references on table "public"."section_assignments" to "service_role";

grant select on table "public"."section_assignments" to "service_role";

grant trigger on table "public"."section_assignments" to "service_role";

grant truncate on table "public"."section_assignments" to "service_role";

grant update on table "public"."section_assignments" to "service_role";

grant delete on table "public"."staff" to "anon";

grant insert on table "public"."staff" to "anon";

grant references on table "public"."staff" to "anon";

grant select on table "public"."staff" to "anon";

grant trigger on table "public"."staff" to "anon";

grant truncate on table "public"."staff" to "anon";

grant update on table "public"."staff" to "anon";

grant delete on table "public"."staff" to "authenticated";

grant insert on table "public"."staff" to "authenticated";

grant references on table "public"."staff" to "authenticated";

grant select on table "public"."staff" to "authenticated";

grant trigger on table "public"."staff" to "authenticated";

grant truncate on table "public"."staff" to "authenticated";

grant update on table "public"."staff" to "authenticated";

grant delete on table "public"."staff" to "service_role";

grant insert on table "public"."staff" to "service_role";

grant references on table "public"."staff" to "service_role";

grant select on table "public"."staff" to "service_role";

grant trigger on table "public"."staff" to "service_role";

grant truncate on table "public"."staff" to "service_role";

grant update on table "public"."staff" to "service_role";

grant delete on table "public"."supplies_batches" to "anon";

grant insert on table "public"."supplies_batches" to "anon";

grant references on table "public"."supplies_batches" to "anon";

grant select on table "public"."supplies_batches" to "anon";

grant trigger on table "public"."supplies_batches" to "anon";

grant truncate on table "public"."supplies_batches" to "anon";

grant update on table "public"."supplies_batches" to "anon";

grant delete on table "public"."supplies_batches" to "authenticated";

grant insert on table "public"."supplies_batches" to "authenticated";

grant references on table "public"."supplies_batches" to "authenticated";

grant select on table "public"."supplies_batches" to "authenticated";

grant trigger on table "public"."supplies_batches" to "authenticated";

grant truncate on table "public"."supplies_batches" to "authenticated";

grant update on table "public"."supplies_batches" to "authenticated";

grant delete on table "public"."supplies_batches" to "service_role";

grant insert on table "public"."supplies_batches" to "service_role";

grant references on table "public"."supplies_batches" to "service_role";

grant select on table "public"."supplies_batches" to "service_role";

grant trigger on table "public"."supplies_batches" to "service_role";

grant truncate on table "public"."supplies_batches" to "service_role";

grant update on table "public"."supplies_batches" to "service_role";

grant delete on table "public"."supplies_dispenses" to "anon";

grant insert on table "public"."supplies_dispenses" to "anon";

grant references on table "public"."supplies_dispenses" to "anon";

grant select on table "public"."supplies_dispenses" to "anon";

grant trigger on table "public"."supplies_dispenses" to "anon";

grant truncate on table "public"."supplies_dispenses" to "anon";

grant update on table "public"."supplies_dispenses" to "anon";

grant delete on table "public"."supplies_dispenses" to "authenticated";

grant insert on table "public"."supplies_dispenses" to "authenticated";

grant references on table "public"."supplies_dispenses" to "authenticated";

grant select on table "public"."supplies_dispenses" to "authenticated";

grant trigger on table "public"."supplies_dispenses" to "authenticated";

grant truncate on table "public"."supplies_dispenses" to "authenticated";

grant update on table "public"."supplies_dispenses" to "authenticated";

grant delete on table "public"."supplies_dispenses" to "service_role";

grant insert on table "public"."supplies_dispenses" to "service_role";

grant references on table "public"."supplies_dispenses" to "service_role";

grant select on table "public"."supplies_dispenses" to "service_role";

grant trigger on table "public"."supplies_dispenses" to "service_role";

grant truncate on table "public"."supplies_dispenses" to "service_role";

grant update on table "public"."supplies_dispenses" to "service_role";

grant delete on table "public"."supplies_inventory" to "anon";

grant insert on table "public"."supplies_inventory" to "anon";

grant references on table "public"."supplies_inventory" to "anon";

grant select on table "public"."supplies_inventory" to "anon";

grant trigger on table "public"."supplies_inventory" to "anon";

grant truncate on table "public"."supplies_inventory" to "anon";

grant update on table "public"."supplies_inventory" to "anon";

grant delete on table "public"."supplies_inventory" to "authenticated";

grant insert on table "public"."supplies_inventory" to "authenticated";

grant references on table "public"."supplies_inventory" to "authenticated";

grant select on table "public"."supplies_inventory" to "authenticated";

grant trigger on table "public"."supplies_inventory" to "authenticated";

grant truncate on table "public"."supplies_inventory" to "authenticated";

grant update on table "public"."supplies_inventory" to "authenticated";

grant delete on table "public"."supplies_inventory" to "service_role";

grant insert on table "public"."supplies_inventory" to "service_role";

grant references on table "public"."supplies_inventory" to "service_role";

grant select on table "public"."supplies_inventory" to "service_role";

grant trigger on table "public"."supplies_inventory" to "service_role";

grant truncate on table "public"."supplies_inventory" to "service_role";

grant update on table "public"."supplies_inventory" to "service_role";

grant delete on table "public"."supplies_items" to "anon";

grant insert on table "public"."supplies_items" to "anon";

grant references on table "public"."supplies_items" to "anon";

grant select on table "public"."supplies_items" to "anon";

grant trigger on table "public"."supplies_items" to "anon";

grant truncate on table "public"."supplies_items" to "anon";

grant update on table "public"."supplies_items" to "anon";

grant delete on table "public"."supplies_items" to "authenticated";

grant insert on table "public"."supplies_items" to "authenticated";

grant references on table "public"."supplies_items" to "authenticated";

grant select on table "public"."supplies_items" to "authenticated";

grant trigger on table "public"."supplies_items" to "authenticated";

grant truncate on table "public"."supplies_items" to "authenticated";

grant update on table "public"."supplies_items" to "authenticated";

grant delete on table "public"."supplies_items" to "service_role";

grant insert on table "public"."supplies_items" to "service_role";

grant references on table "public"."supplies_items" to "service_role";

grant select on table "public"."supplies_items" to "service_role";

grant trigger on table "public"."supplies_items" to "service_role";

grant truncate on table "public"."supplies_items" to "service_role";

grant update on table "public"."supplies_items" to "service_role";

grant delete on table "public"."tests_catalog" to "anon";

grant insert on table "public"."tests_catalog" to "anon";

grant references on table "public"."tests_catalog" to "anon";

grant select on table "public"."tests_catalog" to "anon";

grant trigger on table "public"."tests_catalog" to "anon";

grant truncate on table "public"."tests_catalog" to "anon";

grant update on table "public"."tests_catalog" to "anon";

grant delete on table "public"."tests_catalog" to "authenticated";

grant insert on table "public"."tests_catalog" to "authenticated";

grant references on table "public"."tests_catalog" to "authenticated";

grant select on table "public"."tests_catalog" to "authenticated";

grant trigger on table "public"."tests_catalog" to "authenticated";

grant truncate on table "public"."tests_catalog" to "authenticated";

grant update on table "public"."tests_catalog" to "authenticated";

grant delete on table "public"."tests_catalog" to "service_role";

grant insert on table "public"."tests_catalog" to "service_role";

grant references on table "public"."tests_catalog" to "service_role";

grant select on table "public"."tests_catalog" to "service_role";

grant trigger on table "public"."tests_catalog" to "service_role";

grant truncate on table "public"."tests_catalog" to "service_role";

grant update on table "public"."tests_catalog" to "service_role";

grant delete on table "public"."user_hubs" to "anon";

grant insert on table "public"."user_hubs" to "anon";

grant references on table "public"."user_hubs" to "anon";

grant select on table "public"."user_hubs" to "anon";

grant trigger on table "public"."user_hubs" to "anon";

grant truncate on table "public"."user_hubs" to "anon";

grant update on table "public"."user_hubs" to "anon";

grant delete on table "public"."user_hubs" to "authenticated";

grant insert on table "public"."user_hubs" to "authenticated";

grant references on table "public"."user_hubs" to "authenticated";

grant select on table "public"."user_hubs" to "authenticated";

grant trigger on table "public"."user_hubs" to "authenticated";

grant truncate on table "public"."user_hubs" to "authenticated";

grant update on table "public"."user_hubs" to "authenticated";

grant delete on table "public"."user_hubs" to "service_role";

grant insert on table "public"."user_hubs" to "service_role";

grant references on table "public"."user_hubs" to "service_role";

grant select on table "public"."user_hubs" to "service_role";

grant trigger on table "public"."user_hubs" to "service_role";

grant truncate on table "public"."user_hubs" to "service_role";

grant update on table "public"."user_hubs" to "service_role";

grant delete on table "public"."vitals_snapshots" to "anon";

grant insert on table "public"."vitals_snapshots" to "anon";

grant references on table "public"."vitals_snapshots" to "anon";

grant select on table "public"."vitals_snapshots" to "anon";

grant trigger on table "public"."vitals_snapshots" to "anon";

grant truncate on table "public"."vitals_snapshots" to "anon";

grant update on table "public"."vitals_snapshots" to "anon";

grant delete on table "public"."vitals_snapshots" to "authenticated";

grant insert on table "public"."vitals_snapshots" to "authenticated";

grant references on table "public"."vitals_snapshots" to "authenticated";

grant select on table "public"."vitals_snapshots" to "authenticated";

grant trigger on table "public"."vitals_snapshots" to "authenticated";

grant truncate on table "public"."vitals_snapshots" to "authenticated";

grant update on table "public"."vitals_snapshots" to "authenticated";

grant delete on table "public"."vitals_snapshots" to "service_role";

grant insert on table "public"."vitals_snapshots" to "service_role";

grant references on table "public"."vitals_snapshots" to "service_role";

grant select on table "public"."vitals_snapshots" to "service_role";

grant trigger on table "public"."vitals_snapshots" to "service_role";

grant truncate on table "public"."vitals_snapshots" to "service_role";

grant update on table "public"."vitals_snapshots" to "service_role";

grant delete on table "public"."yakap_map_components" to "anon";

grant insert on table "public"."yakap_map_components" to "anon";

grant references on table "public"."yakap_map_components" to "anon";

grant select on table "public"."yakap_map_components" to "anon";

grant trigger on table "public"."yakap_map_components" to "anon";

grant truncate on table "public"."yakap_map_components" to "anon";

grant update on table "public"."yakap_map_components" to "anon";

grant delete on table "public"."yakap_map_components" to "authenticated";

grant insert on table "public"."yakap_map_components" to "authenticated";

grant references on table "public"."yakap_map_components" to "authenticated";

grant select on table "public"."yakap_map_components" to "authenticated";

grant trigger on table "public"."yakap_map_components" to "authenticated";

grant truncate on table "public"."yakap_map_components" to "authenticated";

grant update on table "public"."yakap_map_components" to "authenticated";

grant delete on table "public"."yakap_map_components" to "service_role";

grant insert on table "public"."yakap_map_components" to "service_role";

grant references on table "public"."yakap_map_components" to "service_role";

grant select on table "public"."yakap_map_components" to "service_role";

grant trigger on table "public"."yakap_map_components" to "service_role";

grant truncate on table "public"."yakap_map_components" to "service_role";

grant update on table "public"."yakap_map_components" to "service_role";

grant delete on table "public"."yakap_map_tests" to "anon";

grant insert on table "public"."yakap_map_tests" to "anon";

grant references on table "public"."yakap_map_tests" to "anon";

grant select on table "public"."yakap_map_tests" to "anon";

grant trigger on table "public"."yakap_map_tests" to "anon";

grant truncate on table "public"."yakap_map_tests" to "anon";

grant update on table "public"."yakap_map_tests" to "anon";

grant delete on table "public"."yakap_map_tests" to "authenticated";

grant insert on table "public"."yakap_map_tests" to "authenticated";

grant references on table "public"."yakap_map_tests" to "authenticated";

grant select on table "public"."yakap_map_tests" to "authenticated";

grant trigger on table "public"."yakap_map_tests" to "authenticated";

grant truncate on table "public"."yakap_map_tests" to "authenticated";

grant update on table "public"."yakap_map_tests" to "authenticated";

grant delete on table "public"."yakap_map_tests" to "service_role";

grant insert on table "public"."yakap_map_tests" to "service_role";

grant references on table "public"."yakap_map_tests" to "service_role";

grant select on table "public"."yakap_map_tests" to "service_role";

grant trigger on table "public"."yakap_map_tests" to "service_role";

grant truncate on table "public"."yakap_map_tests" to "service_role";

grant update on table "public"."yakap_map_tests" to "service_role";


  create policy "ecg_cases_all"
  on "public"."ecg_cases"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "ecg_doctor_insert_self"
  on "public"."ecg_reports"
  as permissive
  for insert
  to authenticated
with check (((((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = ANY (ARRAY['doctor'::text, 'admin'::text])) AND ((((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'admin'::text) OR (doctor_id = (((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'doctor_id'::text))::uuid))));



  create policy "ecg_doctor_read_all"
  on "public"."ecg_reports"
  as permissive
  for select
  to authenticated
using ((((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = ANY (ARRAY['doctor'::text, 'admin'::text])));



  create policy "ecg_patient_read_final"
  on "public"."ecg_reports"
  as permissive
  for select
  to authenticated
using (((((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'role'::text) = 'patient'::text) AND (patient_id = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'patient_id'::text)) AND (status = 'final'::text)));



  create policy "ext_insert_any"
  on "public"."external_results"
  as permissive
  for insert
  to public
with check (true);



  create policy "ext_read_staff_doctors"
  on "public"."external_results"
  as permissive
  for select
  to public
using (true);



  create policy "ext_update_any"
  on "public"."external_results"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "doctor can insert supporting items they own"
  on "public"."medical_certificate_supporting_items"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.medical_certificates c
  WHERE ((c.id = medical_certificate_supporting_items.certificate_id) AND (c.doctor_id = auth.uid())))));



  create policy "doctor can read supporting items they own"
  on "public"."medical_certificate_supporting_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.medical_certificates c
  WHERE ((c.id = medical_certificate_supporting_items.certificate_id) AND (c.doctor_id = auth.uid())))));



  create policy "doctor can update supporting items they own"
  on "public"."medical_certificate_supporting_items"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.medical_certificates c
  WHERE ((c.id = medical_certificate_supporting_items.certificate_id) AND (c.doctor_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.medical_certificates c
  WHERE ((c.id = medical_certificate_supporting_items.certificate_id) AND (c.doctor_id = auth.uid())))));



  create policy "service role full access"
  on "public"."medical_certificate_supporting_items"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "doctor can insert own certificates"
  on "public"."medical_certificates"
  as permissive
  for insert
  to public
with check ((doctor_id = auth.uid()));



  create policy "doctor can read own certificates"
  on "public"."medical_certificates"
  as permissive
  for select
  to public
using ((doctor_id = auth.uid()));



  create policy "doctor can update own certificates"
  on "public"."medical_certificates"
  as permissive
  for update
  to public
using ((doctor_id = auth.uid()))
with check ((doctor_id = auth.uid()));



  create policy "service role full access"
  on "public"."medical_certificates"
  as permissive
  for all
  to public
using (true)
with check (true);


CREATE TRIGGER trg_consultations_set_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_doctor_notes_set_updated_at BEFORE UPDATE ON public.doctor_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_doctors_set_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_ecg_reports_validate_and_fill BEFORE INSERT OR UPDATE ON public.ecg_reports FOR EACH ROW EXECUTE FUNCTION public.fn_ecg_reports_validate_and_fill();

CREATE TRIGGER trg_encounters_checkin AFTER INSERT ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.log_encounter_checkin();

CREATE TRIGGER trg_encounters_status AFTER UPDATE OF status ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.log_encounter_status_change();

CREATE TRIGGER trg_encounters_updated BEFORE UPDATE ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_meds_set_updated_at BEFORE UPDATE ON public.meds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_note_templates_updated_at BEFORE UPDATE ON public.note_templates FOR EACH ROW EXECUTE FUNCTION public.set_note_templates_updated_at();

CREATE TRIGGER trg_psm_set_updated_at BEFORE UPDATE ON public.patient_self_monitoring FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER patients_age_biub BEFORE INSERT OR UPDATE OF birthday ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_age_from_birthday();

CREATE TRIGGER trg_patients_last_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_last_updated_ph();

CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_patients_upper BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.patients_uppercase_pid();

CREATE TRIGGER trg_prescription_items_set_updated_at BEFORE UPDATE ON public.prescription_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_prescriptions_set_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rx_upper_patient BEFORE INSERT OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.enforce_upper_patient_id();

CREATE TRIGGER trg_results_flat_normalize BEFORE INSERT OR UPDATE ON public.results_flat FOR EACH ROW EXECUTE FUNCTION public.normalize_results_flat();

CREATE TRIGGER trg_results_flat_updated BEFORE UPDATE ON public.results_flat FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_results_wide_normalize BEFORE INSERT OR UPDATE ON public.results_wide FOR EACH ROW EXECUTE FUNCTION public.normalize_results_wide();

CREATE TRIGGER trg_results_wide_updated BEFORE UPDATE ON public.results_wide FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_public_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER trg_supplies_batches_updated_at BEFORE UPDATE ON public.supplies_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_supplies_inventory_updated_at BEFORE UPDATE ON public.supplies_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_supplies_items_updated_at BEFORE UPDATE ON public.supplies_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_psm_auto_enable_from_patient_vitals AFTER INSERT ON public.vitals_snapshots FOR EACH ROW EXECUTE FUNCTION public.tg_psm_auto_enable_from_patient_vitals();

CREATE TRIGGER trg_vitals_autofill_and_bmi BEFORE INSERT OR UPDATE OF weight_kg, height_cm ON public.vitals_snapshots FOR EACH ROW EXECUTE FUNCTION public.tg_vitals_autofill_and_bmi();

CREATE TRIGGER trg_vitals_snapshots_sync AFTER INSERT OR DELETE OR UPDATE ON public.vitals_snapshots FOR EACH ROW EXECUTE FUNCTION public.tg_vitals_snapshots_sync_patients();


