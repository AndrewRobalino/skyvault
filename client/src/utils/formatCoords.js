/**
 * Format a lat/lon pair as "25.76°N 80.19°W".
 * Both values are in degrees; positive = N/E, negative = S/W.
 */
export function formatLatLon(lat, lon) {
  if (lat == null || lon == null) return "";
  const latHemi = lat >= 0 ? "N" : "S";
  const lonHemi = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latHemi} ${Math.abs(lon).toFixed(2)}°${lonHemi}`;
}
