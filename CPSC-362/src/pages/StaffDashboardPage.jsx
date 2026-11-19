import { useEffect, useMemo, useState } from "react";
import {
  getStaffDashboard,
  updatePatientAssignment,
  updateStaffUserRole,
  updateStaffUserStatus,
} from "../api/apiClient.js";

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
}

function auditDescription(log) {
  const details = log.metadata ?? {};
  if (log.action === "assignment.created") {
    return `${details.patientName ?? "Patient"} was assigned to ${details.doctorName ?? "a doctor"}.`;
  }
  if (log.action === "assignment.reassigned") {
    return `${details.patientName ?? "Patient"} was reassigned from ${details.previousDoctorName ?? "the previous doctor"} to ${details.doctorName ?? "a new doctor"}.`;
  }
  if (log.action === "assignment.removed") {
    return `${details.patientName ?? "Patient"} was unassigned from ${details.previousDoctorName ?? "a doctor"}.`;
  }
  if (log.action === "profile.role_changed") {
    return `${details.username ?? "A user"} changed from ${details.oldRole ?? "their previous role"} to ${details.newRole ?? "a new role"}.`;
  }
  if (log.action === "profile.status_changed") {
    return `${details.username ?? "A user"} was ${details.newActive ? "activated" : "deactivated"}.`;
  }
  return log.action;
}

export default function StaffDashboardPage({ profile, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getStaffDashboard()
      .then((data) => {
        if (!isMounted) return;
        setDashboard(data);
        setAssignmentDrafts(Object.fromEntries(
          data.patients.map((patient) => [patient.id, patient.assignedDoctor?.id ?? ""]),
        ));
        setError("");
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

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return (dashboard?.users ?? []).filter((user) => {
      const matchesSearch = !search || user.username.toLowerCase().includes(search);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [dashboard, roleFilter, userSearch]);

  const activeDoctors = (dashboard?.doctors ?? []).filter((doctor) => doctor.active);
  const unassignedPatients = (dashboard?.patients ?? []).filter(
    (patient) => patient.accountActive && !patient.assignedDoctor,
  );

  async function runMutation(key, operation, successMessage) {
    setSavingKey(key);
    setError("");
    setActionMessage("");
    try {
      await operation();
      setActionMessage(successMessage);
      setReloadKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingKey("");
    }
  }

  function setAssignmentDraft(patientId, doctorId) {
    setAssignmentDrafts((current) => ({ ...current, [patientId]: doctorId }));
  }

  function saveAssignment(patient) {
    const doctorId = assignmentDrafts[patient.id] || null;
    const currentDoctorId = patient.assignedDoctor?.id ?? null;
    if (doctorId === currentDoctorId) {
      setActionMessage("That assignment is already current.");
      return;
    }
    const doctor = activeDoctors.find((item) => item.id === doctorId);
    const message = doctorId
      ? `${patient.displayName} was assigned to ${doctor?.displayName ?? "the selected doctor"}.`
      : `${patient.displayName} is now unassigned.`;
    runMutation(
      `assignment-${patient.id}`,
      () => updatePatientAssignment(patient.id, doctorId),
      message,
    );
  }

  function changeRole(user) {
    const nextRole = user.role === "doctor" ? "patient" : "doctor";
    const prompt = nextRole === "doctor"
      ? `Promote ${user.username} to Doctor?`
      : `Remove the Doctor role from ${user.username}? Their active patient assignments will be removed.`;
    if (!window.confirm(prompt)) return;
    runMutation(
      `role-${user.id}`,
      () => updateStaffUserRole(user.id, nextRole),
      `${user.username} is now a ${nextRole}.`,
    );
  }

  function changeStatus(user) {
    const nextActive = !user.active;
    const prompt = nextActive
      ? `Reactivate ${user.username}?`
      : `Deactivate ${user.username}? They will no longer be able to use the application.`;
    if (!window.confirm(prompt)) return;
    runMutation(
      `status-${user.id}`,
      () => updateStaffUserStatus(user.id, nextActive),
      `${user.username} was ${nextActive ? "activated" : "deactivated"}.`,
    );
  }

  if (loading && !dashboard) {
    return (
      <main className="page" aria-live="polite">
        <p>Loading staff dashboard...</p>
      </main>
    );
  }

  return (
    <div className="patient-portal staff-portal">
      <aside className="portal-sidebar">
        <a className="portal-brand" href="#overview" aria-label="Fullerton Health Network home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span><strong>Fullerton Health</strong><small>Staff operations</small></span>
        </a>

        <nav className="portal-nav" aria-label="Staff dashboard navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#unassigned">Unassigned patients</a>
          <a href="#assignments">Assignments</a>
          <a href="#users">User directory</a>
          <a href="#audit">Audit history</a>
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <div><strong>{profile.username}</strong><small>Staff account</small></div>
        </div>
        <button className="sign-out-button" type="button" onClick={onLogout}>Sign out</button>
      </aside>

      <main className="portal-main" id="overview">
        <header className="portal-header">
          <div>
            <p className="section-eyebrow">Operations dashboard</p>
            <h1>Staff administration</h1>
            <p>Manage patient assignments, account access, and clinical roles.</p>
          </div>
          <span className="live-badge">Staff-authorized access</span>
        </header>

        {error && <p className="portal-alert error-message" role="alert">{error}</p>}
        {actionMessage && <p className="portal-alert success-message" role="status">{actionMessage}</p>}

        {dashboard && (
          <>
            <section className="dashboard-summary staff-summary" aria-label="Staff summary">
              <article className="summary-card">
                <p className="summary-label">Registered users</p>
                <strong>{dashboard.summary.totalUsers}</strong>
                <p>Patient, doctor, and staff profiles</p>
              </article>
              <article className="summary-card">
                <p className="summary-label">Active doctors</p>
                <strong>{dashboard.summary.activeDoctors}</strong>
                <p>Available for patient assignments</p>
              </article>
              <article className="summary-card">
                <p className="summary-label">Unassigned patients</p>
                <strong>{dashboard.summary.unassignedPatients}</strong>
                <p>Active patients needing a doctor</p>
              </article>
            </section>

            <section className="dashboard-panel" id="unassigned" aria-labelledby="unassigned-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Assignment queue</p><h2 id="unassigned-title">Unassigned patients</h2></div>
                <p>{unassignedPatients.length} awaiting assignment</p>
              </div>
              {unassignedPatients.length > 0 ? (
                <div className="staff-card-grid">
                  {unassignedPatients.map((patient) => (
                    <article className="staff-action-card" key={patient.id}>
                      <div><strong>{patient.displayName}</strong><small>Date of birth: {formatDate(patient.dateOfBirth)}</small></div>
                      <label>
                        Assign doctor
                        <select
                          value={assignmentDrafts[patient.id] ?? ""}
                          onChange={(event) => setAssignmentDraft(patient.id, event.target.value)}
                        >
                          <option value="">Select a doctor</option>
                          {activeDoctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              {doctor.displayName} ({doctor.assignedPatientCount} patients)
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={!assignmentDrafts[patient.id] || Boolean(savingKey)}
                        onClick={() => saveAssignment(patient)}
                      >
                        {savingKey === `assignment-${patient.id}` ? "Assigning..." : "Assign patient"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : <p className="empty-copy">Every active patient currently has an assigned doctor.</p>}
            </section>

            <section className="dashboard-panel" id="assignments" aria-labelledby="assignments-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Care coordination</p><h2 id="assignments-title">Patient assignments</h2></div>
                <p>Assign, reassign, or unassign active patients</p>
              </div>
              <div className="staff-table-wrapper">
                <table className="staff-table">
                  <thead><tr><th>Patient</th><th>Current doctor</th><th>New assignment</th><th>Action</th></tr></thead>
                  <tbody>
                    {dashboard.patients.map((patient) => (
                      <tr key={patient.id}>
                        <td><strong>{patient.displayName}</strong><small>{patient.accountActive ? "Active account" : "Inactive account"}</small></td>
                        <td>{patient.assignedDoctor?.displayName ?? "Unassigned"}</td>
                        <td>
                          <select
                            aria-label={`Doctor assignment for ${patient.displayName}`}
                            value={assignmentDrafts[patient.id] ?? ""}
                            disabled={!patient.accountActive || Boolean(savingKey)}
                            onChange={(event) => setAssignmentDraft(patient.id, event.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.displayName}</option>)}
                          </select>
                        </td>
                        <td>
                          <button
                            className="compact-button"
                            type="button"
                            disabled={!patient.accountActive || Boolean(savingKey)}
                            onClick={() => saveAssignment(patient)}
                          >
                            {savingKey === `assignment-${patient.id}` ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-panel" aria-labelledby="doctors-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Provider capacity</p><h2 id="doctors-title">Doctor overview</h2></div>
                <p>{dashboard.doctors.length} doctor-role accounts</p>
              </div>
              <div className="staff-card-grid">
                {dashboard.doctors.map((doctor) => (
                  <article className="staff-doctor-card" key={doctor.id}>
                    <div><strong>{doctor.displayName}</strong><span className={`account-status ${doctor.active ? "active" : "inactive"}`}>{doctor.active ? "Active" : "Inactive"}</span></div>
                    <p>{doctor.specialty ?? "Specialty not recorded"}</p>
                    <small>{doctor.assignedPatientCount} active patient {doctor.assignedPatientCount === 1 ? "assignment" : "assignments"}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-panel" id="users" aria-labelledby="users-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Account administration</p><h2 id="users-title">User directory</h2></div>
                <p>Manage doctor roles and application access</p>
              </div>
              <div className="staff-toolbar">
                <label>Search users<input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by username" /></label>
                <label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option><option value="patient">Patients</option><option value="doctor">Doctors</option><option value="staff">Staff</option></select></label>
              </div>
              <div className="staff-table-wrapper">
                <table className="staff-table">
                  <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Role action</th><th>Access action</th></tr></thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td><strong>{user.username}</strong>{user.isCurrentUser && <small>Current account</small>}</td>
                        <td><span className="role-chip">{user.role}</span></td>
                        <td><span className={`account-status ${user.active ? "active" : "inactive"}`}>{user.active ? "Active" : "Inactive"}</span></td>
                        <td>
                          {user.role === "staff" ? <span className="muted-text">Protected</span> : (
                            <button className="compact-button" type="button" disabled={Boolean(savingKey)} onClick={() => changeRole(user)}>
                              {savingKey === `role-${user.id}` ? "Saving..." : user.role === "doctor" ? "Remove doctor role" : "Make doctor"}
                            </button>
                          )}
                        </td>
                        <td>
                          <button className={user.active ? "compact-danger-button" : "compact-button"} type="button" disabled={user.isCurrentUser || Boolean(savingKey)} onClick={() => changeStatus(user)}>
                            {savingKey === `status-${user.id}` ? "Saving..." : user.active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-panel" id="audit" aria-labelledby="audit-title">
              <div className="section-heading">
                <div><p className="section-eyebrow">Accountability</p><h2 id="audit-title">Staff audit history</h2></div>
                <p>Most recent 50 administrative actions</p>
              </div>
              {dashboard.auditLogs.length > 0 ? (
                <ol className="audit-list">
                  {dashboard.auditLogs.map((log) => (
                    <li key={log.id}>
                      <div><strong>{auditDescription(log)}</strong><span>{log.action}</span></div>
                      <p>By {log.actorUsername} · {formatDateTime(log.occurredAt)}</p>
                    </li>
                  ))}
                </ol>
              ) : <p className="empty-copy">No staff administrative actions have been recorded yet.</p>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
