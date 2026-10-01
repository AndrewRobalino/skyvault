import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "../components/about/AboutPage.jsx";

describe("<AboutPage>", () => {
  it.each([
    [/made use of the SIMBAD database, operated at CDS, Strasbourg, France/],
    [/made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology/],
    [/European Space Agency \(ESA\) mission\s+Gaia/],
    [/Riello et al\. 2021/],
  ])("carries the acknowledgement %s", (text) => {
    render(<AboutPage />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("links the ESO source image, the CC BY 4.0 license and OSM copyright", () => {
    render(<AboutPage />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain("https://www.eso.org/public/images/eso0932a/");
    expect(links).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(links).toContain("https://www.openstreetmap.org/copyright");
  });

  it("lists the documented approximations honestly", () => {
    render(<AboutPage />);
    expect(screen.getByText(/atmospheric refraction/i)).toBeInTheDocument();
  });

  it("links back to the sky", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: /back to the sky/i })).toHaveAttribute("href", "/");
  });
});
