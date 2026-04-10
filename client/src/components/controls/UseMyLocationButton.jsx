import { useEffect } from "react";
import { useGeolocation } from "../../hooks/useGeolocation.js";
import { useObserverStore } from "../../stores/observerStore.js";

export default function UseMyLocationButton() {
  const { position, error, isLoading, request } = useGeolocation();
  const setCurrentLocation = useObserverStore((s) => s.useCurrentLocation);

  useEffect(() => {
    if (position) {
      setCurrentLocation(position.lat, position.lon, "Current location");
    }
  }, [position, setCurrentLocation]);

  return (
    <div className="flex flex-col">
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        &nbsp;
      </label>
      <button
        type="button"
        onClick={request}
        disabled={isLoading}
        title="Use my current location"
        className="border border-rule bg-bg/60 px-4 py-3 text-ink hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {isLoading ? "..." : "Use GPS"}
      </button>
      {error && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-danger">
          {error.code === 1
            ? "Location denied"
            : "Couldn't get location"}
        </p>
      )}
    </div>
  );
}
