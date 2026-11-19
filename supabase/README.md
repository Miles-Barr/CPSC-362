# Supabase database setup

The migration in `migrations/202610260001_patient_records.sql` creates the
clinical tables used by the C++ API. It does not store passwords; Supabase Auth
continues to own credentials.

For the current project, open the Supabase SQL editor, paste the migration, and
run it once. A successful run may show **No rows returned** because schema
statements do not return table rows.

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

For a classroom demonstration, `seed.example.sql` can connect one existing test
doctor account to one existing test patient and add fictional data. Replace both
usernames first. Do not use the example script for real patient information.

