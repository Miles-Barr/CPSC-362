// ============================================================================
// App.jsx
// ----------------------------------------------------------------------------
// This is the ROOT component of your React app. In a Vite/CRA React project,
// main.jsx renders <App /> into the <div id="root"> in index.html — that's
// the only place App.jsx is "used." Everything your site shows lives inside
// the App function below, either directly or in components it renders.
//
// New-to-JS notes are in comments like this one throughout. Read them once,
// then feel free to delete them as you get comfortable.
// ============================================================================

import { useState } from "react";
// 'useState' is a React "hook" — a special function that lets a component
// remember values between re-renders. Plain JavaScript variables reset every
// time a component re-runs; state variables don't. You'll use this for every
// form field and toggle below.

import { supabase } from "./supabaseClient";
// This imports the Supabase client you'll set up in supabaseClient.js
// (created below). Supabase is a hosted Postgres database with an
// auto-generated API — supabase.from("table").insert(...) sends a row to
// your database over HTTPS. Nothing here talks to Node directly; Node's job
// is just to run the dev server and build tooling (see the explanation at
// the bottom of this file).

import "./App.css";
// Importing a .css file in a React component tells the build tool (Vite)
// to include those styles on the page. There's no "linking a stylesheet in
// the head" step to do yourself — this import does it.

// ----------------------------------------------------------------------------
// A small reusable piece: one labeled text input.
// Writing it as its own function keeps the two big forms below from
// repeating the same <label>/<input> markup a dozen times each.
// "props" (the { label, value, onChange, type } part) are just the
// arguments this component was called with, written as an object.
// ----------------------------------------------------------------------------
function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ----------------------------------------------------------------------------
// PatientProfileForm
// A "controlled form": every input's value comes from state, and every
// keystroke updates that state via onChange. This is the standard React
// pattern — the component's state is always the single source of truth for
// what's on screen.
// ----------------------------------------------------------------------------
function PatientProfileForm() {
  // Each useState call returns a pair: [currentValue, functionToUpdateIt].
  // "const [x, setX] = useState(initial)" is JS array destructuring — it's
  // just unpacking the two items React hands back into two named variables.
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [primaryDoctor, setPrimaryDoctor] = useState("");
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | "error"

  // This runs when the form is submitted (button click or Enter key).
  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's default full-page reload on submit
    setStatus("saving");

    // This is the line that actually talks to Supabase. It assumes a table
    // called "patients" with matching column names — see the SQL at the
    // bottom of this file to create it.
    const { error } = await supabase.from("patients").insert({
      full_name: fullName,
      date_of_birth: dob,
      blood_type: bloodType,
      allergies,
      primary_doctor: primaryDoctor,
    });

    setStatus(error ? "error" : "saved");
  }

  return (
    <form className="profile-card" onSubmit={handleSubmit}>
      <div className="profile-card-header">
        <span className="profile-kicker">Patient record</span>
        <h2>New patient profile</h2>
      </div>

      <Field label="Full name" value={fullName} onChange={setFullName} />
      <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
      <Field label="Blood type" value={bloodType} onChange={setBloodType} />
      <Field label="Known allergies" value={allergies} onChange={setAllergies} />
      <Field
        label="Primary doctor"
        value={primaryDoctor}
        onChange={setPrimaryDoctor}
      />

      <button className="submit-btn" type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save patient"}
      </button>

      {status === "saved" && <p className="status status-ok">Patient saved.</p>}
      {status === "error" && (
        <p className="status status-error">
          Couldn't save — check that Supabase is connected and the "patients"
          table exists.
        </p>
      )}
    </form>
  );
}

// ----------------------------------------------------------------------------
// DoctorProfileForm — same pattern as the patient form, different fields
// and a different Supabase table ("doctors").
// ----------------------------------------------------------------------------
function DoctorProfileForm() {
  const [fullName, setFullName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsPracticing, setYearsPracticing] = useState("");
  const [status, setStatus] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");

    const { error } = await supabase.from("doctors").insert({
      full_name: fullName,
      specialty,
      license_number: licenseNumber,
      years_practicing: yearsPracticing ? Number(yearsPracticing) : null,
    });

    setStatus(error ? "error" : "saved");
  }

  return (
    <form className="profile-card" onSubmit={handleSubmit}>
      <div className="profile-card-header">
        <span className="profile-kicker doctor">Doctor record</span>
        <h2>New doctor profile</h2>
      </div>

      <Field label="Full name" value={fullName} onChange={setFullName} />
      <Field label="Specialty" value={specialty} onChange={setSpecialty} />
      <Field
        label="License number"
        value={licenseNumber}
        onChange={setLicenseNumber}
      />
      <Field
        label="Years practicing"
        type="number"
        value={yearsPracticing}
        onChange={setYearsPracticing}
      />

      <button className="submit-btn" type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save doctor"}
      </button>

      {status === "saved" && <p className="status status-ok">Doctor saved.</p>}
      {status === "error" && (
        <p className="status status-error">
          Couldn't save — check that Supabase is connected and the "doctors"
          table exists.
        </p>
      )}
    </form>
  );
}

// ----------------------------------------------------------------------------
// App — the top-level component. It just tracks "which tab is active" and
// renders the matching form. This is a very common React pattern: one piece
// of state controls which of several components gets shown.
// ----------------------------------------------------------------------------
export default function App() {
  const [activeTab, setActiveTab] = useState("patient"); // "patient" | "doctor"

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">+</span>
          <span className="brand-name">Meridian Health Records</span>
        </div>
        <p className="brand-tagline">Sample patient &amp; provider intake — student project</p>
      </header>

      <main className="app-main">
        <nav className="tab-rail" aria-label="Profile type">
          <button
            className={`tab-btn ${activeTab === "patient" ? "active" : ""}`}
            onClick={() => setActiveTab("patient")}
            type="button"
          >
            Patient
          </button>
          <button
            className={`tab-btn doctor ${activeTab === "doctor" ? "active" : ""}`}
            onClick={() => setActiveTab("doctor")}
            type="button"
          >
            Doctor
          </button>
        </nav>

        {/* Conditional rendering: JSX lets you drop plain JS expressions
            inside {curly braces}. Here a ternary (condition ? a : b) picks
            which form component to render based on activeTab. */}
        {activeTab === "patient" ? <PatientProfileForm /> : <DoctorProfileForm />}
      </main>
    </div>
  );
}

// ============================================================================
// HOW THESE PIECES FIT TOGETHER (read this once, then it'll click)
// ============================================================================
//
// GITHUB is just where your code lives and how you track changes/submit the
// assignment — it doesn't run anything itself.
//
// NODE.JS is the JavaScript runtime on your computer. Your React project
// doesn't run "in Node" in the browser — Node runs the *tooling*: `npm
// install` downloads packages, and `npm run dev` starts Vite's dev server
// (a small Node program) that compiles your .jsx files into plain
// JavaScript the browser can run, and serves them at localhost.
//
// REACT is the library that turns your components (functions that return
// JSX, like PatientProfileForm above) into the actual HTML elements on the
// page, and re-runs a component whenever its state changes (e.g. every
// keystroke in a Field) to keep the page in sync with your data.
//
// SUPABASE is your backend: a hosted Postgres database plus an instant API.
// The supabase-js library (imported above as `supabase`) makes HTTP calls
// from the browser straight to your Supabase project — `supabase.from(...)
// .insert(...)` is really a POST request under the hood. There's no
// separate backend server you have to write for basic CRUD like this.
//
// Data flow for "save a patient": user types -> onChange updates React
// state -> user clicks Save -> handleSubmit sends that state to Supabase ->
// Supabase writes a row to Postgres and returns success/error -> React
// state updates again to show the status message.
//
// ============================================================================
// SETUP YOU STILL NEED TO DO
// ============================================================================
//
// 1) Create supabaseClient.js next to App.jsx:
//
//      import { createClient } from "@supabase/supabase-js";
//      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
//      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
//      export const supabase = createClient(supabaseUrl, supabaseKey);
//
//    Get the URL and anon key from your Supabase project's Settings > API
//    page, and put them in a .env.local file at your project root:
//
//      VITE_SUPABASE_URL=https://your-project.supabase.co
//      VITE_SUPABASE_ANON_KEY=your-anon-key
//
//    Add .env.local to .gitignore so you never commit real keys to GitHub.
//
// 2) In the Supabase SQL editor, create the two tables this form writes to:
//
//      create table patients (
//        id uuid primary key default gen_random_uuid(),
//        full_name text,
//        date_of_birth date,
//        blood_type text,
//        allergies text,
//        primary_doctor text,
//        created_at timestamp default now()
//      );
//
//      create table doctors (
//        id uuid primary key default gen_random_uuid(),
//        full_name text,
//        specialty text,
//        license_number text,
//        years_practicing int,
//        created_at timestamp default now()
//      );
//
// 3) Install the Supabase client library: npm install @supabase/supabase-js
// ============================================================================
