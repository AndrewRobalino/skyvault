import { useCallback, useState } from "react";

/**
 * Minimal explicit finite state machine hook.
 *
 * Usage:
 *   const { state, send, can } = useFSM({
 *     initial: "normal",
 *     transitions: {
 *       normal: { IDLE: "glass" },
 *       glass:  { IDLE: "hidden", ACTIVE: "normal" },
 *       hidden: { ACTIVE: "normal" },
 *     },
 *   });
 *
 * send("IDLE") transitions state; invalid transitions are silently no-ops
 * but can be detected via `can("IDLE")`.
 */
export function useFSM({ initial, transitions }) {
  const [state, setState] = useState(initial);

  const send = useCallback(
    (event) => {
      setState((current) => {
        const next = transitions[current]?.[event];
        return next ?? current;
      });
    },
    [transitions]
  );

  const can = useCallback(
    (event) => {
      return Boolean(transitions[state]?.[event]);
    },
    [state, transitions]
  );

  return { state, send, can };
}
