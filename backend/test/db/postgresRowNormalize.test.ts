import { describe, it, expect } from "vitest";
import { dateToTimestampString, normalizeRowDates, normalizeRowDatesAll } from "../../src/db/postgres-row-normalize.js";

describe("dateToTimestampString", () => {
  it("formats a Date as UTC wall-clock YYYY-MM-DD HH:MM:SS.mmm", () => {
    // 2026-07-07T23:59:59.999Z
    const d = new Date(Date.UTC(2026, 6, 7, 23, 59, 59, 999));
    expect(dateToTimestampString(d)).toBe("2026-07-07 23:59:59.999");
  });

  it("zero-pads single-digit months, days, hours and sub-second widths", () => {
    // 2026-01-05T03:04:05.007Z
    const d = new Date(Date.UTC(2026, 0, 5, 3, 4, 5, 7));
    expect(dateToTimestampString(d)).toBe("2026-01-05 03:04:05.007");
    // 2026-12-31T00:00:00.000Z
    const d2 = new Date(Date.UTC(2026, 11, 31, 0, 0, 0, 0));
    expect(dateToTimestampString(d2)).toBe("2026-12-31 00:00:00.000");
  });
});

describe("normalizeRowDates", () => {
  it("converts Date values to the TEXT timestamp contract", () => {
    const row = {
      id: 1,
      start_date: new Date(Date.UTC(2026, 6, 7, 0, 0, 0, 0)),
      end_date: new Date(Date.UTC(2026, 6, 7, 23, 59, 59, 999)),
    };
    const out = normalizeRowDates(row);
    expect(out.start_date).toBe("2026-07-07 00:00:00.000");
    expect(out.end_date).toBe("2026-07-07 23:59:59.999");
    expect(typeof out.start_date).toBe("string");
  });

  it("leaves non-Date values untouched (strings, numbers, booleans, null, undefined)", () => {
    const row = {
      name: "Café Especial",
      price: 15.5,
      active: true,
      note: null as string | null,
      missing: undefined as string | undefined,
      status: "active",
    };
    const out = normalizeRowDates(row);
    expect(out).toEqual(row);
    expect(out.note).toBeNull();
    expect("missing" in out).toBe(true);
  });

  it("keeps other object values as-is (only Date instances are converted)", () => {
    const nested = { inner: "x" };
    const out = normalizeRowDates({ nested });
    expect(out.nested).toBe(nested);
  });

  it("does not mutate the input row", () => {
    const d = new Date(Date.UTC(2026, 6, 7));
    const row = { id: 1, created_at: d };
    normalizeRowDates(row);
    expect(row.created_at).toBe(d);
    expect(row.created_at instanceof Date).toBe(true);
  });
});

describe("normalizeRowDatesAll", () => {
  it("maps every row and preserves order", () => {
    const rows = [
      { id: 1, created_at: new Date(Date.UTC(2026, 0, 1, 5, 0, 0, 123)) },
      { id: 2, created_at: "2026-02-01 10:00:00.000" },
      { id: 3, created_at: null },
    ];
    const out = normalizeRowDatesAll(rows);
    expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(out[0].created_at).toBe("2026-01-01 05:00:00.123");
    expect(out[1].created_at).toBe("2026-02-01 10:00:00.000");
    expect(out[2].created_at).toBeNull();
  });

  it("returns an empty array for no rows", () => {
    expect(normalizeRowDatesAll([])).toEqual([]);
  });
});
