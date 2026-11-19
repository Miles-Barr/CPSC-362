import { useEffect, useState } from "react";
import {
  createPrescription,
  getAssignedPatients,
  getDoctorPatientDashboard,
  updatePrescription,
} from "../api/apiClient.js";

const emptyPrescription = {
  name: "",
  dosage: "",
  instructions: "",
  refillsRemaining: "0",
};

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

// Doctors see only patients assigned to them by the server. Selecting a patient
// causes a second authorized request; the patient ID in the URL is never enough
// by itself to grant access.
export default function DoctorDashboardPage({ profile, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [prescription, setPrescription] = useState(emptyPrescription);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getAssignedPatients()
      .then(({ patients: assignedPatients }) => {
        if (!isMounted) return;
        setPatients(assignedPatients);
        setLoadingDashboard(Boolean(assignedPatients[0]));
        setSelectedPatientId((current) => current || assignedPatients[0]?.id || "");
        setError("");
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setLoadingPatients(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return undefined;
    let isMounted = true;

    getDoctorPatientDashboard(selectedPatientId)
      .then((patientDashboard) => {
        if (isMounted) {
          setDashboard(patientDashboard);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setLoadingDashboard(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId, reloadKey]);

  function selectPatient(patientId) {
    setSelectedPatientId(patientId);
    setDashboard(null);
    setLoadingDashboard(true);
    setError("");
    setActionMessage("");
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setPrescription((current) => ({ ...current, [name]: value }));
  }

  async function addPrescription(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setActionMessage("");
    try {
      await createPrescription(selectedPatientId, {
        ...prescription,
        refillsRemaining: Number(prescription.refillsRemaining),
      });
      setPrescription(emptyPrescription);
      setActionMessage("Prescription saved and added to the audit log.");
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function discontinue(medication) {
    const confirmed = window.confirm(`Discontinue ${medication.name}?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setActionMessage("");
    try {
      await updatePrescription(selectedPatientId, medication.id, {
        status: "discontinued",
      });
      setActionMessage(`${medication.name} was discontinued and audited.`);
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="patient-portal doctor-portal">
      <aside className="portal-sidebar">
        <a className="portal-brand" href="#patients" aria-label="Fullerton Health Network home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>
            <strong>Fullerton Health</strong>
            <small>Clinical portal</small>
          </span>
        </a>

        <nav className="portal-nav" aria-label="Doctor dashboard navigation">
          <a className="active" href="#patients">Assigned patients</a>
          <a href="#patient-record">Patient record</a>
          <a href="#new-prescription">New prescription</a>
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <div><strong>{profile.username}</strong><small>Doctor account</small></div>
        </div>

        <button className="sign-out-button" type="button" onClick={onLogout}>Sign out</button>
      </aside>

      <main className="portal-main" id="patients">
        <header className="portal-header">
          <div>
            <p className="section-eyebrow">Clinical dashboard</p>
            <h1>Assigned patients</h1>
            <p>Select a patient to review their record and manage prescriptions.</p>
          </div>
          <span className="live-badge">Server-authorized access</span>
        </header>

        {error && <p className="portal-alert error-message" role="alert">{error}</p>}
        {actionMessage && <p className="portal-alert success-message" role="status">{actionMessage}</p>}

        <section className="dashboard-panel" aria-labelledby="patient-list-title">
          <div className="section-heading">
            <div><p className="section-eyebrow">Care team</p><h2 id="patient-list-title">Your patients</h2></div>
            <p>{patients.length} active {patients.length === 1 ? "assignment" : "assignments"}</p>
          </div>

          {loadingPatients ? <p className="empty-copy">Loading assigned patients…</p> : (
            patients.length > 0 ? (
              <div className="patient-selector">
                {patients.map((patient) => (
                  <button
                    className={patient.id === selectedPatientId ? "patient-select active" : "patient-select"}
                    key={patient.id}
                    type="button"
                    onClick={() => selectPatient(patient.id)}
                  >
                    <strong>{patient.displayName}</strong>
                    <span>Date of birth: {formatDate(patient.dateOfBirth)}</span>
                  </button>
                ))}
              </div>
            ) : <p className="empty-copy">No patients are assigned to this doctor.</p>
          )}
        </section>

        {loadingDashboard && <section className="dashboard-panel request-state"><h2>Loading patient record…</h2></section>}

        {!loadingDashboard && dashboard && (
          <>
            <section className="dashboard-panel" id="patient-record" aria-labelledby="record-title">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">Authorized patient record</p>
                  <h2 id="record-title">{dashboard.patient.displayName}</h2>
                </div>
                <p>Date of birth: {formatDate(dashboard.patient.dateOfBirth)}</p>
              </div>

              <div className="doctor-record-grid">
                <article>
                  <span>Next appointment</span>
                  <strong>{dashboard.upcomingAppointment
                    ? formatDate(dashboard.upcomingAppointment.startsAt)
                    : "None scheduled"}</strong>
                </article>
                <article>
                  <span>Active medications</span>
                  <strong>{dashboard.medications.length}</strong>
                </article>
                <article>
                  <span>Preferred pharmacy</span>
                  <strong>{dashboard.pharmacy?.name || "Not selected"}</strong>
                </article>
              </div>

              <div className="medication-list doctor-medication-list">
                {dashboard.medications.length > 0 ? dashboard.medications.map((medication) => (
                  <article className="medication-item" key={medication.id}>
                    <div className="medication-icon" aria-hidden="true">Rx</div>
                    <div className="medication-copy">
                      <div className="medication-title"><h3>{medication.name}</h3><strong>{medication.dosage}</strong></div>
                      <p>{medication.instructions}</p>
                      <small>{medication.refillsRemaining} refills remaining</small>
                    </div>
                    <button className="outline-danger-button" type="button" disabled={saving} onClick={() => discontinue(medication)}>
                      Discontinue
                    </button>
                  </article>
                )) : <p className="empty-copy">No active medications are on file.</p>}
              </div>
            </section>

            <section className="dashboard-panel" id="new-prescription" aria-labelledby="prescription-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Medication order</p><h2 id="prescription-title">Add a prescription</h2></div>
                <p>Every saved change is written to the audit log.</p>
              </div>

              <form className="prescription-form" onSubmit={addPrescription}>
                <label>
                  Medication name
                  <input name="name" value={prescription.name} onChange={updateForm} maxLength="160" required />
                </label>
                <label>
                  Dosage
                  <input name="dosage" value={prescription.dosage} onChange={updateForm} placeholder="10 mg" maxLength="120" required />
                </label>
                <label className="wide-field">
                  Instructions
                  <input name="instructions" value={prescription.instructions} onChange={updateForm} maxLength="500" required />
                </label>
                <label>
                  Refills
                  <input name="refillsRemaining" type="number" min="0" max="24" value={prescription.refillsRemaining} onChange={updateForm} required />
                </label>
                <button className="primary-button prescription-submit" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save prescription"}
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

