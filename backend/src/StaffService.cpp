#include "StaffService.hpp"

#include "ApiError.hpp"

#include <optional>
#include <regex>
#include <string>

namespace {
using nlohmann::json;

json nullableText(const PgResult& result, int row, const char* column) {
  const auto value = result.optionalValue(row, column);
  return value ? json(*value) : json(nullptr);
}

bool databaseBoolean(const PgResult& result, int row, const char* column) {
  const std::string value = result.value(row, column);
  return value == "t" || value == "true" || value == "1";
}

void requireUuid(const std::string& value, const char* field) {
  static const std::regex uuidPattern(
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
      "[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
  if (!std::regex_match(value, uuidPattern)) {
    throw ApiError(400, std::string(field) + " is not a valid UUID.");
  }
}

std::string requiredRole(const json& input) {
  if (!input.contains("role") || !input["role"].is_string()) {
    throw ApiError(400, "role is required.");
  }
  const std::string role = input["role"].get<std::string>();
  if (role != "patient" && role != "doctor") {
    throw ApiError(400, "role must be patient or doctor.");
  }
  return role;
}

bool requiredActive(const json& input) {
  if (!input.contains("active") || !input["active"].is_boolean()) {
    throw ApiError(400, "active must be true or false.");
  }
  return input["active"].get<bool>();
}

std::optional<std::string> requestedDoctorId(const json& input) {
  if (!input.contains("doctorId")) {
    throw ApiError(400, "doctorId is required and may be null to unassign.");
  }
  if (input["doctorId"].is_null()) {
    return std::nullopt;
  }
  if (!input["doctorId"].is_string()) {
    throw ApiError(400, "doctorId must be a UUID or null.");
  }
  const std::string doctorId = input["doctorId"].get<std::string>();
  requireUuid(doctorId, "doctorId");
  return doctorId;
}
}  // namespace

StaffService::StaffService(const Database& database) : database_(database) {}

void StaffService::requireStaff(DatabaseConnection& connection,
                                const std::string& profileId) {
  const PgResult staff = connection.query(
      R"sql(
        select 1
        from public.profiles
        where id = $1::uuid and role = 'staff' and active = true
      )sql",
      {profileId});
  if (staff.rows() == 0) {
    throw ApiError(403, "A currently active staff account is required.");
  }
}

nlohmann::json StaffService::dashboard(
    const std::string& staffProfileId) const {
  DatabaseConnection connection = database_.connect();
  requireStaff(connection, staffProfileId);

  json response = {
      {"summary",
       {{"totalUsers", 0}, {"activeDoctors", 0}, {"unassignedPatients", 0}}},
      {"users", json::array()},
      {"doctors", json::array()},
      {"patients", json::array()},
      {"auditLogs", json::array()},
  };

  const PgResult users = connection.query(
      R"sql(
        select id::text as id, username, role, active::text as active
        from public.profiles
        order by lower(username), id
      )sql");
  for (int row = 0; row < users.rows(); ++row) {
    response["users"].push_back({
        {"id", users.value(row, "id")},
        {"username", users.value(row, "username")},
        {"role", users.value(row, "role")},
        {"active", databaseBoolean(users, row, "active")},
        {"isCurrentUser", users.value(row, "id") == staffProfileId},
    });
  }
  response["summary"]["totalUsers"] = users.rows();

  const PgResult doctors = connection.query(
      R"sql(
        select d.id::text as id,
               d.profile_id::text as profile_id,
               d.display_name,
               d.specialty,
               profile.active::text as active,
               count(assignment.patient_id)
                 filter (where assignment.active = true)::text as patient_count
        from public.doctors d
        join public.profiles profile on profile.id = d.profile_id
        left join public.doctor_patients assignment on assignment.doctor_id = d.id
        where profile.role = 'doctor'
        group by d.id, d.profile_id, d.display_name, d.specialty, profile.active
        order by profile.active desc, lower(d.display_name)
      )sql");
  int activeDoctorCount = 0;
  for (int row = 0; row < doctors.rows(); ++row) {
    const bool active = databaseBoolean(doctors, row, "active");
    if (active) {
      ++activeDoctorCount;
    }
    response["doctors"].push_back({
        {"id", doctors.value(row, "id")},
        {"profileId", doctors.value(row, "profile_id")},
        {"displayName", doctors.value(row, "display_name")},
        {"specialty", nullableText(doctors, row, "specialty")},
        {"active", active},
        {"assignedPatientCount",
         std::stoi(doctors.value(row, "patient_count"))},
    });
  }
  response["summary"]["activeDoctors"] = activeDoctorCount;

  const PgResult patients = connection.query(
      R"sql(
        select patient.id::text as id,
               patient.profile_id::text as profile_id,
               patient.display_name,
               patient.date_of_birth::text as date_of_birth,
               profile.active::text as account_active,
               assigned_doctor.id::text as doctor_id,
               assigned_doctor.display_name as doctor_name
        from public.patients patient
        join public.profiles profile on profile.id = patient.profile_id
        left join lateral (
          select doctor.id, doctor.display_name
          from public.doctor_patients assignment
          join public.doctors doctor on doctor.id = assignment.doctor_id
          join public.profiles doctor_profile
            on doctor_profile.id = doctor.profile_id
          where assignment.patient_id = patient.id
            and assignment.active = true
            and doctor_profile.role = 'doctor'
            and doctor_profile.active = true
          order by assignment.assigned_at desc
          limit 1
        ) assigned_doctor on true
        where profile.role = 'patient'
        order by profile.active desc, lower(patient.display_name)
      )sql");
  int unassignedPatientCount = 0;
  for (int row = 0; row < patients.rows(); ++row) {
    const bool active = databaseBoolean(patients, row, "account_active");
    const bool assigned = !patients.isNull(row, "doctor_id");
    if (active && !assigned) {
      ++unassignedPatientCount;
    }
    response["patients"].push_back({
        {"id", patients.value(row, "id")},
        {"profileId", patients.value(row, "profile_id")},
        {"displayName", patients.value(row, "display_name")},
        {"dateOfBirth", nullableText(patients, row, "date_of_birth")},
        {"accountActive", active},
        {"assignedDoctor",
         assigned ? json{{"id", patients.value(row, "doctor_id")},
                         {"displayName", patients.value(row, "doctor_name")}}
                  : json(nullptr)},
    });
  }
  response["summary"]["unassignedPatients"] = unassignedPatientCount;

  const PgResult logs = connection.query(
      R"sql(
        select log.id::text as id,
               log.action,
               log.entity_type,
               log.metadata::text as metadata,
               log.occurred_at::text as occurred_at,
               coalesce(actor.username, 'System') as actor_username,
               patient.display_name as patient_name
        from public.audit_logs log
        left join public.profiles actor on actor.id = log.actor_profile_id
        left join public.patients patient on patient.id = log.patient_id
        where log.action like 'assignment.%'
           or log.action like 'profile.%'
        order by log.occurred_at desc
        limit 50
      )sql");
  for (int row = 0; row < logs.rows(); ++row) {
    response["auditLogs"].push_back({
        {"id", logs.value(row, "id")},
        {"action", logs.value(row, "action")},
        {"entityType", logs.value(row, "entity_type")},
        {"actorUsername", logs.value(row, "actor_username")},
        {"patientName", nullableText(logs, row, "patient_name")},
        {"metadata", json::parse(logs.value(row, "metadata"))},
        {"occurredAt", logs.value(row, "occurred_at")},
    });
  }

  return response;
}

nlohmann::json StaffService::updatePatientAssignment(
    const std::string& staffProfileId, const std::string& patientId,
    const nlohmann::json& input) const {
  requireUuid(patientId, "patientId");
  const auto doctorId = requestedDoctorId(input);
  DatabaseConnection connection = database_.connect();
  requireStaff(connection, staffProfileId);

  connection.begin();
  try {
    const PgResult patient = connection.query(
        R"sql(
          select patient.display_name
          from public.patients patient
          join public.profiles profile on profile.id = patient.profile_id
          where patient.id = $1::uuid
            and profile.role = 'patient'
            and profile.active = true
          for update of patient
        )sql",
        {patientId});
    if (patient.rows() == 0) {
      throw ApiError(404, "An active patient account was not found.");
    }

    const PgResult current = connection.query(
        R"sql(
          select doctor.id::text as id, doctor.display_name
          from public.doctor_patients assignment
          join public.doctors doctor on doctor.id = assignment.doctor_id
          where assignment.patient_id = $1::uuid and assignment.active = true
          order by assignment.assigned_at desc
          limit 1
        )sql",
        {patientId});
    const std::optional<std::string> previousDoctorId =
        current.rows() > 0
            ? std::optional<std::string>(current.value(0, "id"))
            : std::nullopt;

    if (!doctorId) {
      if (!previousDoctorId) {
        connection.commit();
        return {{"status", "unchanged"}};
      }
      connection.query(
          "update public.doctor_patients set active = false "
          "where patient_id = $1::uuid and active = true",
          {patientId});
      connection.query(
          "update public.patient_health_summaries set primary_doctor_id = null "
          "where patient_id = $1::uuid",
          {patientId});
      const json metadata = {
          {"patientName", patient.value(0, "display_name")},
          {"previousDoctorId", *previousDoctorId},
          {"previousDoctorName", current.value(0, "display_name")},
      };
      connection.query(
          R"sql(
            insert into public.audit_logs
              (actor_profile_id, action, entity_type, entity_id, patient_id,
               metadata)
            values ($1::uuid, 'assignment.removed', 'doctor_patient_assignment',
                    $2::uuid, $2::uuid, $3::jsonb)
          )sql",
          {staffProfileId, patientId, metadata.dump()});
      connection.commit();
      return {{"status", "unassigned"}};
    }

    const PgResult doctor = connection.query(
        R"sql(
          select doctor.display_name
          from public.doctors doctor
          join public.profiles profile on profile.id = doctor.profile_id
          where doctor.id = $1::uuid
            and profile.role = 'doctor'
            and profile.active = true
        )sql",
        {*doctorId});
    if (doctor.rows() == 0) {
      throw ApiError(404, "An active doctor account was not found.");
    }
    if (previousDoctorId && *previousDoctorId == *doctorId) {
      connection.commit();
      return {{"status", "unchanged"}};
    }

    connection.query(
        "update public.doctor_patients set active = false "
        "where patient_id = $1::uuid and active = true",
        {patientId});
    connection.query(
        R"sql(
          insert into public.doctor_patients
            (doctor_id, patient_id, active, assigned_at)
          values ($1::uuid, $2::uuid, true, now())
          on conflict (doctor_id, patient_id)
          do update set active = true, assigned_at = now()
        )sql",
        {*doctorId, patientId});
    connection.query(
        R"sql(
          insert into public.patient_health_summaries
            (patient_id, primary_doctor_id)
          values ($1::uuid, $2::uuid)
          on conflict (patient_id)
          do update set primary_doctor_id = excluded.primary_doctor_id
        )sql",
        {patientId, *doctorId});

    json metadata = {
        {"patientName", patient.value(0, "display_name")},
        {"doctorId", *doctorId},
        {"doctorName", doctor.value(0, "display_name")},
    };
    if (previousDoctorId) {
      metadata["previousDoctorId"] = *previousDoctorId;
      metadata["previousDoctorName"] = current.value(0, "display_name");
    }
    const std::string action =
        previousDoctorId ? "assignment.reassigned" : "assignment.created";
    connection.query(
        R"sql(
          insert into public.audit_logs
            (actor_profile_id, action, entity_type, entity_id, patient_id,
             metadata)
          values ($1::uuid, $2, 'doctor_patient_assignment', $3::uuid,
                  $3::uuid, $4::jsonb)
        )sql",
        {staffProfileId, action, patientId, metadata.dump()});
    connection.commit();
    return {{"status", previousDoctorId ? "reassigned" : "assigned"}};
  } catch (...) {
    connection.rollback();
    throw;
  }
}

nlohmann::json StaffService::updateUserRole(
    const std::string& staffProfileId, const std::string& targetProfileId,
    const nlohmann::json& input) const {
  requireUuid(targetProfileId, "profileId");
  const std::string newRole = requiredRole(input);
  if (targetProfileId == staffProfileId) {
    throw ApiError(400, "Staff members cannot change their own role.");
  }

  DatabaseConnection connection = database_.connect();
  requireStaff(connection, staffProfileId);
  connection.begin();
  try {
    const PgResult target = connection.query(
        R"sql(
          select username, role
          from public.profiles
          where id = $1::uuid
          for update
        )sql",
        {targetProfileId});
    if (target.rows() == 0) {
      throw ApiError(404, "User account not found.");
    }
    const std::string oldRole = target.value(0, "role");
    if (oldRole == "staff") {
      throw ApiError(400, "Staff roles cannot be changed from this screen.");
    }
    if (oldRole != "patient" && oldRole != "doctor") {
      throw ApiError(409, "This account has an unsupported role.");
    }
    if (oldRole == newRole) {
      connection.commit();
      return {{"status", "unchanged"}};
    }

    if (oldRole == "doctor") {
      connection.query(
          R"sql(
            update public.doctor_patients assignment
            set active = false
            from public.doctors doctor
            where assignment.doctor_id = doctor.id
              and doctor.profile_id = $1::uuid
              and assignment.active = true
          )sql",
          {targetProfileId});
      connection.query(
          R"sql(
            update public.patient_health_summaries summary
            set primary_doctor_id = null
            from public.doctors doctor
            where summary.primary_doctor_id = doctor.id
              and doctor.profile_id = $1::uuid
          )sql",
          {targetProfileId});
    }

    connection.query(
        "update public.profiles set role = $2 where id = $1::uuid",
        {targetProfileId, newRole});
    const json metadata = {
        {"username", target.value(0, "username")},
        {"oldRole", oldRole},
        {"newRole", newRole},
    };
    connection.query(
        R"sql(
          insert into public.audit_logs
            (actor_profile_id, action, entity_type, entity_id, metadata)
          values ($1::uuid, 'profile.role_changed', 'profile', $2::uuid,
                  $3::jsonb)
        )sql",
        {staffProfileId, targetProfileId, metadata.dump()});
    connection.commit();
    return {{"status", "updated"}, {"role", newRole}};
  } catch (...) {
    connection.rollback();
    throw;
  }
}

nlohmann::json StaffService::updateUserStatus(
    const std::string& staffProfileId, const std::string& targetProfileId,
    const nlohmann::json& input) const {
  requireUuid(targetProfileId, "profileId");
  const bool active = requiredActive(input);
  if (targetProfileId == staffProfileId) {
    throw ApiError(400, "Staff members cannot deactivate their own account.");
  }

  DatabaseConnection connection = database_.connect();
  requireStaff(connection, staffProfileId);
  connection.begin();
  try {
    const PgResult target = connection.query(
        R"sql(
          select username, role, active::text as active
          from public.profiles
          where id = $1::uuid
          for update
        )sql",
        {targetProfileId});
    if (target.rows() == 0) {
      throw ApiError(404, "User account not found.");
    }
    const bool oldActive = databaseBoolean(target, 0, "active");
    if (oldActive == active) {
      connection.commit();
      return {{"status", "unchanged"}};
    }

    if (!active && target.value(0, "role") == "doctor") {
      connection.query(
          R"sql(
            update public.doctor_patients assignment
            set active = false
            from public.doctors doctor
            where assignment.doctor_id = doctor.id
              and doctor.profile_id = $1::uuid
              and assignment.active = true
          )sql",
          {targetProfileId});
      connection.query(
          R"sql(
            update public.patient_health_summaries summary
            set primary_doctor_id = null
            from public.doctors doctor
            where summary.primary_doctor_id = doctor.id
              and doctor.profile_id = $1::uuid
          )sql",
          {targetProfileId});
    }

    connection.query(
        "update public.profiles set active = $2::boolean where id = $1::uuid",
        {targetProfileId, active ? "true" : "false"});
    const json metadata = {
        {"username", target.value(0, "username")},
        {"role", target.value(0, "role")},
        {"oldActive", oldActive},
        {"newActive", active},
    };
    connection.query(
        R"sql(
          insert into public.audit_logs
            (actor_profile_id, action, entity_type, entity_id, metadata)
          values ($1::uuid, 'profile.status_changed', 'profile', $2::uuid,
                  $3::jsonb)
        )sql",
        {staffProfileId, targetProfileId, metadata.dump()});
    connection.commit();
    return {{"status", "updated"}, {"active", active}};
  } catch (...) {
    connection.rollback();
    throw;
  }
}

