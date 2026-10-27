-- Patient-record schema for the Fullerton Health Network prototype.
-- Run this migration in the Supabase SQL editor or with `supabase db push`.
-- Passwords remain in Supabase Auth; this schema stores application records.

create extension if not exists pgcrypto;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  date_of_birth date,
  phone text
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  specialty text
);

create table if not exists public.doctor_patients (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (doctor_id, patient_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  starts_at timestamptz not null,
  visit_type text not null check (length(trim(visit_type)) between 1 and 120),
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 160)
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete restrict,
  prescribed_by uuid not null references public.doctors(id) on delete restrict,
  dosage text not null check (length(trim(dosage)) between 1 and 120),
  instructions text not null check (length(trim(instructions)) between 1 and 500),
  start_date date not null default current_date,
  end_date date,
  refills_remaining integer not null default 0
    check (refills_remaining between 0 and 24),
  status text not null default 'active'
    check (status in ('active', 'completed', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  hours text,
  unique (name, address)
);

create table if not exists public.patient_pharmacies (
  patient_id uuid not null references public.patients(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  is_preferred boolean not null default false,
  selected_at timestamptz not null default now(),
  primary key (patient_id, pharmacy_id)
);

create unique index if not exists one_preferred_pharmacy_per_patient
  on public.patient_pharmacies (patient_id)
  where is_preferred;

create table if not exists public.patient_health_summaries (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  allergies text,
  blood_type text,
  primary_doctor_id uuid references public.doctors(id) on delete set null,
  insurance text,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  patient_id uuid references public.patients(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists appointments_patient_starts_at_idx
  on public.appointments (patient_id, starts_at desc);
create index if not exists prescriptions_patient_status_idx
  on public.prescriptions (patient_id, status);
create index if not exists doctor_patients_patient_idx
  on public.doctor_patients (patient_id) where active;
create index if not exists audit_logs_patient_occurred_at_idx
  on public.audit_logs (patient_id, occurred_at desc);

-- Create the matching clinical identity whenever a profile is created. A role
-- change never deletes old clinical records; cleanup must be an explicit,
-- reviewed administrative operation.
create or replace function public.sync_clinical_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'patient' then
    insert into public.patients (profile_id, display_name)
    values (new.id, new.username)
    on conflict (profile_id) do update
      set display_name = excluded.display_name;
  elsif new.role = 'doctor' then
    insert into public.doctors (profile_id, display_name)
    values (new.id, new.username)
    on conflict (profile_id) do update
      set display_name = excluded.display_name;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_clinical_identity_after_profile_change
  on public.profiles;
create trigger sync_clinical_identity_after_profile_change
after insert or update of username, role on public.profiles
for each row execute function public.sync_clinical_identity();

-- Backfill users who were created before this migration.
insert into public.patients (profile_id, display_name)
select id, username from public.profiles where role = 'patient'
on conflict (profile_id) do update set display_name = excluded.display_name;

insert into public.doctors (profile_id, display_name)
select id, username from public.profiles where role = 'doctor'
on conflict (profile_id) do update set display_name = excluded.display_name;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prescriptions_touch_updated_at on public.prescriptions;
create trigger prescriptions_touch_updated_at
before update on public.prescriptions
for each row execute function public.touch_updated_at();

drop trigger if exists health_summaries_touch_updated_at
  on public.patient_health_summaries;
create trigger health_summaries_touch_updated_at
before update on public.patient_health_summaries
for each row execute function public.touch_updated_at();

-- The browser must not query clinical tables directly. The C++ server connects
-- with its private PostgreSQL credentials and performs authorization itself.
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.prescriptions enable row level security;
alter table public.pharmacies enable row level security;
alter table public.patient_pharmacies enable row level security;
alter table public.patient_health_summaries enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.patients from anon, authenticated;
revoke all on table public.doctors from anon, authenticated;
revoke all on table public.doctor_patients from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.medications from anon, authenticated;
revoke all on table public.prescriptions from anon, authenticated;
revoke all on table public.pharmacies from anon, authenticated;
revoke all on table public.patient_pharmacies from anon, authenticated;
revoke all on table public.patient_health_summaries from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

