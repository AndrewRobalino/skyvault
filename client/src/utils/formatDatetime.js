/**
 * Combine a YYYY-MM-DD date, optional HH:MM time, and a timezone selection
 * (Local | UTC) into an ISO 8601 UTC string.
 *
 * - If `time` is empty, defaults to the current wall-clock time.
 * - Local mode interprets the date+time in the browser's local timezone
 *   and converts to UTC via Date object math.
 * - UTC mode interprets date+time as already-UTC and returns the same
 *   moment as an ISO string.
 */
export function toIsoUtc({ date, time, timezone }) {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  let hours = 0;
  let minutes = 0;
  if (time) {
    const [h, m] = time.split(":").map(Number);
    hours = Number.isFinite(h) ? h : 0;
    minutes = Number.isFinite(m) ? m : 0;
  } else {
    const now = new Date();
    hours = now.getHours();
    minutes = now.getMinutes();
  }

  let dt;
  if (timezone === "UTC") {
    dt = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  } else {
    dt = new Date(year, month - 1, day, hours, minutes, 0);
  }
  return dt.toISOString();
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
