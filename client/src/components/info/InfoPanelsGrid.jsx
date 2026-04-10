import { useObserverStore } from "../../stores/observerStore.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import LunarPanel from "./LunarPanel.jsx";
import PlanetsPanel from "./PlanetsPanel.jsx";
import StarsPanel from "./StarsPanel.jsx";

export default function InfoPanelsGrid() {
  const { selected, datetimeUtc } = useObserverStore();
  const sky = useSky(selected, datetimeUtc);
  const planets = usePlanets(selected, datetimeUtc);

  // Don't render panels until the user has submitted + selected
  if (!selected || !datetimeUtc) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <LunarPanel query={planets} />
        <PlanetsPanel query={planets} />
      </div>
      <StarsPanel query={sky} />
    </div>
  );
}
