#pragma once

#include <stdexcept>
#include <string>
#include <utility>

// ApiError carries a safe HTTP status and message back to the route layer.
// Internal database and network details are never sent to the browser.
class ApiError : public std::runtime_error {
 public:
  ApiError(int status, std::string message)
      : std::runtime_error(std::move(message)), status_(status) {}

  [[nodiscard]] int status() const noexcept { return status_; }

 private:
  int status_;
};

