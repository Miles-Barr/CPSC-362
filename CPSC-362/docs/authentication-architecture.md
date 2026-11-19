# Authentication Architecture Notes

Use this document to explain the current design during a code review or class
presentation.

## Short architecture answer

> The frontend is a React single-page application built by Vite and hosted on
> Vercel. `App.jsx` acts as the authentication controller. It delegates form
> display and input state to `LoginPage`, and it renders `DashboardPage` after a
> successful login. Supabase Auth stores and verifies passwords. A related
> PostgreSQL `profiles` table stores the username and role. The React dashboard
> sends its Supabase access token to a containerized C++ API. That API verifies
> the token, enforces patient ownership or doctor assignment, validates writes,
> uses parameterized PostgreSQL queries, and records changes in an audit log.

## Why function components instead of classes?

React supports class components, but this project uses function components:

- `App()`
- `LoginPage()`
- `DashboardPage()`
- `PatientDashboardPage()`
- `DoctorDashboardPage()`

Function components are the modern React approach. Hooks such as `useState` and
`useEffect` provide component state and lifecycle behavior without class
constructors, `this`, or lifecycle methods.

The project still separates responsibilities even though it does not use
classes. Each component is a reusable function with a focused job.

## Where responsibilities live

| File | Responsibility | Does not do |
| --- | --- | --- |
| `main.jsx` | Starts React | Authentication or database work |
| `App.jsx` | Coordinates authentication and navigation state | Detailed form markup |
| `LoginPage.jsx` | Collects user input and shows feedback | Direct database access |
| `DashboardPage.jsx` | Selects a dashboard based on the validated role | Login or profile queries |
| `PatientDashboardPage.jsx` | Requests and displays the signed-in patient's record | Direct database access |
| `DoctorDashboardPage.jsx` | Displays assigned patients and prescription controls | Deciding authorization |
| `apiClient.js` | Adds the current access token to API requests | Database credentials |
| `supabaseClient.js` | Configures one shared Supabase client | Page rendering |

This is separation of concerns: interface code, authentication coordination,
and service configuration are not mixed into one large file.

## Important functions

### `getProfile(userId)`

Loads `username` and `role` from `profiles` for the authenticated user ID. Auth
and application data are separate: Supabase Auth owns credentials, while the
application table owns user-facing profile fields.

### `handleLogin(...)`

Asks Supabase Auth to verify the email and password, loads the corresponding
profile, and compares the selected role to the stored role. The stored role is
trusted; the clicked button is not.

### `handleSignUp(...)`

Creates the Supabase Auth account and passes the username as metadata. A database
trigger creates the related profile. New self-service accounts default to the
patient role so users cannot make themselves doctors or staff.

### `handleLogout()`

Ends the Supabase session and clears local profile state, which causes React to
render the login page again.

### `handleSubmit(event)`

Belongs to `LoginPage`. It prevents a full browser reload and calls either the
login or signup function supplied by `App`.

## How components communicate

`App` passes data and functions through React props:

```jsx
<LoginPage onLogin={handleLogin} onSignUp={handleSignUp} />
<DashboardPage profile={profile} onLogout={handleLogout} />
```

This is a form of dependency injection. The page components do not create their
own Supabase clients. They receive only the information or operations they need.

## Why there is no routing library yet

The current prototype has two authentication states rather than two independent
URLs. `App` conditionally renders the correct screen based on whether `profile`
exists. This avoids adding routing complexity before the project has multiple
real EHR sections. A router can be introduced when patient charts, appointments,
staff tools, and other independent routes are implemented.

## Security decisions

- Passwords go directly to Supabase Auth and never enter the `profiles` table.
- Only the publishable Supabase key is included in browser code.
- The database role, not the selected button, determines the account type.
- Self-registration creates patient accounts only.
- Row Level Security must protect every browser-accessible table.
- A secret/service key must never appear in React or any `VITE_` variable.

The role comparison in `App.jsx` is useful for user experience, but it is not
enough to protect medical data. Attackers can modify browser code. PostgreSQL
policies and the future C++ backend must enforce every permission server-side.

## Why Supabase and Vercel?

- Vercel provides simple Git-based deployments and preview builds for the Vite
  frontend.
- Supabase provides managed PostgreSQL, password authentication, sessions, and
  Row Level Security, reducing the amount of security-sensitive code students
  must implement themselves.
- The services communicate over HTTPS; secrets are not committed to GitHub.

## C++ class and function separation

- `AuthService::authenticate()` validates a bearer token with Supabase Auth.
- `PatientService` owns clinical authorization and business operations.
- `DatabaseConnection::query()` is the only low-level SQL execution function;
  it uses PostgreSQL parameters instead of constructing SQL from user input.
- Route lambdas in `main.cpp` translate HTTP requests and responses but do not
  decide which medical records a user may access.

The doctor-patient assignment is checked again on every doctor endpoint. A
patient UUID in a URL is an identifier, not permission. Prescription creates
and updates are written to `audit_logs` in the same database transaction.

## Current limitations to state honestly

- The dashboard is a template, not a complete EHR.
- Audit logging currently covers prescription creates and updates, not every
  possible future operation.
- The project currently uses conditional rendering instead of URL routing.
- Testing may have email confirmation disabled; production should enable an
  appropriate identity-verification process.
- The application needs automated authentication and authorization tests.
- The prototype opens a PostgreSQL connection per request; production should
  add a connection pool, monitoring, backups, and a broader threat review.

Acknowledging these limitations demonstrates that the team understands the
difference between a prototype and a production health-care system.
