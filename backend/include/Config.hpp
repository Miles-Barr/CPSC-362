#pragma once

#include <string>
#include <vector>

struct Config {
  std::string databaseUrl;
  std::string supabaseUrl;
  std::string supabasePublishableKey;
  std::vector<std::string> allowedOrigins;
  int port;

  static Config fromEnvironment();
};

