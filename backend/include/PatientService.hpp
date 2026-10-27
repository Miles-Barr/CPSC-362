#pragma once

#include "Database.hpp"

#include <nlohmann/json.hpp>

#include <string>

class PatientService {
 public:
  explicit PatientService(const Database& database);

  [[nodiscard]] nlohmann::json patientDashboard(
      const std::string& profileId) const;
  [[nodiscard]] nlohmann::json assignedPatients(
      const std::string& doctorProfileId) const;
  [[nodiscard]] nlohmann::json doctorPatientDashboard(
      const std::string& doctorProfileId,
      const std::string& patientId) const;
  [[nodiscard]] nlohmann::json createPrescription(
      const std::string& doctorProfileId, const std::string& patientId,
      const nlohmann::json& input) const;
  [[nodiscard]] nlohmann::json updatePrescription(
      const std::string& doctorProfileId, const std::string& patientId,
      const std::string& prescriptionId, const nlohmann::json& input) const;

 private:
  const Database& database_;

  static std::string requireRole(DatabaseConnection& connection,
                                 const std::string& profileId,
                                 const std::string& expectedRole);
  static std::string requireAssignedPatient(
      DatabaseConnection& connection, const std::string& doctorProfileId,
      const std::string& patientId);
  static nlohmann::json loadDashboard(DatabaseConnection& connection,
                                      const std::string& patientId);
};

