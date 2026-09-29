

import { useState } from "react"; //useState is what gives button functionality

import "./App.css"; //this imports the css file



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
  return <h1>Sign in</h1>
}

//creating a boolean that can be either doc patient staff or null
role = "doctor" | "patient" | "staff" | null;

onClick=>someStateSetter("patient") {
  <button>patient</button>
}

//<button>patient</button>
//<button>staff</button>

