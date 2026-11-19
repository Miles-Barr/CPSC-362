#pragma once

#include "Database.hpp"

#include <nlohmann/json.hpp>

#include <string>

class StaffService {
 public:
  explicit StaffService(const Database& database);

  [[nodiscard]] nlohmann::json dashboard(
      const std::string& staffProfileId) const;
  [[nodiscard]] nlohmann::json updatePatientAssignment(
      const std::string& staffProfileId, const std::string& patientId,
      const nlohmann::json& input) const;
  [[nodiscard]] nlohmann::json updateUserRole(
      const std::string& staffProfileId, const std::string& targetProfileId,
      const nlohmann::json& input) const;
  [[nodiscard]] nlohmann::json updateUserStatus(
      const std::string& staffProfileId, const std::string& targetProfileId,
      const nlohmann::json& input) const;

 private:
  const Database& database_;

  static void requireStaff(DatabaseConnection& connection,
                           const std::string& profileId);
};

