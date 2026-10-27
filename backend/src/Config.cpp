#include "Config.hpp"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <sstream>
#include <stdexcept>

namespace {
std::string requireEnvironmentVariable(const char* name) {
  const char* value = std::getenv(name);
  if (value == nullptr || std::string(value).empty()) {
    throw std::runtime_error(std::string("Missing required environment variable: ") + name);
  }
  return value;
}

std::vector<std::string> splitOrigins(const std::string& input) {
  std::vector<std::string> origins;
  std::stringstream stream(input);
  std::string origin;

  while (std::getline(stream, origin, ',')) {
    origin.erase(
        std::remove_if(origin.begin(), origin.end(),
                       [](unsigned char value) { return std::isspace(value); }),
        origin.end());
    if (!origin.empty()) {
      origins.push_back(origin);
    }
  }

  if (origins.empty()) {
    throw std::runtime_error("ALLOWED_ORIGINS must contain at least one origin");
  }
  return origins;
}

std::string requireEncryptedPostgres(std::string databaseUrl) {
  if (databaseUrl.find("sslmode=") == std::string::npos) {
    databaseUrl += databaseUrl.find('?') == std::string::npos
                       ? "?sslmode=require"
                       : "&sslmode=require";
  }
  return databaseUrl;
}
}  // namespace

Config Config::fromEnvironment() {
  Config config{
      .databaseUrl = requireEncryptedPostgres(requireEnvironmentVariable("DATABASE_URL")),
      .supabaseUrl = requireEnvironmentVariable("SUPABASE_URL"),
      .supabasePublishableKey =
          requireEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY"),
      .allowedOrigins =
          splitOrigins(requireEnvironmentVariable("ALLOWED_ORIGINS")),
      .port = 8080,
  };

  while (!config.supabaseUrl.empty() && config.supabaseUrl.back() == '/') {
    config.supabaseUrl.pop_back();
  }

  if (const char* port = std::getenv("PORT")) {
    config.port = std::stoi(port);
  }
  if (config.port < 1 || config.port > 65535) {
    throw std::runtime_error("PORT must be between 1 and 65535");
  }

  return config;
}

