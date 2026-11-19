#include "AuthService.hpp"

#include "ApiError.hpp"

#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string_view>
#include <utility>

namespace {
size_t writeResponse(char* contents, size_t size, size_t count, void* output) {
  const size_t byteCount = size * count;
  static_cast<std::string*>(output)->append(contents, byteCount);
  return byteCount;
}

std::string extractBearerToken(const std::string& authorizationHeader) {
  constexpr std::string_view prefix = "Bearer ";
  if (!authorizationHeader.starts_with(prefix) ||
      authorizationHeader.size() == prefix.size()) {
    throw ApiError(401, "A valid sign-in session is required.");
  }
  return authorizationHeader.substr(prefix.size());
}
}  // namespace

AuthService::AuthService(std::string supabaseUrl, std::string publishableKey)
    : supabaseUrl_(std::move(supabaseUrl)),
      publishableKey_(std::move(publishableKey)) {
  if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) {
    throw std::runtime_error("Unable to initialize HTTPS client");
  }
}

AuthService::~AuthService() { curl_global_cleanup(); }

AuthenticatedUser AuthService::authenticate(
    const std::string& authorizationHeader) const {
  const std::string token = extractBearerToken(authorizationHeader);
  const std::string url = supabaseUrl_ + "/auth/v1/user";
  const std::string authorization = "Authorization: Bearer " + token;
  const std::string apiKey = "apikey: " + publishableKey_;
  std::string responseBody;

  CURL* curl = curl_easy_init();
  if (curl == nullptr) {
    throw std::runtime_error("Unable to create HTTPS request");
  }

  curl_slist* headers = nullptr;
  headers = curl_slist_append(headers, authorization.c_str());
  headers = curl_slist_append(headers, apiKey.c_str());
  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeResponse);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBody);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
  curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

  const CURLcode requestStatus = curl_easy_perform(curl);
  long httpStatus = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpStatus);
  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);

  if (requestStatus != CURLE_OK || httpStatus != 200) {
    throw ApiError(401, "The sign-in session is invalid or expired.");
  }

  try {
    const auto response = nlohmann::json::parse(responseBody);
    if (!response.contains("id") || !response["id"].is_string()) {
      throw ApiError(401, "The sign-in session is invalid.");
    }
    return {.id = response["id"].get<std::string>()};
  } catch (const nlohmann::json::exception&) {
    throw ApiError(401, "The authentication service returned an invalid response.");
  }
}

