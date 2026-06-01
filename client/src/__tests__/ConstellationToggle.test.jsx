import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useUiStateStore } from "../stores/uiStateStore.js";
import ConstellationToggle from "../components/hero/ConstellationToggle.jsx";

beforeEach(() => useUiStateStore.setState({ showConstellations: false }));

describe("ConstellationToggle", () => {
  it("toggles showConstellations on click", () => {
    render(<ConstellationToggle />);
    const btn = screen.getByRole("button", { name: /constellation/i });
    expect(useUiStateStore.getState().showConstellations).toBe(false);
    fireEvent.click(btn);
    expect(useUiStateStore.getState().showConstellations).toBe(true);
  });

  it("reflects pressed state via aria-pressed", () => {
    render(<ConstellationToggle />);
    const btn = screen.getByRole("button", { name: /constellation/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
