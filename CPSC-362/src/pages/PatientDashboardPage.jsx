import { useEffect, useState } from "react";
import { getMyPatientDashboard } from "../api/apiClient.js";

function formatDate(value, options = { dateStyle: "long" }) {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-US", options).format(date);
}

function formatTime(value) {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

function recordedValue(value) {
  return value || "Not recorded";
}

function SummaryCard({ label, value, detail }) {
  return (
    <article className="summary-card">
      <p className="summary-label">{label}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}

// PatientDashboardPage never queries PostgreSQL directly. It asks the C++ API
// for the signed-in patient's record and renders only the returned data.
export default function PatientDashboardPage({ profile, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    getMyPatientDashboard()
      .then((data) => {
        if (isMounted) {
          setDashboard(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  function retry() {
    setLoading(true);
    setError("");
    setReloadKey((current) => current + 1);
  }

  const displayName = dashboard?.patient?.displayName || profile.username;
  const upcomingAppointment = dashboard?.upcomingAppointment ?? null;
  const appointments = dashboard?.appointments ?? [];
  const medications = dashboard?.medications ?? [];
  const pharmacy = dashboard?.pharmacy ?? null;
  const healthSummary = dashboard?.healthSummary ?? null;
  const appointmentDate = upcomingAppointment
    ? new Date(upcomingAppointment.startsAt)
    : null;

  return (
    <div className="patient-portal">
      <aside className="portal-sidebar">
        <a className="portal-brand" href="#overview" aria-label="Fullerton Health Network home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>
            <strong>Fullerton Health</strong>
            <small>Patient portal</small>
          </span>
        </a>

        <nav className="portal-nav" aria-label="Patient dashboard navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#appointments">Appointments</a>
          <a href="#medications">Medications</a>
          <a href="#pharmacy">Pharmacy</a>
          <a href="#health-summary">Health summary</a>
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{displayName}</strong>
            <small>Patient account</small>
          </div>
        </div>

        <button className="sign-out-button" type="button" onClick={onLogout}>
          Sign out
        </button>
      </aside>

      <main className="portal-main" id="overview">
        <header className="portal-header">
          <div>
            <p className="section-eyebrow">Patient overview</p>
            <h1>Welcome back, {displayName}</h1>
            <p>Here is a summary of your care and recent activity.</p>
          </div>
          <span className="live-badge">Protected API record</span>
        </header>

        {loading && (
          <section className="dashboard-panel request-state" aria-live="polite">
            <h2>Loading your patient record…</h2>
            <p>The portal is securely requesting your information.</p>
          </section>
        )}

        {!loading && error && (
          <section className="dashboard-panel request-state error-state" role="alert">
            <h2>We could not load your patient record</h2>
            <p>{error}</p>
            <button className="primary-button" type="button" onClick={retry}>Try again</button>
          </section>
        )}

        {!loading && !error && dashboard && (
          <>
            <section className="dashboard-summary" aria-label="Patient summary">
              <SummaryCard
                label="Next appointment"
                value={upcomingAppointment ? formatDate(upcomingAppointment.startsAt) : "None scheduled"}
                detail={upcomingAppointment
                  ? `${formatTime(upcomingAppointment.startsAt)} · ${upcomingAppointment.provider}`
                  : "No upcoming visit is on file"}
              />
              <SummaryCard
                label="Active medications"
                value={`${medications.length} ${medications.length === 1 ? "medication" : "medications"}`}
                detail="Current prescriptions from your care team"
              />
              <SummaryCard
                label="Preferred pharmacy"
                value={pharmacy?.name || "Not selected"}
                detail={pharmacy?.phone || "Add a pharmacy through your care team"}
              />
            </section>

            {upcomingAppointment ? (
              <section className="dashboard-panel upcoming-panel" aria-labelledby="upcoming-title">
                <div className="appointment-date" aria-hidden="true">
                  <span>{formatDate(appointmentDate, { month: "short" })}</span>
                  <strong>{formatDate(appointmentDate, { day: "2-digit" })}</strong>
                </div>
                <div className="appointment-details">
                  <p className="section-eyebrow">Upcoming appointment</p>
                  <h2 id="upcoming-title">{upcomingAppointment.specialty}</h2>
                  <p>{upcomingAppointment.provider}</p>
                  <p>{formatDate(upcomingAppointment.startsAt)} at {formatTime(upcomingAppointment.startsAt)}</p>
                  <p>{recordedValue(upcomingAppointment.location)}</p>
                </div>
                <span className="status-badge scheduled">Scheduled</span>
              </section>
            ) : (
              <section className="dashboard-panel empty-state">
                <p className="section-eyebrow">Upcoming appointment</p>
                <h2>No appointment scheduled</h2>
                <p>Your next scheduled visit will appear here.</p>
              </section>
            )}

            <section className="dashboard-panel" id="appointments" aria-labelledby="appointments-title">
              <SectionHeading
                id="appointments-title"
                eyebrow="Visit history"
                title="Previous appointments"
                description="Your most recent completed visits"
              />
              {appointments.length > 0 ? (
                <div className="appointments-table-wrapper">
                  <table className="appointments-table">
                    <thead>
                      <tr><th>Date</th><th>Visit</th><th>Provider</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{formatDate(appointment.startsAt)}</td>
                          <td>{appointment.type}</td>
                          <td>{appointment.provider}</td>
                          <td><span className="status-badge">{appointment.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-copy">No previous appointments are on file.</p>}
            </section>

            <section className="dashboard-panel" id="medications" aria-labelledby="medications-title">
              <SectionHeading
                id="medications-title"
                eyebrow="Prescriptions"
                title="Current medications"
                description="Review dosage instructions and refill availability"
              />
              {medications.length > 0 ? (
                <div className="medication-list">
                  {medications.map((medication) => (
                    <article className="medication-item" key={medication.id}>
                      <div className="medication-icon" aria-hidden="true">Rx</div>
                      <div className="medication-copy">
                        <div className="medication-title">
                          <h3>{medication.name}</h3>
                          <strong>{medication.dosage}</strong>
                        </div>
                        <p>{medication.instructions}</p>
                        <small>Prescribed by {medication.prescribedBy}</small>
                      </div>
                      <span className="refill-label">
                        {medication.refillsRemaining} {medication.refillsRemaining === 1 ? "refill" : "refills"} remaining
                      </span>
                    </article>
                  ))}
                </div>
              ) : <p className="empty-copy">No active medications are on file.</p>}
            </section>

            <div className="dashboard-two-column">
              <section className="dashboard-panel" id="pharmacy" aria-labelledby="pharmacy-title">
                <SectionHeading id="pharmacy-title" eyebrow="Prescriptions" title="Preferred pharmacy" />
                {pharmacy ? (
                  <div className="pharmacy-card">
                    <span className="pharmacy-symbol" aria-hidden="true">Rx</span>
                    <div>
                      <h3>{pharmacy.name}</h3>
                      <p>{pharmacy.address}</p>
                      {pharmacy.phone && <a href={`tel:${pharmacy.phone.replace(/[^0-9+]/g, "")}`}>{pharmacy.phone}</a>}
                      <small>{recordedValue(pharmacy.hours)}</small>
                    </div>
                  </div>
                ) : <p className="empty-copy">No preferred pharmacy has been selected.</p>}
              </section>

              <section className="dashboard-panel" id="health-summary" aria-labelledby="health-title">
                <SectionHeading id="health-title" eyebrow="At a glance" title="Health summary" />
                <dl className="health-summary-list">
                  <div><dt>Allergies</dt><dd>{recordedValue(healthSummary?.allergies)}</dd></div>
                  <div><dt>Blood type</dt><dd>{recordedValue(healthSummary?.bloodType)}</dd></div>
                  <div><dt>Primary provider</dt><dd>{recordedValue(healthSummary?.primaryCareProvider)}</dd></div>
                  <div><dt>Insurance</dt><dd>{recordedValue(healthSummary?.insurance)}</dd></div>
                </dl>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

