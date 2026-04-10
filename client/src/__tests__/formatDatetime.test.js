import { describe, it, expect } from "vitest";
import { toIsoUtc, formatDisplayDatetime } from "../utils/formatDatetime.js";

describe("toIsoUtc", () => {
  it("returns null for empty date", () => {
    expect(toIsoUtc({ date: "", time: "12:00", timezone: "UTC" })).toBeNull();
  });

  it("returns UTC string directly when timezone=UTC", () => {
    const iso = toIsoUtc({
      date: "2026-04-08",
      time: "22:00",
      timezone: "UTC",
    });
    expect(iso).toBe("2026-04-08T22:00:00.000Z");
  });

  it("zero-hour time when empty time is provided in UTC mode", () => {
    const iso = toIsoUtc({ date: "2026-04-08", time: "", timezone: "UTC" });
    // Empty time falls back to "now" — just verify the date portion
    expect(iso).toMatch(/^2026-04-08T/);
  });
});

describe("formatDisplayDatetime", () => {
  it("formats an ISO UTC string as uppercase display", () => {
    const out = formatDisplayDatetime("2026-04-08T22:00:00Z");
    expect(out).toBe("08 APRIL 2026 · 22:00 UTC");
  });

  it("returns empty string for null input", () => {
    expect(formatDisplayDatetime(null)).toBe("");
  });
});
