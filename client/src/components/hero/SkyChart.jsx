import { useEffect, useMemo, useRef, useState } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { useUiStateStore } from "../../stores/uiStateStore.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import { useDso } from "../../hooks/useDso.js";
import { useConstellations } from "../../hooks/useConstellations.js";
import { useCanvasSize } from "../../hooks/useCanvasSize.js";
import { projectStars, projectPlanets, projectDsos, projectConstellations } from "../../utils/projection.js";
import { findNearestWithinRadius } from "../../utils/hitTest.js";
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

function statusFor({ selected, skyQuery, planetsQuery, dsoQuery }) {
  if (!selected) return "idle";
  if (skyQuery.isError || planetsQuery.isError || dsoQuery.isError) return "error";
  if (skyQuery.isLoading || planetsQuery.isLoading || dsoQuery.isLoading) return "loading";
  if (skyQuery.data && planetsQuery.data && dsoQuery.data) return "ready";
  return "loading";
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
    const planets = projectPlanets(planetsQuery.data?.planets ?? [], width, height);
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

  const status = statusFor({ selected, skyQuery, planetsQuery, dsoQuery });

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

      <SkyTooltip object={selectedObj} container={{ width, height }} />

      <SkyStatusOverlay
        state={status}
        placeName={selected?.displayName}
        error={skyQuery.error || planetsQuery.error}
        onRetry={() => {
          skyQuery.refetch();
          planetsQuery.refetch();
          dsoQuery.refetch();
        }}
      />

      <ConstellationToggle />

      <AttributionFooter />
    </div>
  );
}
