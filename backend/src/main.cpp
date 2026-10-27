#include "ApiError.hpp"
#include "AuthService.hpp"
#include "Config.hpp"
#include "Database.hpp"
#include "PatientService.hpp"

#include <httplib.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <functional>
#include <iostream>
#include <string>

namespace {
using nlohmann::json;

void addCorsHeaders(const httplib::Request& request, httplib::Response& response,
                    const Config& config) {
  const std::string origin = request.get_header_value("Origin");
  if (!origin.empty() &&
      std::find(config.allowedOrigins.begin(), config.allowedOrigins.end(), origin) !=
          config.allowedOrigins.end()) {
    response.set_header("Access-Control-Allow-Origin", origin);
    response.set_header("Vary", "Origin");
  }
  response.set_header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.set_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
}

void sendJson(httplib::Response& response, int status, const json& body) {
  response.status = status;
  response.set_content(body.dump(), "application/json");
  response.set_header("Cache-Control", "no-store");
}

json parseBody(const httplib::Request& request) {
  if (request.body.empty()) {
    throw ApiError(400, "A JSON request body is required.");
  }
  try {
    const json body = json::parse(request.body);
    if (!body.is_object()) {
      throw ApiError(400, "The request body must be a JSON object.");
    }
    return body;
  } catch (const json::parse_error&) {
    throw ApiError(400, "The request body is not valid JSON.");
  }
}

void authenticatedRequest(
    const httplib::Request& request, httplib::Response& response,
    const Config& config, const AuthService& auth,
    const std::function<json(const AuthenticatedUser&)>& operation,
    int successStatus = 200) {
  addCorsHeaders(request, response, config);
  try {
    const AuthenticatedUser user =
        auth.authenticate(request.get_header_value("Authorization"));
    sendJson(response, successStatus, operation(user));
  } catch (const ApiError& error) {
    sendJson(response, error.status(), {{"error", error.what()}});
  } catch (const std::exception& error) {
    std::cerr << "Unhandled API error: " << error.what() << '\n';
    sendJson(response, 500, {{"error", "The server could not complete the request."}});
  }
}
}  // namespace

int main() {
  try {
    const Config config = Config::fromEnvironment();
    const Database database(config.databaseUrl);
    const AuthService auth(config.supabaseUrl, config.supabasePublishableKey);
    const PatientService patients(database);
    httplib::Server server;

    server.Options(R"(/.*)", [&](const httplib::Request& request,
                                  httplib::Response& response) {
      addCorsHeaders(request, response, config);
      response.status = 204;
    });

    server.Get("/health", [&](const httplib::Request& request,
                              httplib::Response& response) {
      addCorsHeaders(request, response, config);
      sendJson(response, 200, {{"status", "ok"}, {"service", "fullerton-health-api"}});
    });

    server.Get("/api/patients/me/dashboard",
               [&](const httplib::Request& request, httplib::Response& response) {
      authenticatedRequest(
          request, response, config, auth,
          [&](const AuthenticatedUser& user) {
            return patients.patientDashboard(user.id);
          });
    });

    server.Get("/api/doctor/patients",
               [&](const httplib::Request& request, httplib::Response& response) {
      authenticatedRequest(
          request, response, config, auth,
          [&](const AuthenticatedUser& user) {
            return patients.assignedPatients(user.id);
          });
    });

    server.Get(
        R"(/api/doctor/patients/([0-9a-fA-F-]+)/dashboard)",
        [&](const httplib::Request& request, httplib::Response& response) {
          const std::string patientId = request.matches[1];
          authenticatedRequest(
              request, response, config, auth,
              [&](const AuthenticatedUser& user) {
                return patients.doctorPatientDashboard(user.id, patientId);
              });
        });

    server.Post(
        R"(/api/doctor/patients/([0-9a-fA-F-]+)/prescriptions)",
        [&](const httplib::Request& request, httplib::Response& response) {
          const std::string patientId = request.matches[1];
          authenticatedRequest(
              request, response, config, auth,
              [&](const AuthenticatedUser& user) {
                return patients.createPrescription(user.id, patientId,
                                                   parseBody(request));
              },
              201);
        });

    server.Patch(
        R"(/api/doctor/patients/([0-9a-fA-F-]+)/prescriptions/([0-9a-fA-F-]+))",
        [&](const httplib::Request& request, httplib::Response& response) {
          const std::string patientId = request.matches[1];
          const std::string prescriptionId = request.matches[2];
          authenticatedRequest(
              request, response, config, auth,
              [&](const AuthenticatedUser& user) {
                return patients.updatePrescription(
                    user.id, patientId, prescriptionId, parseBody(request));
              });
        });

    server.set_error_handler([&](const httplib::Request& request,
                                 httplib::Response& response) {
      addCorsHeaders(request, response, config);
      if (response.status == 404) {
        sendJson(response, 404, {{"error", "API route not found."}});
      }
    });

    std::cout << "Fullerton Health API listening on port " << config.port << '\n';
    if (!server.listen("0.0.0.0", config.port)) {
      std::cerr << "Unable to start the API server\n";
      return 1;
    }
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "API startup failed: " << error.what() << '\n';
    return 1;
  }
}

