import { describe, it, expect } from "vitest";
import { parsePagination } from "../../../src/utils/pagination.js";

describe("parsePagination", () => {
  it("returns 1/defaultLimit when params are missing", () => {
    expect(parsePagination({}, 20)).toEqual({ page: 1, limit: 20 });
  });

  it("falls back to defaults for non-numeric values", () => {
    expect(parsePagination({ page: "abc", limit: "xyz" }, 10)).toEqual({ page: 1, limit: 10 });
  });

  it("clamps out-of-range values into bounds", () => {
    expect(parsePagination({ page: "0", limit: "-5" }, 10)).toEqual({ page: 1, limit: 1 });
  });

  it("accepts valid page/limit values", () => {
    expect(parsePagination({ page: "3", limit: "50" }, 10)).toEqual({ page: 3, limit: 50 });
  });

  it("clamps limit to at most 100", () => {
    expect(parsePagination({ page: "1", limit: "10000" }, 10)).toEqual({ page: 1, limit: 100 });
  });

  it("floors page at 1", () => {
    expect(parsePagination({ page: "-3", limit: "20" }, 10)).toEqual({ page: 1, limit: 20 });
  });
});
