# Fullerton Health Network EHR Frontend

This directory contains the React/Vite frontend for the CPSC-362 Electronic
Health Record project. Vercel builds and hosts the frontend, Supabase provides
authentication and PostgreSQL, and the containerized C++ API protects clinical
data operations.

## Current architecture

```text
GitHub -> Vercel -> React application
                      |              |
                      | sign in      | bearer token + HTTPS/JSON
                      v              v
                Supabase Auth   Containerized C++ API
                                      |
                                      | encrypted, parameterized SQL
                                      v
                              Supabase PostgreSQL
```

The browser uses Supabase directly only for authentication and its own basic
profile. Appointments, prescriptions, pharmacies, and health summaries go
through the C++ API for server-side authorization, validation, and audit logging.

## Source organization

- `src/main.jsx`: mounts the React application.
- `src/App.jsx`: coordinates sessions, login, signup, profile loading, and logout.
- `src/pages/LoginPage.jsx`: owns login/signup form state and displays the form.
- `src/pages/DashboardPage.jsx`: chooses the dashboard for the authenticated role.
- `src/pages/PatientDashboardPage.jsx`: loads and displays the patient's own record.
- `src/pages/DoctorDashboardPage.jsx`: lists assigned patients and manages prescriptions.
- `src/api/apiClient.js`: attaches the Supabase access token to C++ API requests.
- `src/supabaseClient.js`: creates the shared Supabase browser client.
- `src/index.css`: global browser and page defaults.
- `src/App.css`: login and dashboard component styles.

The project uses React function components and hooks rather than JavaScript
classes. Functions keep each responsibility small, and props connect components
without making every component depend directly on Supabase.

## Authentication flow

1. A user enters an email and password on `LoginPage`.
2. `LoginPage` calls the function supplied by `App`.
3. Supabase Auth verifies the password and returns a user ID.
4. `App` loads the matching `profiles` row.
5. The stored database role must match the selected login role.
6. React renders `DashboardPage` when a valid profile is available.
7. `DashboardPage` selects the patient or doctor interface.
8. The dashboard sends the access token to the C++ API.
9. The API verifies the token with Supabase, checks the database role and
   assignment, and only then reads or changes a clinical record.

Passwords are handled by Supabase Auth and are never stored in `profiles` or in
the React application. Self-created accounts receive the `patient` role. Doctor
and staff roles must be assigned through a trusted administrative process.

The role comparison in React controls the interface, but the C++ API enforces
actual access. Client-side checks alone are not a security boundary.

## Environment variables

Create `.env.local` for local development:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
VITE_API_URL=http://localhost:8080
```

Use the same variable names in Vercel for Preview and Production, with
`VITE_API_URL` changed to the deployed container URL. Never expose a database
password or Supabase secret key in a `VITE_` variable. `.env.local` is ignored
by Git.

## Development

This project requires Node.js 22.

```bash
npm ci
npm run dev
```

Before opening a pull request:

```bash
npm run lint
npm run build
```

See [`docs/authentication-architecture.md`](docs/authentication-architecture.md)
for architecture decisions, security boundaries, and presentation notes.

## Complete setup order

1. Run `supabase/migrations/202610260001_patient_records.sql` in Supabase.
2. Optionally prepare fictional demo rows with `supabase/seed.example.sql`.
3. Build and deploy the repository's `backend/` directory on a Docker host.
4. Add the backend variables shown in `backend/.env.example` to that host.
5. Add the deployed URL to Vercel as `VITE_API_URL`, then redeploy Vercel.
6. For local testing, run the container on port 8080 and `npm run dev` here.
