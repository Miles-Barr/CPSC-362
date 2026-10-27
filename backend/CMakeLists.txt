cmake_minimum_required(VERSION 3.20)
project(fullerton_health_api LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG v0.58.0
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(httplib)

FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.12.0
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

find_package(PostgreSQL REQUIRED)
find_package(CURL REQUIRED)

add_executable(
  fullerton-health-api
  src/main.cpp
  src/AuthService.cpp
  src/Config.cpp
  src/Database.cpp
  src/PatientService.cpp
)

target_include_directories(fullerton-health-api PRIVATE include)
target_link_libraries(
  fullerton-health-api
  PRIVATE
    httplib::httplib
    nlohmann_json::nlohmann_json
    PostgreSQL::PostgreSQL
    CURL::libcurl
)

target_compile_options(fullerton-health-api PRIVATE -Wall -Wextra -Wpedantic)

