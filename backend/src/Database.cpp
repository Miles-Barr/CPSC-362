#include "Database.hpp"

#include <stdexcept>
#include <utility>

namespace {
void ensureResultSucceeded(PGconn* connection, PGresult* result) {
  if (result == nullptr) {
    throw std::runtime_error("PostgreSQL did not return a result");
  }

  const ExecStatusType status = PQresultStatus(result);
  if (status != PGRES_TUPLES_OK && status != PGRES_COMMAND_OK) {
    const std::string error = PQerrorMessage(connection);
    PQclear(result);
    throw std::runtime_error("PostgreSQL query failed: " + error);
  }
}
}  // namespace

PgResult::PgResult(PGresult* result) : result_(result) {}

PgResult::~PgResult() {
  if (result_ != nullptr) {
    PQclear(result_);
  }
}

PgResult::PgResult(PgResult&& other) noexcept : result_(other.result_) {
  other.result_ = nullptr;
}

PgResult& PgResult::operator=(PgResult&& other) noexcept {
  if (this != &other) {
    if (result_ != nullptr) {
      PQclear(result_);
    }
    result_ = other.result_;
    other.result_ = nullptr;
  }
  return *this;
}

int PgResult::rows() const { return PQntuples(result_); }

int PgResult::columnNumber(const char* column) const {
  const int number = PQfnumber(result_, column);
  if (number < 0) {
    throw std::runtime_error(std::string("Missing query column: ") + column);
  }
  return number;
}

bool PgResult::isNull(int row, const char* column) const {
  return PQgetisnull(result_, row, columnNumber(column)) != 0;
}

std::string PgResult::value(int row, const char* column) const {
  const int number = columnNumber(column);
  if (PQgetisnull(result_, row, number)) {
    throw std::runtime_error(std::string("Unexpected null column: ") + column);
  }
  return PQgetvalue(result_, row, number);
}

std::optional<std::string> PgResult::optionalValue(
    int row, const char* column) const {
  return isNull(row, column) ? std::nullopt
                             : std::optional<std::string>(value(row, column));
}

DatabaseConnection::DatabaseConnection(const std::string& connectionString)
    : connection_(PQconnectdb(connectionString.c_str())) {
  if (connection_ == nullptr || PQstatus(connection_) != CONNECTION_OK) {
    if (connection_ != nullptr) {
      PQfinish(connection_);
      connection_ = nullptr;
    }
    throw std::runtime_error("Unable to connect to PostgreSQL");
  }
}

DatabaseConnection::~DatabaseConnection() {
  if (connection_ != nullptr) {
    PQfinish(connection_);
  }
}

DatabaseConnection::DatabaseConnection(DatabaseConnection&& other) noexcept
    : connection_(other.connection_) {
  other.connection_ = nullptr;
}

DatabaseConnection& DatabaseConnection::operator=(
    DatabaseConnection&& other) noexcept {
  if (this != &other) {
    if (connection_ != nullptr) {
      PQfinish(connection_);
    }
    connection_ = other.connection_;
    other.connection_ = nullptr;
  }
  return *this;
}

PgResult DatabaseConnection::query(
    std::string_view sql, const SqlParameters& parameters) const {
  std::vector<const char*> values;
  values.reserve(parameters.size());
  for (const auto& parameter : parameters) {
    values.push_back(parameter ? parameter->c_str() : nullptr);
  }

  const std::string sqlText(sql);
  PGresult* result = PQexecParams(
      connection_, sqlText.c_str(), static_cast<int>(parameters.size()), nullptr,
      values.empty() ? nullptr : values.data(), nullptr, nullptr, 0);
  ensureResultSucceeded(connection_, result);
  return PgResult(result);
}

void DatabaseConnection::begin() const { query("begin"); }
void DatabaseConnection::commit() const { query("commit"); }

void DatabaseConnection::rollback() const noexcept {
  PGresult* result = PQexec(connection_, "rollback");
  if (result != nullptr) {
    PQclear(result);
  }
}

Database::Database(std::string connectionString)
    : connectionString_(std::move(connectionString)) {}

DatabaseConnection Database::connect() const {
  return DatabaseConnection(connectionString_);
}

