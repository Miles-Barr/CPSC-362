import { useState } from "react";

const roles = ["patient", "doctor", "staff"];

export default function LoginPage({ onLogin, onSignUp }) {
  const [mode, setMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("patient");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const creatingAccount = mode === "signup";

  function changeMode(nextMode) {
    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
    setPassword("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      if (creatingAccount) {
        const result = await onSignUp({ username, email, password });

        if (result.requiresEmailConfirmation) {
          setSuccessMessage("Account created. Check your email to confirm it, then sign in as Patient.");
          setPassword("");
        }
      } else {
        await onLogin({ email, password, selectedRole });
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="card" aria-labelledby="login-title">
        <h1 id="login-title">{creatingAccount ? "Create account" : "Sign in"}</h1>
        <p className="subtitle">Fullerton Health Network</p>

        <form onSubmit={handleSubmit}>
          {creatingAccount ? (
            <>
              <p className="account-note">New accounts are created as Patient accounts.</p>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                pattern="[A-Za-z0-9_]{3,30}"
                title="Use 3–30 letters, numbers, or underscores."
                required
              />
            </>
          ) : (
            <fieldset>
              <legend>Account type</legend>
              <div className="role-options">
                {roles.map((role) => (
                  <button
                    type="button"
                    className={selectedRole === role ? "role-button active" : "role-button"}
                    aria-pressed={selectedRole === role}
                    key={role}
                    onClick={() => setSelectedRole(role)}
                  >
                    {role[0].toUpperCase() + role.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={creatingAccount ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={creatingAccount ? 12 : undefined}
            required
          />

          {creatingAccount && (
            <p className="field-help">Use at least 12 characters.</p>
          )}

          {errorMessage && (
            <p className="error-message" role="alert">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="success-message" role="status">
              {successMessage}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting
              ? creatingAccount
                ? "Creating account..."
                : "Signing in..."
              : creatingAccount
                ? "Create patient account"
                : `Sign in as ${selectedRole}`}
          </button>

          <button
            className="text-button"
            type="button"
            onClick={() => changeMode(creatingAccount ? "login" : "signup")}
          >
            {creatingAccount ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </form>
      </section>
    </main>
  );
}
