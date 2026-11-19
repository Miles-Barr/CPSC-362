-- Staff administration support for the Fullerton Health Network prototype.
-- Run this after 202610260001_patient_records.sql.

alter table public.profiles
  add column if not exists active boolean not null default true;

create index if not exists profiles_role_active_idx
  on public.profiles (role, active);

create index if not exists doctor_patients_active_patient_idx
  on public.doctor_patients (patient_id, assigned_at desc)
  where active;

comment on column public.profiles.active is
  'Application access flag enforced by the React app and C++ API.';

