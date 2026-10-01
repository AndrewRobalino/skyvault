import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyStatusOverlay from "../components/hero/SkyStatusOverlay.jsx";

describe("<SkyStatusOverlay> launch states", () => {
  it("explains a cold start once loading is slow", () => {
    render(<SkyStatusOverlay state="loading" placeName="Tokyo" slow />);
    expect(screen.getByText(/waking up the observatory/i)).toBeInTheDocument();
  });

  it("does not mention waking up for a normal fast load", () => {
    render(<SkyStatusOverlay state="loading" placeName="Tokyo" slow={false} />);
    expect(screen.queryByText(/waking up/i)).not.toBeInTheDocument();
  });

  it("says to wait a minute on 429", () => {
    render(<SkyStatusOverlay state="error" error={{ status: 429 }} onRetry={() => {}} />);
    expect(screen.getByText(/too many requests — give it a minute/i)).toBeInTheDocument();
  });

  it.each([[503], [0]])("shows the friendly offline card for status %s", (status) => {
    render(<SkyStatusOverlay state="error" error={{ status }} onRetry={() => {}} />);
    expect(screen.getByText(/temporarily offline/i)).toBeInTheDocument();
  });
});
