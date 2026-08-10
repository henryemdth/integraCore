import { describe, it, expect } from "vitest";
import {
  convertDatetimeFunctions,
  addReturningIfNeeded,
} from "../../src/db/postgres-query-transform.js";

describe("convertDatetimeFunctions", () => {
  it("converts datetime('now') to NOW()", () => {
    expect(convertDatetimeFunctions("SELECT datetime('now')")).toBe("SELECT NOW()");
  });

  it("does not touch datetime('now', ...) forms", () => {
    const sql = "SELECT datetime('now', '-' || ? || ' days')";
    expect(convertDatetimeFunctions(sql)).toBe(
      "SELECT (NOW() - ($1::int * interval '1 day'))"
    );
  });

  it("numbers remaining placeholders after the DAYS_PARAM marker", () => {
    const sql =
      "SELECT * FROM sales WHERE created_at >= datetime('now', '-' || ? || ' days') AND id = ?";
    expect(convertDatetimeFunctions(sql)).toBe(
      "SELECT * FROM sales WHERE created_at >= (NOW() - ($1::int * interval '1 day')) AND id = $2"
    );
  });

  it("converts date('now') to CURRENT_DATE", () => {
    expect(convertDatetimeFunctions("SELECT date('now')")).toBe("SELECT CURRENT_DATE");
  });

  it("converts strftime('%Y-%m', 'now') to TO_CHAR(CURRENT_DATE, 'YYYY-MM')", () => {
    expect(convertDatetimeFunctions("SELECT strftime('%Y-%m', 'now')")).toBe(
      "SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM')"
    );
  });

  it("converts strftime('%Y-%m', column) to TO_CHAR(column, 'YYYY-MM')", () => {
    expect(convertDatetimeFunctions("SELECT strftime('%Y-%m', created_at) FROM sales")).toBe(
      "SELECT TO_CHAR(created_at, 'YYYY-MM') FROM sales"
    );
  });

  it("converts ? placeholders to $N sequentially", () => {
    expect(convertDatetimeFunctions("SELECT * FROM products WHERE id = ? AND price > ?")).toBe(
      "SELECT * FROM products WHERE id = $1 AND price > $2"
    );
  });

  it("does not convert placeholders inside string literals", () => {
    expect(convertDatetimeFunctions("SELECT * FROM products WHERE name = 'What?'")).toBe(
      "SELECT * FROM products WHERE name = 'What?'"
    );
  });

  it("handles combined transforms in one statement", () => {
    const sql =
      "SELECT strftime('%Y-%m', created_at) AS m, datetime('now') AS now FROM sales WHERE created_at > datetime('now', '-' || ? || ' days') AND user_id = ?";
    expect(convertDatetimeFunctions(sql)).toBe(
      "SELECT TO_CHAR(created_at, 'YYYY-MM') AS m, NOW() AS now FROM sales WHERE created_at > (NOW() - ($1::int * interval '1 day')) AND user_id = $2"
    );
  });
});

describe("addReturningIfNeeded", () => {
  it("appends RETURNING id to plain INSERT", () => {
    expect(addReturningIfNeeded("INSERT INTO users (username) VALUES (?)")).toBe(
      "INSERT INTO users (username) VALUES (?) RETURNING id"
    );
  });

  it("leaves INSERT ... RETURNING unchanged", () => {
    const sql = "INSERT INTO users (username) VALUES (?) RETURNING id";
    expect(addReturningIfNeeded(sql)).toBe(sql);
  });

  it("leaves non-INSERT statements unchanged", () => {
    const sql = "UPDATE users SET active = ? WHERE id = ?";
    expect(addReturningIfNeeded(sql)).toBe(sql);
  });
});
