import { useEffect, useMemo, useRef, useState } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { useUiStateStore } from "../../stores/uiStateStore.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import { useDso } from "../../hooks/useDso.js";
import { useConstellations } from "../../hooks/useConstellations.js";
import { useObject } from "../../hooks/useObject.js";
import { useCanvasSize } from "../../hooks/useCanvasSize.js";
import { projectStars, projectPlanets, projectDsos, projectConstellations } from "../../utils/projection.js";
import { findNearestWithinRadius } from "../../utils/hitTest.js";
import { useDelayedFlag } from "../../hooks/useDelayedFlag.js";
import SkyCanvas from "./SkyCanvas.jsx";
import CardinalLabels from "./CardinalLabels.jsx";
import SelectionRing from "./SelectionRing.jsx";
import SkyTooltip from "./SkyTooltip.jsx";
import SkyStatusOverlay from "./SkyStatusOverlay.jsx";
import MilkyWayBackdrop from "./MilkyWayBackdrop.jsx";
import PlanetLabels from "./PlanetLabels.jsx";
import ConstellationLabels from "./ConstellationLabels.jsx";
import AttributionFooter from "./AttributionFooter.jsx";
import ConstellationToggle from "./ConstellationToggle.jsx";
import SaveImageButton from "./SaveImageButton.jsx";
import { saveSnapshot } from "../../utils/snapshot.js";

// Stars are the chart: only a sky failure blocks it. Planets and DSOs degrade
// to a notice (e.g. a date outside JPL DE421 coverage still has a starry sky).
function statusFor({ selected, skyQuery, planetsQuery, dsoQuery }) {
  if (!selected) return "idle";
  if (skyQuery.isError) return "error";
  const settled = (q) => Boolean(q.data) || q.isError;
  if (skyQuery.data && settled(planetsQuery) && settled(dsoQuery)) return "ready";
  return "loading";
}

function layerNotices({ planetsQuery, dsoQuery }) {
  const notices = [];
  if (planetsQuery.isError) {
    // A 422 carries the backend's explanation (the DE421 date window).
    notices.push(
      planetsQuery.error?.status === 422 && planetsQuery.error?.message
        ? planetsQuery.error.message
        : "Planet positions are unavailable right now."
    );
  }
  if (dsoQuery.isError) notices.push("Deep-sky objects are unavailable right now.");
  return notices;
}

export default function SkyChart() {
  const selected = useObserverStore((s) => s.selected);
  const datetimeUtc = useObserverStore((s) => s.datetimeUtc);

  const skyQuery = useSky(selected, datetimeUtc);
  const planetsQuery = usePlanets(selected, datetimeUtc);
  const dsoQuery = useDso(selected, datetimeUtc);

  const showConstellations = useUiStateStore((s) => s.showConstellations);
  const constellationsQuery = useConstellations(selected, datetimeUtc, showConstellations);

  const containerRef = useRef(null);
  const { width, height, dpr } = useCanvasSize(containerRef);

  const projected = useMemo(() => {
    const stars = projectStars(skyQuery.data?.stars ?? [], width, height);
    // The API includes below-horizon bodies for the info panels; the chart
    // draws (and hit-tests) only what is up.
    const upPlanets = (planetsQuery.data?.planets ?? []).filter((p) => p.alt >= 0);
    const planets = projectPlanets(upPlanets, width, height);
    const dsos = projectDsos(dsoQuery.data?.dsos ?? [], width, height);
    return { stars, planets, dsos, all: [...stars, ...planets, ...dsos] };
  }, [skyQuery.data, planetsQuery.data, dsoQuery.data, width, height]);

  const constellationGeom = useMemo(
    () =>
      projectConstellations(
        constellationsQuery.data?.constellations ?? [],
        width,
        height
      ),
    [constellationsQuery.data, width, height]
  );

  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const hoveredObj = useMemo(
    () => projected.all.find((o) => o.id === hoveredId) ?? null,
    [hoveredId, projected.all]
  );
  const selectedObj = useMemo(
    () => projected.all.find((o) => o.id === selectedId) ?? null,
    [selectedId, projected.all]
  );

  // Enrichment is star-only and fetched on selection (never hover), so planets
  // and DSOs never trigger a lookup.
  const selectedStarSourceId =
    selectedObj?.kind === "star" ? selectedObj.source_id : null;
  const objectQuery = useObject(selectedStarSourceId, Boolean(selectedStarSourceId));
  const enrichment = objectQuery.data?.found ? objectQuery.data.enrichment : null;

  const status = statusFor({ selected, skyQuery, planetsQuery, dsoQuery });
  // A cold Cloud Run start takes a few seconds; say so instead of looking stuck.
  const slow = useDelayedFlag(status === "loading", 3000);
  const notices = status === "ready" ? layerNotices({ planetsQuery, dsoQuery }) : [];

  const getMouseCoords = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
  };

  const handleMouseMove = (e) => {
    if (status !== "ready") return;
    const coords = getMouseCoords(e);
    if (!coords) return;
    const hit = findNearestWithinRadius(projected.all, coords.mx, coords.my);
    setHoveredId(hit?.id ?? null);
  };

  const handleMouseLeave = () => setHoveredId(null);

  const handleClick = (e) => {
    if (status !== "ready") return;
    const coords = getMouseCoords(e);
    if (!coords) return;
    const hit = findNearestWithinRadius(projected.all, coords.mx, coords.my);
    setSelectedId(hit?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Export exactly the layers on screen: constellations only when toggled on.
  const handleSave = () =>
    saveSnapshot({
      selected,
      datetimeUtc,
      stars: skyQuery.data?.stars ?? [],
      planets: planetsQuery.data?.planets ?? [],
      dsos: dsoQuery.data?.dsos ?? [],
      constellations: showConstellations
        ? (constellationsQuery.data?.constellations ?? [])
        : [],
    });

  const ariaLabel = selected
    ? `Night sky for ${selected.displayName} on ${datetimeUtc ?? ""}`
    : "Night sky chart";

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="absolute inset-0 cursor-default data-[hover=true]:cursor-pointer"
      data-hover={hoveredId != null ? "true" : "false"}
    >
      <MilkyWayBackdrop
        width={width}
        height={height}
        dpr={dpr}
        lat={selected?.lat}
        lon={selected?.lon}
        datetime={datetimeUtc}
      />

      <SkyCanvas
        projectedStars={status === "ready" ? projected.stars : []}
        projectedPlanets={status === "ready" ? projected.planets : []}
        projectedDsos={status === "ready" ? projected.dsos : []}
        projectedLines={showConstellations ? constellationGeom.lines : []}
        width={width}
        height={height}
        dpr={dpr}
      />

      <PlanetLabels
        projectedPlanets={status === "ready" ? projected.planets : []}
        width={width}
      />

      {showConstellations && (
        <ConstellationLabels labels={constellationGeom.labels} />
      )}

      {status === "ready" && <CardinalLabels />}

      <SelectionRing
        object={selectedObj ?? hoveredObj}
        variant={selectedObj ? "selected" : "hover"}
      />

      <SkyTooltip
        object={selectedObj}
        enrichment={enrichment}
        enrichmentLoading={objectQuery.isLoading && Boolean(selectedStarSourceId)}
        container={{ width, height }}
      />

      <SkyStatusOverlay
        state={status}
        placeName={selected?.displayName}
        error={skyQuery.error}
        slow={slow}
        onRetry={() => {
          skyQuery.refetch();
          planetsQuery.refetch();
          dsoQuery.refetch();
        }}
      />

      {notices.length > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute left-3 top-3 z-10 max-w-[70%] space-y-1 border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-ink-dim backdrop-blur-sm"
        >
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <div className="absolute right-3 top-3 z-10 flex gap-2">
        {status === "ready" && <SaveImageButton onSave={handleSave} />}
        <ConstellationToggle />
      </div>

      <AttributionFooter />
    </div>
  );
}
