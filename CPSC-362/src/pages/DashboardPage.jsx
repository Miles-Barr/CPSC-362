export default function DashboardPage({ profile, onLogout }) {
  const roleName = profile.role[0].toUpperCase() + profile.role.slice(1);

  return (
    <main className="page">
      <section className="card" aria-labelledby="dashboard-title">
        <p className="eyebrow">Fullerton Health Network</p>
        <h1 id="dashboard-title">Logged in as {profile.username}</h1>
        <p>Account type: {roleName}</p>
        <p className="template-note">
          This is the {roleName.toLowerCase()} dashboard template.
        </p>
        <button className="secondary-button" type="button" onClick={onLogout}>
          Sign out
        </button>
      </section>
    </main>
  );
}
