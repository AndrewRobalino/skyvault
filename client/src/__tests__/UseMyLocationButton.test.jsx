import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import UseMyLocationButton from "../components/controls/UseMyLocationButton.jsx";
import SubmitButton from "../components/controls/SubmitButton.jsx";
import { useObserverStore } from "../stores/observerStore.js";

beforeEach(() => {
  useObserverStore.getState().reset();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: "denied" }) },
  });
});

describe("GPS fixes", () => {
  it("a stale 'Location denied' clears once a location is selected", () => {
    render(<UseMyLocationButton />);
    fireEvent.click(screen.getByRole("button", { name: /gps/i }));
    expect(screen.getByText(/location denied/i)).toBeInTheDocument();
    act(() => {
      useObserverStore.setState({
        selected: { lat: 1, lon: 2, displayName: "Quito, Ecuador", timezone: "America/Guayaquil" },
      });
    });
    expect(screen.queryByText(/location denied/i)).not.toBeInTheDocument();
  });

  it("GO is enabled after a GPS fix with an empty search box", () => {
    useObserverStore.setState({
      date: "2026-04-08",
      rawQuery: "",
      selected: { lat: 1, lon: 2, displayName: "Current location", timezone: "UTC" },
    });
    render(<SubmitButton isGeocoding={false} isComputing={false} />);
    expect(screen.getByRole("button", { name: "GO" })).toBeEnabled();
  });
});
