import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LocationInput from "../components/controls/LocationInput.jsx";
import { useObserverStore } from "../stores/observerStore.js";

describe("<LocationInput>", () => {
  beforeEach(() => {
    useObserverStore.getState().reset();
  });

  it("renders an input with the placeholder", () => {
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    expect(input).toBeInTheDocument();
  });

  it("updates rawQuery on typing", () => {
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    fireEvent.change(input, { target: { value: "Portoviejo" } });
    expect(useObserverStore.getState().rawQuery).toBe("Portoviejo");
  });

  it("Enter key triggers submit", () => {
    useObserverStore.setState({ date: "2026-04-08" });
    render(<LocationInput />);
    const input = screen.getByPlaceholderText(/city, country/i);
    fireEvent.change(input, { target: { value: "Portoviejo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useObserverStore.getState().geocodeRequested).toBe(true);
  });

  it("renders DidYouMeanDropdown when candidates exist", () => {
    useObserverStore.getState().setCandidates([
      {
        display_name: "Portoviejo, Manabí, Ecuador",
        name: "Portoviejo",
        country: "Ecuador",
        state: "Manabí",
        lat: -1.0569,
        lon: -80.4544,
      },
    ]);
    render(<LocationInput />);
    expect(screen.getByText(/did you mean/i)).toBeInTheDocument();
    expect(screen.getByText(/Portoviejo, Manabí, Ecuador/)).toBeInTheDocument();
  });
});
