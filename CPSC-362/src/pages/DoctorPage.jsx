import { useState } from "react";

const samplePatients = [
  { id: "P-1001", name: "Jane Smith", dob: "1985-03-12" },
  { id: "P-1002", name: "Carlos Rivera", dob: "1972-11-02" },
  { id: "P-1003", name: "Aisha Khan", dob: "1999-07-25" },
];

export default function DoctorPage({ profile, onLogout }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const results = samplePatients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="page">
      <section className="card" aria-labelledby="doctor-title">
        <p className="eyebrow">Fullerton Health Network</p>
        <h1 id="doctor-title">Doctor Dashboard</h1>
        <p>Welcome, {profile.username}</p>

        <label htmlFor="patient-search">Search patients</label>
        <input
          id="patient-search"
          type="text"
          placeholder="Name or Patient ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ul>
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected(p)}>
                {p.name} ({p.id})
              </button>
            </li>
          ))}
          {results.length === 0 && <li>No matching patients.</li>}
        </ul>

        {selected && (
          <div>
            <h2>{selected.name}</h2>
            <p>Patient ID: {selected.id}</p>
            <p>Date of birth: {selected.dob}</p>
          </div>
        )}

        <button className="secondary-button" type="button" onClick={onLogout}>
          Sign out
        </button>
      </section>
    </main>
  );
}