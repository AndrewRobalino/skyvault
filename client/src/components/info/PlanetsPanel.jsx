import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import SourceBadge from "./SourceBadge.jsx";

const DISPLAY_ORDER = [
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

const PRETTY_NAMES = {
  sun: "The Sun",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
};

export default function PlanetsPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Wandering Stars">
        <LoadingSkeleton lines={6} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Wandering Stars">
        <ErrorCard
          title="Failed to load planet data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const all = query.data?.planets || [];
  const byName = new Map(all.filter((p) => p.name !== "moon").map((p) => [p.name, p]));
  const rows = DISPLAY_ORDER.map((name) => byName.get(name)).filter(Boolean);

  return (
    <Panel title="Wandering Stars">
      <table className="w-full">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
            <th className="pb-2 text-left">Body</th>
            <th className="pb-2 text-right">Alt</th>
            <th className="pb-2 text-right">Az</th>
            <th className="pb-2 text-right">Dist (AU)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const belowHorizon = p.alt < 0;
            return (
              <tr
                key={p.name}
                className={belowHorizon ? "text-ink-dim line-through decoration-ink-dim/50" : "text-ink"}
              >
                <td className="py-1 font-serif italic">
                  {PRETTY_NAMES[p.name] || p.name}
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.alt.toFixed(1)}°
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.az.toFixed(1)}°
                </td>
                <td className="py-1 text-right font-mono text-sm">
                  {p.distance_au.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-4">
        <SourceBadge source="JPL DE421 via Astropy" />
      </div>
    </Panel>
  );
}
