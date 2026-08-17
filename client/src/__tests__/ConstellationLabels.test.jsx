import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConstellationLabels from "../components/hero/ConstellationLabels.jsx";

describe("ConstellationLabels", () => {
  it("renders a label per provided entry", () => {
    render(
      <ConstellationLabels
        labels={[
          { id: "Ori", name: "Orion", x: 100, y: 120 },
          { id: "UMi", name: "Little Bear", x: 300, y: 80 },
        ]}
      />
    );
    expect(screen.getByText("Orion")).toBeInTheDocument();
    expect(screen.getByText("Little Bear")).toBeInTheDocument();
  });

  it("renders nothing for empty labels", () => {
    const { container } = render(<ConstellationLabels labels={[]} />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
