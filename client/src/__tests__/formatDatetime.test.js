import { describe, it, expect } from "vitest";
import {
  toIsoUtc,
  formatDisplayDatetime,
  isSupportedDate,
  DATE_MIN,
  DATE_MAX,
} from "../utils/formatDatetime.js";

// 2026-09-30 19:59:13 in New York (the test runner's zone), 23:59:13 UTC,
// already 2026-10-01 08:59:13 in Tokyo.
const NOW = new Date("2026-09-30T23:59:13Z");

describe("toIsoUtc", () => {
  it("returns null for empty date", () => {
    expect(toIsoUtc({ date: "", time: "12:00", timezone: "UTC" })).toBeNull();
  });

  it("returns UTC string directly when timezone=UTC", () => {
    const iso = toIsoUtc({ date: "2026-04-08", time: "22:00", timezone: "UTC" });
    expect(iso).toBe("2026-04-08T22:00:00.000Z");
  });

  it("UTC mode with no time uses the current UTC clock, not the local one", () => {
    // Regression: used getHours() (local), so New York got 19:59 UTC.
    const iso = toIsoUtc({ date: "2026-09-30", time: "", timezone: "UTC", now: NOW });
    expect(iso).toBe("2026-09-30T23:59:00.000Z");
  });

  it("Local mode interprets the time in the observed place's zone", () => {
    // Someone in New York asking for 22:00 in Tokyo gets Tokyo's 22:00.
    const iso = toIsoUtc({
      date: "2026-04-08", time: "22:00", timezone: "Local", zone: "Asia/Tokyo",
    });
    expect(iso).toBe("2026-04-08T13:00:00.000Z");
  });

  it("Local mode follows the place's DST rules", () => {
    const summer = { date: "2026-07-04", time: "21:00", timezone: "Local", zone: "America/Denver" };
    const winter = { ...summer, date: "2026-01-15" };
    expect(toIsoUtc(summer)).toBe("2026-07-05T03:00:00.000Z"); // MDT, UTC-6
    expect(toIsoUtc(winter)).toBe("2026-01-16T04:00:00.000Z"); // MST, UTC-7
  });

  it("a wall time inside a spring-forward gap moves forward an hour", () => {
    // 02:30 does not exist in New York on 2026-03-08; it reads as 03:30 EDT.
    const iso = toIsoUtc({
      date: "2026-03-08", time: "02:30", timezone: "Local", zone: "America/New_York",
    });
    expect(iso).toBe("2026-03-08T07:30:00.000Z");
  });

  it("an ambiguous fall-back wall time takes the first occurrence", () => {
    // 01:30 happens twice in New York on 2026-11-01; the first is EDT.
    const iso = toIsoUtc({
      date: "2026-11-01", time: "01:30", timezone: "Local", zone: "America/New_York",
    });
    expect(iso).toBe("2026-11-01T05:30:00.000Z");
  });

  // East of UTC the DST transitions run the other way round in UTC terms;
  // the first implementation only got negative-offset zones right.
  it.each([
    ["Europe/Berlin gap (02:30 doesn't exist, reads as 03:30 CEST)", "2026-03-29", "Europe/Berlin", "2026-03-29T01:30:00.000Z"],
    ["Europe/Berlin overlap (first 02:30 is CEST)", "2026-10-25", "Europe/Berlin", "2026-10-25T00:30:00.000Z"],
    ["Australia/Sydney gap (reads as 03:30 AEDT)", "2026-10-04", "Australia/Sydney", "2026-10-03T16:30:00.000Z"],
    ["Australia/Sydney overlap (first 02:30 is AEDT)", "2026-04-05", "Australia/Sydney", "2026-04-04T15:30:00.000Z"],
  ])("DST east of UTC: %s", (_label, date, zone, expected) => {
    expect(toIsoUtc({ date, time: "02:30", timezone: "Local", zone })).toBe(expected);
  });

  it("Local mode with no time uses the current clock in the place's zone", () => {
    const iso = toIsoUtc({
      date: "2026-09-30", time: "", timezone: "Local", zone: "Asia/Tokyo", now: NOW,
    });
    // Tokyo's clock reads 08:59; on the chosen date that is 2026-09-29 23:59 UTC.
    expect(iso).toBe("2026-09-29T23:59:00.000Z");
  });

  it("Local mode without a known zone falls back to the browser's zone", () => {
    const iso = toIsoUtc({ date: "2026-01-15", time: "21:00", timezone: "Local" });
    expect(iso).toBe("2026-01-16T02:00:00.000Z");
  });

  it("an unknown zone name falls back to the browser's zone instead of throwing", () => {
    const iso = toIsoUtc({
      date: "2026-01-15", time: "21:00", timezone: "Local", zone: "Not/AZone",
    });
    expect(iso).toBe("2026-01-16T02:00:00.000Z");
  });

  it("two-digit-era years are not remapped to the 1900s", () => {
    // JS Date treats years 0-99 as 1900-1999 unless set explicitly.
    const iso = toIsoUtc({ date: "0050-06-01", time: "12:00", timezone: "UTC" });
    expect(iso).toBe("0050-06-01T12:00:00.000Z");
  });
});

describe("isSupportedDate", () => {
  it("accepts dates inside the planet-ephemeris window", () => {
    expect(isSupportedDate("2026-09-30")).toBe(true);
    expect(isSupportedDate(DATE_MIN)).toBe(true);
    expect(isSupportedDate(DATE_MAX)).toBe(true);
  });

  it("rejects dates outside JPL DE421 coverage and malformed input", () => {
    expect(isSupportedDate("1899-12-31")).toBe(false);
    expect(isSupportedDate("2060-01-01")).toBe(false);
    expect(isSupportedDate("")).toBe(false);
    expect(isSupportedDate("not-a-date")).toBe(false);
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
