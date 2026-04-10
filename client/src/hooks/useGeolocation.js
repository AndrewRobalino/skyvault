import { useCallback, useState } from "react";

/**
 * Imperative geolocation hook. Call `request()` to trigger a one-shot
 * lookup. 10-second timeout. Returns { position, error, isLoading }.
 *
 * Not wired to React Query because geolocation isn't a pure query —
 * the user explicitly opts in by clicking the location button.
 */
export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError({ code: "UNSUPPORTED", message: "Geolocation not supported" });
      return;
    }
    setIsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLoading(false);
      },
      (err) => {
        setError({ code: err.code, message: err.message });
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  return { position, error, isLoading, request };
}
