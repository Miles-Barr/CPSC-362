# Supabase database setup

The migrations create the clinical and staff-administration data used by the
C++ API. They do not store passwords; Supabase Auth continues to own
credentials.

For the current project, open the Supabase SQL editor and run the migrations in
filename order. Run `202610260001_patient_records.sql` first, followed by
`202611190001_staff_administration.sql`. A successful run may show **No rows
returned** because schema statements do not return table rows.

Afterward, use the Table Editor to confirm these tables exist:

- `patients` and `doctors`
- `doctor_patients`
- `appointments`
- `medications` and `prescriptions`
- `pharmacies` and `patient_pharmacies`
- `patient_health_summaries`
- `audit_logs`

The migration backfills a `patients` or `doctors` row for existing profiles and
adds a trigger for new profiles. Clinical tables intentionally do not have
browser-access policies. They are accessed through the authenticated C++ API.

The staff migration adds the application-level `profiles.active` flag used to
block deactivated accounts. Staff role changes preserve historical doctor and
patient rows. Removing a doctor role deactivates current assignments rather
than deleting medical or audit history.

For a classroom demonstration, `seed.example.sql` can connect one existing test
doctor account to one existing test patient and add fictional data. Replace both
usernames first. Do not use the example script for real patient information.

