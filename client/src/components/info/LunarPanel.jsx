import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import MoonSvg from "./MoonSvg.jsx";
import SourceBadge from "./SourceBadge.jsx";

function moonFromPlanets(data) {
  if (!data?.planets) return null;
  return data.planets.find((p) => p.name === "moon") || null;
}

export default function LunarPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Lunar Conditions">
        <LoadingSkeleton lines={4} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Lunar Conditions">
        <ErrorCard
          title="Failed to load lunar data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const moon = moonFromPlanets(query.data);
  if (!moon) {
    return (
      <Panel title="Lunar Conditions">
        <p className="font-serif italic text-ink-dim">Moon below horizon</p>
      </Panel>
    );
  }

  const illuminationPct =
    moon.illumination != null ? Math.round(moon.illumination * 100) : null;

  return (
    <Panel title="Lunar Conditions">
      <div className="flex items-center gap-6">
        <MoonSvg
          phaseAngle={moon.phase_angle}
          phaseName={moon.phase_name}
          size={100}
        />
        <div className="flex-1 space-y-2">
          {moon.phase_name && (
            <p className="font-serif italic text-ink text-lg">
              {moon.phase_name}
            </p>
          )}
          {illuminationPct != null && (
            <p className="font-mono text-sm text-ink-dim">
              Illumination: <span className="text-ink">{illuminationPct}%</span>
            </p>
          )}
          <p className="font-mono text-sm text-ink-dim">
            Altitude: <span className="text-ink">{moon.alt.toFixed(1)}°</span>
          </p>
          <p className="font-mono text-sm text-ink-dim">
            Azimuth: <span className="text-ink">{moon.az.toFixed(1)}°</span>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <SourceBadge source={moon.source} />
      </div>
    </Panel>
  );
}
