import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Footer from "../components/layout/Footer.jsx";

describe("<Footer> data credits", () => {
  it("is the #credits target the chart links to", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("#credits")).toBeInTheDocument();
  });

  it.each([
    [/ESO\/S\. Brunier/, "Milky Way panorama (CC BY 4.0)"],
    [/ESA Gaia DR3/, "star positions and photometry"],
    [/ESA Hipparcos/, "the bright stars Gaia saturates on"],
    [/NASA JPL DE421/, "planet ephemeris"],
    [/Solar System Scope/, "planet and Moon textures (CC BY 4.0)"],
    [/IAU WGSN/, "star names (CC BY)"],
    [/SIMBAD/, "star and deep-sky metadata"],
    [/NASA Exoplanet Archive/, "exoplanet hosts"],
    [/Stellarium/, "constellation figures (CC BY-SA)"],
    [/OpenStreetMap contributors/, "place search and time zones (ODbL)"],
  ])("credits %s for %s", (who) => {
    const { container } = render(<Footer />);
    expect(within(container.querySelector("#credits")).getByText(who)).toBeInTheDocument();
  });

  it("states each license that requires attribution", () => {
    const { container } = render(<Footer />);
    const credits = container.querySelector("#credits");
    expect(within(credits).getAllByText("CC BY 4.0").length).toBe(2); // ESO + Solar System Scope
    expect(within(credits).getByText("CC BY-SA 3.0 IGO")).toBeInTheDocument(); // Gaia
    expect(within(credits).getByText("CC BY-SA")).toBeInTheDocument(); // Stellarium
    expect(within(credits).getByText("CC BY")).toBeInTheDocument(); // IAU WGSN
    expect(within(credits).getByText("ODbL")).toBeInTheDocument(); // OSM
  });

  it("links the ESO source image", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /ESO\/S\. Brunier/ })).toHaveAttribute(
      "href",
      "https://www.eso.org/public/images/eso0932a/"
    );
  });
});
