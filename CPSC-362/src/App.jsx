

import { useState } from "react"; //useState remembers values accross rerenders, whatever that value might be, in this case a button indicates it but it doesn't have to be a button

import "./App.css"; //this imports the css file

//NOTES
//JSX vs JS: 
//    comment "{/**/}" and comment "//"


//this is what main.jsx imports and renders, 
//it has to start w a capital letter bcuz of how React works
//It has to return something
export default function App() {

  //when using <h1> it can be <h1> throiugh <h6>
  //these dont need quotations because ur using
  //markup which javascript uses to like get html type stuff

  //this is a const use state that can be either selected
  //or not selected, it is currently set to null
  const [selectedRole, setSelectedRole] = useState(null);

  //A component can only return one root element, so you can't
  //put like return <h1>hi</h1> <button>yes</button> next to eachother
  //thats what "div" does, or commonly does, kinda like brackets 
  //keeping everything together
      
  return (
    <div>
      <h1>Sign in</h1>

      {/*when patient button is clicked, role is changed to patient
      //the "=>" helps hand over the function when it is clicked 
      //it only stores the information and activates it when it's clicked*/}
      {/* className selectedRole checks when each role is active */}

      <button 
        className={selectedRole === "patient" ? "role-btn active" : "role-btn"}
        onClick={() => setSelectedRole("patient")}
        >
          Patient
        </button>

      <button 

        className={selectedRole === "doctor" ? "role-btn active" : "role-btn"}
        onClick={() => setSelectedRole("doctor")}>
          Doctor
        </button>

      <button 
        className={selectedRole === "staff" ? "role-btn active" : "role-btn"}
      
        onClick={() => setSelectedRole("staff")}>
          Staff
        </button>

      {/* testing that selectedRole is working */}
      <p> {selectedRole} </p>

      {/* creating inputs that will eventually be teh passwrd and email */}
      <input>
        value={someState}
        onChange={(e) => someSetter(e.target.value)}
      </input>

    </div>
      
  );
}


