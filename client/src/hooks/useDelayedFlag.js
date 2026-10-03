import { useEffect, useState } from "react";

/** True once `active` has stayed true for `delayMs` (e.g. "this load is slow"). */
export function useDelayedFlag(active, delayMs) {
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => setFired(true), delayMs);
    return () => {
      clearTimeout(t);
      setFired(false);
    };
  }, [active, delayMs]);
  return active && fired;
}
