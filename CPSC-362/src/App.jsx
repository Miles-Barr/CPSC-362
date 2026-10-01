import { useState } from "react";
import "./App.css";

export default function App() {

  //when using <h1> it can be <h1> throiugh <h6>
  //these dont need quotations because ur using
  //markup which javascript uses to like get html type stuff
  

  //this is a const use state that can be either selected
  //or not selected, it is currently set to null
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main>
      <h1>Sign in</h1>


      {/*when patient button is clicked, role is changed to patient
      //the "=>" helps hand over the function when it is clicked 
      //it only stores the information and activates it when it's clicked*/}
      {/* className selectedRole checks when each role is active */}
      <div>

      <button 
        className={selectedRole === "patient" ? "role-btn active" : "role-btn"}
        onClick={() => setSelectedRole("patient")}
      
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