# Fullerton Health C++ API

This service is the authorization and business-logic boundary between the React
frontend and Supabase PostgreSQL. It verifies each Supabase access token, checks
the stored application role and doctor/patient assignment, uses parameterized
SQL, and records prescription changes in `audit_logs`.

## Classes

- `Config` reads deployment settings from environment variables.
- `AuthService` asks Supabase Auth to validate the browser's bearer token.
- `Database` and `DatabaseConnection` own PostgreSQL connections and results.
- `PatientService` enforces roles and assignments before reading or writing data.
- `main.cpp` maps HTTP routes to those service functions.

The service opens one encrypted PostgreSQL connection per request. That is easy
to reason about for this class project; a production version would normally use
a connection pool.

## API routes

| Method | Route | Authorized user |
| --- | --- | --- |
| `GET` | `/health` | Public health check |
| `GET` | `/api/patients/me/dashboard` | Patient, own record only |
| `GET` | `/api/doctor/patients` | Doctor, assigned patients only |
| `GET` | `/api/doctor/patients/:id/dashboard` | Assigned doctor |
| `POST` | `/api/doctor/patients/:id/prescriptions` | Assigned doctor |
| `PATCH` | `/api/doctor/patients/:id/prescriptions/:id` | Assigned doctor |

## Run with Docker

Docker downloads the C++ dependencies and builds the executable, so the host
machine does not need CMake, libpq, or libcurl development packages.

```bash
cd backend
cp .env.example .env
# Replace every placeholder in .env, then:
docker build -t fullerton-health-api .
docker run --env-file .env -p 8080:8080 fullerton-health-api
curl http://localhost:8080/health
```

Never commit `backend/.env` or paste `DATABASE_URL` into Vercel. Deploy this
Docker directory to a container host such as Render, Railway, Fly.io, or AWS,
and configure the variables in that host's secret settings. Vercel only needs
the resulting public API URL as `VITE_API_URL`.

Copy `DATABASE_URL` from Supabase's **Connect** dialog. Use a direct connection
when the container host supports IPv6; use the Session pooler on an IPv4-only
host. The code adds `sslmode=require` if the copied string does not already have
an SSL mode. A production deployment can use `verify-full` with Supabase's CA
certificate for hostname and certificate verification.

