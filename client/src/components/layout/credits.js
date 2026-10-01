/**
 * Single source for every data credit: the page footer (#credits) and the
 * /about page both render from here. Every row that a license requires
 * attribution for names that license. Keep in sync with the README table.
 */
export const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";

export const CREDITS = [
  {
    what: "Milky Way panorama",
    who: "ESO/S. Brunier",
    href: "https://www.eso.org/public/images/eso0932a/",
    license: "CC BY 4.0",
    licenseHref: CC_BY_4,
    // CC BY 4.0: changes must be indicated (scripts/reencode_milky_way.py).
    note: "re-encoded to a smaller JPEG",
  },
  {
    what: "Stars",
    who: "ESA Gaia DR3 (Gaia/DPAC)",
    href: "https://www.cosmos.esa.int/gaia",
    license: "CC BY-SA 3.0 IGO",
    licenseHref: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
  },
  { what: "Brightest stars", who: "ESA Hipparcos" },
  { what: "Sun, Moon & planets", who: "NASA JPL DE421 via Astropy" },
  {
    what: "Planet & Moon textures",
    who: "Solar System Scope",
    href: "https://www.solarsystemscope.com/textures/",
    license: "CC BY 4.0",
    licenseHref: CC_BY_4,
  },
  {
    what: "Star names",
    who: "IAU WGSN",
    // The vendored list (server/data/sources/iau_csn.txt) states "Creative
    // Commons Attribution" without a version and asks users to cite this page.
    href: "https://www.iau.org/public/themes/naming_stars/",
    license: "CC BY",
  },
  {
    what: "Star & deep-sky data",
    who: "SIMBAD, CDS Strasbourg",
    href: "https://simbad.cds.unistra.fr/",
  },
  {
    what: "Exoplanets",
    who: "NASA Exoplanet Archive",
    href: "https://exoplanetarchive.ipac.caltech.edu/",
  },
  {
    what: "Constellation figures",
    who: "Stellarium",
    href: "https://stellarium.org/",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    what: "Place search & time zones",
    who: "© OpenStreetMap contributors",
    href: "https://www.openstreetmap.org/copyright",
    license: "ODbL",
    licenseHref: "https://opendatacommons.org/licenses/odbl/",
  },
];

// Requested acknowledgement wording, quoted from each provider's usage terms.
export const ACKNOWLEDGEMENTS = [
  {
    source: "ESA Gaia",
    text:
      "This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium).",
  },
  {
    source: "CDS SIMBAD",
    text: "This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.",
  },
  {
    source: "NASA Exoplanet Archive",
    text:
      "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.",
  },
  {
    source: "Photometric transformations",
    text:
      'Hipparcos magnitudes and colours are converted to the Gaia system with the relations of Riello et al. 2021, A&A 649, A3 (Table 5.7); converted values are marked "derived".',
  },
];

export const APPROXIMATIONS = [
  "No atmospheric refraction (under 0.5° near the horizon; it depends on weather we don't ask for).",
  "The Milky Way backdrop uses J2000 galactic axes with of-date coordinates (about 0.4° on a diffuse image).",
  "Sidereal time for the backdrop ignores UT1−UTC (under 13 arcseconds).",
  "The Moon icon's terminator is simplified; its illumination and phase are computed exactly.",
];
