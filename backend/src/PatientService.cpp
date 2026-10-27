#include "PatientService.hpp"

#include "ApiError.hpp"

#include <algorithm>
#include <cctype>
#include <optional>
#include <string>

namespace {
using nlohmann::json;

json nullableText(const PgResult& result, int row, const char* column) {
  const auto value = result.optionalValue(row, column);
  return value ? json(*value) : json(nullptr);
}

std::string trim(std::string value) {
  const auto notSpace = [](unsigned char character) {
    return !std::isspace(character);
  };
  value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
  value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(),
              value.end());
  return value;
}

std::string requiredText(const json& input, const char* field,
                         std::size_t maximumLength) {
  if (!input.contains(field) || !input[field].is_string()) {
    throw ApiError(400, std::string(field) + " is required.");
  }

  std::string value = trim(input[field].get<std::string>());
  if (value.empty() || value.size() > maximumLength) {
    throw ApiError(400, std::string(field) + " has an invalid length.");
  }
  return value;
}

std::optional<std::string> optionalText(const json& input, const char* field,
                                        std::size_t maximumLength) {
  if (!input.contains(field)) {
    return std::nullopt;
  }
  if (!input[field].is_string()) {
    throw ApiError(400, std::string(field) + " must be text.");
  }

  std::string value = trim(input[field].get<std::string>());
  if (value.empty() || value.size() > maximumLength) {
    throw ApiError(400, std::string(field) + " has an invalid length.");
  }
  return value;
}

std::optional<int> optionalRefills(const json& input) {
  if (!input.contains("refillsRemaining")) {
    return std::nullopt;
  }
  if (!input["refillsRemaining"].is_number_integer()) {
    throw ApiError(400, "refillsRemaining must be a whole number.");
  }

  const int value = input["refillsRemaining"].get<int>();
  if (value < 0 || value > 24) {
    throw ApiError(400, "refillsRemaining must be between 0 and 24.");
  }
  return value;
}

std::optional<std::string> optionalStatus(const json& input) {
  auto status = optionalText(input, "status", 20);
  if (status && *status != "active" && *status != "completed" &&
      *status != "discontinued") {
    throw ApiError(400, "status must be active, completed, or discontinued.");
  }
  return status;
}
}  // namespace

PatientService::PatientService(const Database& database) : database_(database) {}

std::string PatientService::requireRole(DatabaseConnection& connection,
                                        const std::string& profileId,
                                        const std::string& expectedRole) {
  const PgResult profile = connection.query(
      "select role from public.profiles where id = $1::uuid", {profileId});
  if (profile.rows() == 0 || profile.value(0, "role") != expectedRole) {
    throw ApiError(403, "This account is not authorized for that operation.");
  }

  const std::string entityQuery =
      expectedRole == "patient"
          ? "select id::text as id from public.patients where profile_id = $1::uuid"
          : "select id::text as id from public.doctors where profile_id = $1::uuid";
  const PgResult entity = connection.query(entityQuery, {profileId});
  if (entity.rows() == 0) {
    throw ApiError(409, "The account is missing its clinical profile.");
  }
  return entity.value(0, "id");
}

std::string PatientService::requireAssignedPatient(
    DatabaseConnection& connection, const std::string& doctorProfileId,
    const std::string& patientId) {
  const std::string doctorId =
      requireRole(connection, doctorProfileId, "doctor");
  const PgResult assignment = connection.query(
      R"sql(
        select 1
        from public.doctor_patients
        where doctor_id = $1::uuid
          and patient_id = $2::uuid
          and active = true
      )sql",
      {doctorId, patientId});
  if (assignment.rows() == 0) {
    throw ApiError(403, "This patient is not assigned to the signed-in doctor.");
  }
  return doctorId;
}

nlohmann::json PatientService::loadDashboard(DatabaseConnection& connection,
                                             const std::string& patientId) {
  const PgResult patient = connection.query(
      R"sql(
        select id::text as id, display_name, date_of_birth::text as date_of_birth
        from public.patients
        where id = $1::uuid
      )sql",
      {patientId});
  if (patient.rows() == 0) {
    throw ApiError(404, "Patient record not found.");
  }

  json dashboard = {
      {"patient",
       {{"id", patient.value(0, "id")},
        {"displayName", patient.value(0, "display_name")},
        {"dateOfBirth", nullableText(patient, 0, "date_of_birth")}}},
      {"upcomingAppointment", nullptr},
      {"appointments", json::array()},
      {"medications", json::array()},
      {"pharmacy", nullptr},
      {"healthSummary", nullptr},
  };

  const PgResult upcoming = connection.query(
      R"sql(
        select a.id::text as id,
               a.starts_at::text as starts_at,
               a.visit_type,
               a.location,
               a.status,
               coalesce(d.display_name, 'Provider pending') as provider,
               coalesce(d.specialty, a.visit_type) as specialty
        from public.appointments a
        left join public.doctors d on d.id = a.doctor_id
        where a.patient_id = $1::uuid
          and a.status = 'scheduled'
          and a.starts_at >= now()
        order by a.starts_at
        limit 1
      )sql",
      {patientId});
  if (upcoming.rows() > 0) {
    dashboard["upcomingAppointment"] = {
        {"id", upcoming.value(0, "id")},
        {"startsAt", upcoming.value(0, "starts_at")},
        {"type", upcoming.value(0, "visit_type")},
        {"specialty", upcoming.value(0, "specialty")},
        {"provider", upcoming.value(0, "provider")},
        {"location", nullableText(upcoming, 0, "location")},
        {"status", upcoming.value(0, "status")},
    };
  }

  const PgResult appointments = connection.query(
      R"sql(
        select a.id::text as id,
               a.starts_at::text as starts_at,
               a.visit_type,
               a.status,
               coalesce(d.display_name, 'Provider unavailable') as provider
        from public.appointments a
        left join public.doctors d on d.id = a.doctor_id
        where a.patient_id = $1::uuid
          and (a.status = 'completed' or a.starts_at < now())
        order by a.starts_at desc
        limit 10
      )sql",
      {patientId});
  for (int row = 0; row < appointments.rows(); ++row) {
    dashboard["appointments"].push_back({
        {"id", appointments.value(row, "id")},
        {"startsAt", appointments.value(row, "starts_at")},
        {"type", appointments.value(row, "visit_type")},
        {"provider", appointments.value(row, "provider")},
        {"status", appointments.value(row, "status")},
    });
  }

  const PgResult medications = connection.query(
      R"sql(
        select p.id::text as id,
               m.name,
               p.dosage,
               p.instructions,
               p.refills_remaining::text as refills_remaining,
               p.status,
               d.display_name as prescribed_by
        from public.prescriptions p
        join public.medications m on m.id = p.medication_id
        join public.doctors d on d.id = p.prescribed_by
        where p.patient_id = $1::uuid
          and p.status = 'active'
          and (p.end_date is null or p.end_date >= current_date)
        order by m.name
      )sql",
      {patientId});
  for (int row = 0; row < medications.rows(); ++row) {
    dashboard["medications"].push_back({
        {"id", medications.value(row, "id")},
        {"name", medications.value(row, "name")},
        {"dosage", medications.value(row, "dosage")},
        {"instructions", medications.value(row, "instructions")},
        {"prescribedBy", medications.value(row, "prescribed_by")},
        {"refillsRemaining",
         std::stoi(medications.value(row, "refills_remaining"))},
        {"status", medications.value(row, "status")},
    });
  }

  const PgResult pharmacy = connection.query(
      R"sql(
        select p.id::text as id, p.name, p.address, p.phone, p.hours
        from public.patient_pharmacies selected
        join public.pharmacies p on p.id = selected.pharmacy_id
        where selected.patient_id = $1::uuid
        order by selected.is_preferred desc, selected.selected_at desc
        limit 1
      )sql",
      {patientId});
  if (pharmacy.rows() > 0) {
    dashboard["pharmacy"] = {
        {"id", pharmacy.value(0, "id")},
        {"name", pharmacy.value(0, "name")},
        {"address", pharmacy.value(0, "address")},
        {"phone", nullableText(pharmacy, 0, "phone")},
        {"hours", nullableText(pharmacy, 0, "hours")},
    };
  }

  const PgResult health = connection.query(
      R"sql(
        select h.allergies,
               h.blood_type,
               h.insurance,
               d.display_name as primary_provider
        from public.patient_health_summaries h
        left join public.doctors d on d.id = h.primary_doctor_id
        where h.patient_id = $1::uuid
      )sql",
      {patientId});
  if (health.rows() > 0) {
    dashboard["healthSummary"] = {
        {"allergies", nullableText(health, 0, "allergies")},
        {"bloodType", nullableText(health, 0, "blood_type")},
        {"primaryCareProvider", nullableText(health, 0, "primary_provider")},
        {"insurance", nullableText(health, 0, "insurance")},
    };
  }

  return dashboard;
}

nlohmann::json PatientService::patientDashboard(
    const std::string& profileId) const {
  DatabaseConnection connection = database_.connect();
  const std::string patientId = requireRole(connection, profileId, "patient");
  return loadDashboard(connection, patientId);
}

nlohmann::json PatientService::assignedPatients(
    const std::string& doctorProfileId) const {
  DatabaseConnection connection = database_.connect();
  const std::string doctorId =
      requireRole(connection, doctorProfileId, "doctor");
  const PgResult patients = connection.query(
      R"sql(
        select p.id::text as id, p.display_name, p.date_of_birth::text as date_of_birth
        from public.doctor_patients assignment
        join public.patients p on p.id = assignment.patient_id
        where assignment.doctor_id = $1::uuid and assignment.active = true
        order by p.display_name
      )sql",
      {doctorId});

  json response = {{"patients", json::array()}};
  for (int row = 0; row < patients.rows(); ++row) {
    response["patients"].push_back({
        {"id", patients.value(row, "id")},
        {"displayName", patients.value(row, "display_name")},
        {"dateOfBirth", nullableText(patients, row, "date_of_birth")},
    });
  }
  return response;
}

nlohmann::json PatientService::doctorPatientDashboard(
    const std::string& doctorProfileId, const std::string& patientId) const {
  DatabaseConnection connection = database_.connect();
  requireAssignedPatient(connection, doctorProfileId, patientId);
  return loadDashboard(connection, patientId);
}

nlohmann::json PatientService::createPrescription(
    const std::string& doctorProfileId, const std::string& patientId,
    const nlohmann::json& input) const {
  const std::string medicationName = requiredText(input, "name", 160);
  const std::string dosage = requiredText(input, "dosage", 120);
  const std::string instructions = requiredText(input, "instructions", 500);
  const int refills = optionalRefills(input).value_or(0);

  DatabaseConnection connection = database_.connect();
  const std::string doctorId =
      requireAssignedPatient(connection, doctorProfileId, patientId);

  connection.begin();
  try {
    const PgResult medication = connection.query(
        R"sql(
          insert into public.medications (name)
          values ($1)
          on conflict (name) do update set name = excluded.name
          returning id::text as id
        )sql",
        {medicationName});
    const PgResult prescription = connection.query(
        R"sql(
          insert into public.prescriptions
            (patient_id, medication_id, prescribed_by, dosage, instructions,
             refills_remaining)
          values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::integer)
          returning id::text as id
        )sql",
        {patientId, medication.value(0, "id"), doctorId, dosage, instructions,
         std::to_string(refills)});

    const json metadata = {{"medicationName", medicationName}};
    connection.query(
        R"sql(
          insert into public.audit_logs
            (actor_profile_id, action, entity_type, entity_id, patient_id, metadata)
          values ($1::uuid, 'prescription.created', 'prescription', $2::uuid,
                  $3::uuid, $4::jsonb)
        )sql",
        {doctorProfileId, prescription.value(0, "id"), patientId,
         metadata.dump()});
    connection.commit();

    return {{"id", prescription.value(0, "id")}, {"status", "created"}};
  } catch (...) {
    connection.rollback();
    throw;
  }
}

nlohmann::json PatientService::updatePrescription(
    const std::string& doctorProfileId, const std::string& patientId,
    const std::string& prescriptionId, const nlohmann::json& input) const {
  const auto dosage = optionalText(input, "dosage", 120);
  const auto instructions = optionalText(input, "instructions", 500);
  const auto refills = optionalRefills(input);
  const auto status = optionalStatus(input);
  if (!dosage && !instructions && !refills && !status) {
    throw ApiError(400, "Provide at least one prescription field to update.");
  }

  DatabaseConnection connection = database_.connect();
  requireAssignedPatient(connection, doctorProfileId, patientId);

  connection.begin();
  try {
    const PgResult updated = connection.query(
        R"sql(
          update public.prescriptions
          set dosage = coalesce($3::text, dosage),
              instructions = coalesce($4::text, instructions),
              refills_remaining = coalesce($5::integer, refills_remaining),
              status = coalesce($6::text, status)
          where id = $1::uuid and patient_id = $2::uuid
          returning id::text as id
        )sql",
        {prescriptionId, patientId, dosage, instructions,
         refills ? std::optional<std::string>(std::to_string(*refills))
                 : std::nullopt,
         status});
    if (updated.rows() == 0) {
      throw ApiError(404, "Prescription not found.");
    }

    const json metadata = {
        {"changedFields",
         {dosage ? "dosage" : "", instructions ? "instructions" : "",
          refills ? "refillsRemaining" : "", status ? "status" : ""}}};
    connection.query(
        R"sql(
          insert into public.audit_logs
            (actor_profile_id, action, entity_type, entity_id, patient_id, metadata)
          values ($1::uuid, 'prescription.updated', 'prescription', $2::uuid,
                  $3::uuid, $4::jsonb)
        )sql",
        {doctorProfileId, prescriptionId, patientId, metadata.dump()});
    connection.commit();
    return {{"id", prescriptionId}, {"status", "updated"}};
  } catch (...) {
    connection.rollback();
    throw;
  }
}

