import { useEffect } from "react";
import { useIntroSequence } from "../../hooks/useIntroSequence.js";
import { useIdle } from "../../hooks/useIdle.js";
import { useUiStateStore } from "../../stores/uiStateStore.js";

/**
 * Orchestrates the visual intro choreography and hands off to useIdle.
 *
 * Wraps children in a div that carries `.intro-content` so global.css
 * keyframe animations target the content fade-in.
 *
 * Body classes:
 *   .intro-pending    — black screen, content invisible
 *   .intro-playing    — galaxy + content fade-in animations running
 *   .intro-done       — final state
 *   .ui-normal/glass/hidden — driven by useIdle
 */
export default function IntroSequence({ children }) {
  useIntroSequence();

  const { introState, activityState } = useUiStateStore();

  // Activate idle detection only after intro is done
  useIdle({ enabled: introState === "done" });

  // Mirror intro + activity state to document body classes for CSS
  useEffect(() => {
    const body = document.body;
    body.classList.remove("intro-pending", "intro-playing", "intro-done");
    body.classList.add(`intro-${introState}`);
  }, [introState]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove("ui-normal", "ui-glass", "ui-hidden");
    body.classList.add(`ui-${activityState}`);
  }, [activityState]);

  return <div className="intro-content">{children}</div>;
}
