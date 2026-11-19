#pragma once

#include <libpq-fe.h>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

using SqlParameters = std::vector<std::optional<std::string>>;

class PgResult {
 public:
  explicit PgResult(PGresult* result);
  ~PgResult();

  PgResult(const PgResult&) = delete;
  PgResult& operator=(const PgResult&) = delete;
  PgResult(PgResult&& other) noexcept;
  PgResult& operator=(PgResult&& other) noexcept;

  [[nodiscard]] int rows() const;
  [[nodiscard]] bool isNull(int row, const char* column) const;
  [[nodiscard]] std::string value(int row, const char* column) const;
  [[nodiscard]] std::optional<std::string> optionalValue(
      int row, const char* column) const;

 private:
  int columnNumber(const char* column) const;
  PGresult* result_;
};

class DatabaseConnection {
 public:
  explicit DatabaseConnection(const std::string& connectionString);
  ~DatabaseConnection();

  DatabaseConnection(const DatabaseConnection&) = delete;
  DatabaseConnection& operator=(const DatabaseConnection&) = delete;
  DatabaseConnection(DatabaseConnection&& other) noexcept;
  DatabaseConnection& operator=(DatabaseConnection&& other) noexcept;

  PgResult query(std::string_view sql,
                 const SqlParameters& parameters = {}) const;
  void begin() const;
  void commit() const;
  void rollback() const noexcept;

 private:
  PGconn* connection_;
};

class Database {
 public:
  explicit Database(std::string connectionString);
  [[nodiscard]] DatabaseConnection connect() const;

 private:
  std::string connectionString_;
};

