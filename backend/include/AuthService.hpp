#pragma once

#include <string>

struct AuthenticatedUser {
  std::string id;
};

class AuthService {
 public:
  AuthService(std::string supabaseUrl, std::string publishableKey);
  ~AuthService();

  AuthService(const AuthService&) = delete;
  AuthService& operator=(const AuthService&) = delete;

  [[nodiscard]] AuthenticatedUser authenticate(
      const std::string& authorizationHeader) const;

 private:
  std::string supabaseUrl_;
  std::string publishableKey_;
};

