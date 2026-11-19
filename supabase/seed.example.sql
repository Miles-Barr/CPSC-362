-- OPTIONAL TEST DATA ONLY. Do not run this with real patient information.
-- Replace the two usernames below with existing test accounts, then run once
-- in the Supabase SQL editor after the migration.

do $$
declare
  doctor_username constant text := 'REPLACE_WITH_DOCTOR_USERNAME';
  patient_username constant text := 'REPLACE_WITH_PATIENT_USERNAME';
  v_doctor_id uuid;
  v_patient_id uuid;
  v_pharmacy_id uuid;
  v_medication_id uuid;
begin
  if doctor_username like 'REPLACE_%' or patient_username like 'REPLACE_%' then
    raise exception 'Replace the test usernames before running this script';
  end if;

  -- Only an administrator should assign a trusted doctor role.
  update public.profiles set role = 'doctor' where username = doctor_username;

  select d.id into v_doctor_id
  from public.doctors d
  join public.profiles p on p.id = d.profile_id
  where p.username = doctor_username;

  select patient.id into v_patient_id
  from public.patients patient
  join public.profiles p on p.id = patient.profile_id
  where p.username = patient_username;

  if v_doctor_id is null or v_patient_id is null then
    raise exception 'The doctor or patient test profile was not found';
  end if;

  insert into public.doctor_patients (doctor_id, patient_id, active)
  values (v_doctor_id, v_patient_id, true)
  on conflict (doctor_id, patient_id) do update set active = true;

  insert into public.appointments
    (patient_id, doctor_id, starts_at, visit_type, location, status)
  select v_patient_id, v_doctor_id,
         date_trunc('day', now()) + interval '14 days 9 hours 30 minutes',
         'Primary Care', 'Fullerton Clinic - Room 204', 'scheduled'
  where not exists (
    select 1 from public.appointments
    where appointments.patient_id = v_patient_id
      and visit_type = 'Primary Care'
      and status = 'scheduled'
  );

  insert into public.appointments
    (patient_id, doctor_id, starts_at, visit_type, location, status)
  select v_patient_id, v_doctor_id,
         date_trunc('day', now()) - interval '30 days' + interval '10 hours',
         'Annual physical', 'Fullerton Clinic', 'completed'
  where not exists (
    select 1 from public.appointments
    where appointments.patient_id = v_patient_id
      and visit_type = 'Annual physical'
      and status = 'completed'
  );

  insert into public.pharmacies (name, address, phone, hours)
  values ('Fullerton Community Pharmacy',
          '123 Health Plaza, Fullerton, CA 92831',
          '(714) 555-0138', 'Monday-Friday, 8:00 AM-7:00 PM')
  on conflict (name, address) do update set phone = excluded.phone
  returning id into v_pharmacy_id;

  insert into public.patient_pharmacies
    (patient_id, pharmacy_id, is_preferred)
  values (v_patient_id, v_pharmacy_id, true)
  on conflict (patient_id, pharmacy_id)
  do update set is_preferred = true, selected_at = now();

  insert into public.patient_health_summaries
    (patient_id, allergies, blood_type, primary_doctor_id, insurance)
  values (v_patient_id, 'Penicillin', 'O+', v_doctor_id,
          'Fullerton Health Network Test Plan')
  on conflict (patient_id) do update
    set allergies = excluded.allergies,
        blood_type = excluded.blood_type,
        primary_doctor_id = excluded.primary_doctor_id,
        insurance = excluded.insurance;

  insert into public.medications (name)
  values ('Lisinopril')
  on conflict (name) do update set name = excluded.name
  returning id into v_medication_id;

  insert into public.prescriptions
    (patient_id, medication_id, prescribed_by, dosage, instructions,
     refills_remaining)
  select v_patient_id, v_medication_id, v_doctor_id, '10 mg',
         'Take one tablet by mouth each morning', 2
  where not exists (
    select 1 from public.prescriptions existing
    where existing.patient_id = v_patient_id
      and existing.medication_id = v_medication_id
      and existing.status = 'active'
  );
end;
$$;

