import { useState } from "react";
import "./App.css";

export default function App() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main>
      <h1>Sign in</h1>

      <div>
        <button
          type="button"
          className={selectedRole === "patient" ? "role-btn active" : "role-btn"}
          onClick={() => setSelectedRole("patient")}
        >
          Patient
        </button>

        <button
          type="button"
          className={selectedRole === "doctor" ? "role-btn active" : "role-btn"}
          onClick={() => setSelectedRole("doctor")}
        >
          Doctor
        </button>

        <button
          type="button"
          className={selectedRole === "staff" ? "role-btn active" : "role-btn"}
          onClick={() => setSelectedRole("staff")}
        >
          Staff
        </button>
      </div>

      <p>Selected role: {selectedRole || "None"}</p>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
    </main>
  );
}