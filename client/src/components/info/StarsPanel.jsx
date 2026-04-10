import Panel from "../ui/Panel.jsx";
import LoadingSkeleton from "../ui/LoadingSkeleton.jsx";
import ErrorCard from "../ui/ErrorCard.jsx";
import SourceBadge from "./SourceBadge.jsx";
import { bvToHex } from "../../utils/bvToColor.js";

const TOP_N = 30;

export default function StarsPanel({ query }) {
  if (query.isLoading) {
    return (
      <Panel title="Brightest Stars">
        <LoadingSkeleton lines={8} />
      </Panel>
    );
  }

  if (query.isError) {
    return (
      <Panel title="Brightest Stars">
        <ErrorCard
          title="Failed to load star data"
          message={query.error?.message}
          onRetry={() => query.refetch()}
        />
      </Panel>
    );
  }

  const stars = query.data?.stars || [];
  if (stars.length === 0) {
    return (
      <Panel title="Brightest Stars">
        <p className="font-serif italic text-ink-dim">
          No stars above the horizon at this time and location.
        </p>
      </Panel>
    );
  }

  const top = [...stars]
    .sort((a, b) => a.magnitude - b.magnitude)
    .slice(0, TOP_N);

  return (
    <Panel title="Brightest Stars">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              <th className="pb-2 text-left">Star</th>
              <th className="pb-2 text-right">Mag</th>
              <th className="pb-2 text-right">Alt</th>
              <th className="pb-2 text-right">Az</th>
              <th className="pb-2 text-right">Distance (ly)</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s) => (
              <tr key={s.source_id} className="border-t border-rule/40">
                <td className="py-1.5 font-mono text-xs text-ink">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: bvToHex(s.bp_rp) }}
                      aria-hidden="true"
                    />
                    <span className="text-ink-dim">Gaia</span>
                    <span>{String(s.source_id).slice(-9)}</span>
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.magnitude.toFixed(2)}
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.alt.toFixed(1)}°
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.az.toFixed(1)}°
                </td>
                <td className="py-1.5 text-right font-mono text-xs text-ink">
                  {s.distance_ly != null ? s.distance_ly.toFixed(1) : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <SourceBadge source="Gaia DR3" />
      </div>
    </Panel>
  );
}
