import { useEffect } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { useGeocode } from "../../hooks/useGeocode.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import LocationInput from "./LocationInput.jsx";
import UseMyLocationButton from "./UseMyLocationButton.jsx";
import DateInput from "./DateInput.jsx";
import TimeInput from "./TimeInput.jsx";
import TimezoneToggle from "./TimezoneToggle.jsx";
import SubmitButton from "./SubmitButton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";

export default function ControlsStrip() {
  const { rawQuery, selected, datetimeUtc, geocodeRequested, setCandidates } =
    useObserverStore();

  // Geocode query — fires when submit() sets geocodeRequested
  const geocode = useGeocode(rawQuery, geocodeRequested);

  useEffect(() => {
    if (geocode.data?.candidates) {
      setCandidates(geocode.data.candidates);
    }
  }, [geocode.data, setCandidates]);

  // Sky + planets queries — fire when a candidate has been selected
  const sky = useSky(selected, datetimeUtc);
  const planets = usePlanets(selected, datetimeUtc);

  const isComputing = sky.isFetching || planets.isFetching;

  return (
    <section className="controls-strip border border-rule bg-[color:var(--bg-panel)] backdrop-blur-sm p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
        <LocationInput />
        <UseMyLocationButton />
        <DateInput />
        <TimeInput />
        <TimezoneToggle />
        <SubmitButton
          isGeocoding={geocode.isFetching}
          isComputing={isComputing}
        />
      </div>

      {geocode.isError && (
        <div className="mt-4">
          <ErrorCard
            title="Geocoder unavailable"
            message={
              geocode.error?.status === 503
                ? "Couldn't reach the place lookup service. Try again, or use your current location."
                : geocode.error?.message || "Unknown error"
            }
            onRetry={() => geocode.refetch()}
          />
        </div>
      )}
      {geocode.data && geocode.data.count === 0 && (
        <p className="mt-4 font-serif italic text-sm text-ink-dim">
          No matches found for &ldquo;{rawQuery}&rdquo;. Try a larger nearby
          city or your current location.
        </p>
      )}
    </section>
  );
}
