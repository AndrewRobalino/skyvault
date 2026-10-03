/**
 * Date/time helpers for the observer controls.
 *
 * The user picks a calendar date, an optional HH:MM, and a mode:
 *   - "UTC":   the wall time is UTC.
 *   - "Local": the wall time is local to the OBSERVED PLACE (its IANA zone,
 *              from the geocoder or the browser for GPS fixes), so 22:00 in
 *              Tokyo means 22:00 in Tokyo even when searched from Miami.
 * An empty time means "the current clock reading in that zone" on the chosen
 * date.
 */

// Planet positions come from JPL DE421 (1899-07-29 .. 2053-10-09 TDB). The
// window is trimmed so that every wall time on every allowed date, in every
// zone (UTC-12 .. UTC+14), plus the 6 h Moon-phase look-ahead, stays inside it.
export const DATE_MIN = "1900-01-01";
export const DATE_MAX = "2053-10-06";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isSupportedDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date)) return false;
  // ISO dates of equal length compare correctly as strings.
  return date >= DATE_MIN && date <= DATE_MAX;
}

function browserZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// UTC epoch ms for a wall-clock reading, without JS Date's 0-99 => 1900s quirk.
function wallAsUtcMs(year, month, day, hours, minutes) {
  const d = new Date(Date.UTC(2000, 0, 1, hours, minutes, 0));
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

const formatterCache = new Map();

function formatterFor(zone) {
  let fmt = formatterCache.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(zone, fmt);
  }
  return fmt;
}

// Wall-clock fields of an instant in a zone.
function wallFields(zone, epochMs) {
  const parts = {};
  for (const { type, value } of formatterFor(zone).formatToParts(epochMs)) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    seconds: Number(parts.second),
  };
}

// Zone offset (ms, east positive) in effect at an instant.
function offsetMs(zone, epochMs) {
  const f = wallFields(zone, epochMs);
  const wall = wallAsUtcMs(f.year, f.month, f.day, f.hours, f.minutes) + f.seconds * 1000;
  return wall - Math.floor(epochMs / 1000) * 1000;
}

// Instant at which `zone`'s clock reads the given wall time. Gaps
// (spring-forward) resolve one hour later; overlaps (fall-back) take the
// first occurrence, matching Temporal's "compatible" disambiguation.
//
// Works the same on both sides of UTC: take the offsets in force a day
// before and a day after, build both candidate instants, and keep the ones
// whose wall clock actually reads the requested time.
const DAY_MS = 86_400_000;

function zonedWallTimeToUtcMs(zone, year, month, day, hours, minutes) {
  const wall = wallAsUtcMs(year, month, day, hours, minutes);
  const before = offsetMs(zone, wall - DAY_MS);
  const after = offsetMs(zone, wall + DAY_MS);
  const valid = [wall - before, wall - after].filter(
    (utc) => offsetMs(zone, utc) === wall - utc
  );
  if (valid.length > 0) return Math.min(...valid); // overlap: earliest
  // Gap: the wall time never happens. Using the pre-transition offset lands
  // it after the jump (02:30 -> 03:30 in the new offset).
  return wall - before;
}

function resolveZone(zone) {
  if (!zone) return browserZone();
  try {
    formatterFor(zone);
    return zone;
  } catch {
    return browserZone(); // RangeError: unknown IANA name
  }
}

export function toIsoUtc({ date, time, timezone, zone, now = new Date() }) {
  if (!date) return null;
  const match = DATE_RE.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (!month || !day) return null;

  const tz = timezone === "UTC" ? "UTC" : resolveZone(zone);

  let hours;
  let minutes;
  if (time) {
    const [h, m] = time.split(":").map(Number);
    hours = Number.isFinite(h) ? h : 0;
    minutes = Number.isFinite(m) ? m : 0;
  } else {
    ({ hours, minutes } = wallFields(tz, now.getTime()));
  }

  const utcMs =
    tz === "UTC"
      ? wallAsUtcMs(year, month, day, hours, minutes)
      : zonedWallTimeToUtcMs(tz, year, month, day, hours, minutes);
  return new Date(utcMs).toISOString();
}

/**
 * Format a UTC ISO string as "08 APRIL 2026 · 22:00 UTC" for the header subhead.
 */
export function formatDisplayDatetime(isoUtc) {
  if (!isoUtc) return "";
  const d = new Date(isoUtc);
  const MONTHS = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hh}:${mm} UTC`;
}
