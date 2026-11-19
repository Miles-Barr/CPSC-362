import { supabase } from "../supabaseClient.js";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const isApiConfigured = Boolean(apiBaseUrl);

async function apiRequest(path, options = {}) {
  if (!isApiConfigured) {
    throw new Error(
      "The C++ API is not configured. Add VITE_API_URL and restart the site.",
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Your sign-in session has expired. Sign in again.");
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("The patient-record server could not be reached.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "The patient-record request failed.");
  }
  return body;
}

export function getMyPatientDashboard() {
  return apiRequest("/api/patients/me/dashboard");
}

export function getAssignedPatients() {
  return apiRequest("/api/doctor/patients");
}

export function getDoctorPatientDashboard(patientId) {
  return apiRequest(`/api/doctor/patients/${patientId}/dashboard`);
}

export function createPrescription(patientId, prescription) {
  return apiRequest(`/api/doctor/patients/${patientId}/prescriptions`, {
    method: "POST",
    body: JSON.stringify(prescription),
  });
}

export function updatePrescription(patientId, prescriptionId, changes) {
  return apiRequest(
    `/api/doctor/patients/${patientId}/prescriptions/${prescriptionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(changes),
    },
  );
}

