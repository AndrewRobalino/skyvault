import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  placeLabel,
  snapshotCaption,
  snapshotFilename,
  renderSnapshot,
  SNAPSHOT_PX,
} from "../utils/snapshot.js";

describe("placeLabel", () => {
  it("uses the first part of a geocoded name", () => {
    expect(placeLabel({ displayName: "Tokyo, Japan", lat: 35.69, lon: 139.69 })).toBe("Tokyo");
  });

  it("uses coordinates for a GPS fix (no place name)", () => {
    expect(
      placeLabel({ displayName: "Current location", country: null, lat: 25.7617, lon: -80.1918 })
    ).toBe("25.76°N 80.19°W");
  });
});

describe("snapshotCaption", () => {
  it("shows the place's own local time and zone", () => {
    const caption = snapshotCaption({
      place: "Tokyo",
      datetimeUtc: "2026-04-08T13:00:00.000Z",
      zone: "Asia/Tokyo",
    });
    expect(caption).toBe("Tokyo · 8 Apr 2026, 22:00 GMT+9");
  });

  it("follows DST in the place's zone", () => {
    const caption = snapshotCaption({
      place: "New York",
      datetimeUtc: "2026-07-05T02:00:00.000Z",
      zone: "America/New_York",
    });
    expect(caption).toBe("New York · 4 Jul 2026, 22:00 EDT");
  });
});

describe("snapshotFilename", () => {
  it("is a slug of the place plus the local date and time", () => {
    expect(
      snapshotFilename({ place: "Tokyo", datetimeUtc: "2026-04-08T13:00:00.000Z", zone: "Asia/Tokyo" })
    ).toBe("skyvault-tokyo-2026-04-08-2200.png");
  });

  it("uses the place's local date, which can differ from the UTC date", () => {
    expect(
      snapshotFilename({ place: "Tokyo", datetimeUtc: "2026-04-08T20:00:00.000Z", zone: "Asia/Tokyo" })
    ).toBe("skyvault-tokyo-2026-04-09-0500.png");
  });

  it("strips accents and punctuation", () => {
    expect(
      snapshotFilename({ place: "São Paulo", datetimeUtc: "2026-04-08T13:00:00.000Z", zone: "America/Sao_Paulo" })
    ).toBe("skyvault-sao-paulo-2026-04-08-1000.png");
  });

  it("drops a place name with no Latin letters or digits instead of leaving an empty slug", () => {
    expect(
      snapshotFilename({ place: "東京都", datetimeUtc: "2026-04-08T13:00:00.000Z", zone: "Asia/Tokyo" })
    ).toBe("skyvault-2026-04-08-2200.png");
  });
});

// --- renderSnapshot: record what gets drawn on the output canvas ----------

function recorder2d() {
  const ctx = {
    texts: [],
    images: 0,
    fillStyle: "",
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 1,
    strokeStyle: "",
    globalCompositeOperation: "",
    letterSpacing: "",
    fillText(text, x, y) {
      ctx.texts.push({ text, x, y, fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha });
    },
    drawImage() {
      ctx.images += 1;
    },
    measureText: (t) => ({ width: t.length * 6 }),
  };
  for (const fn of [
    "setTransform", "fillRect", "clearRect", "save", "restore", "beginPath", "arc", "fill",
    "stroke", "moveTo", "lineTo", "ellipse", "closePath", "clip", "translate", "rotate", "scale",
  ]) {
    ctx[fn] = () => {};
  }
  ctx.createRadialGradient = () => ({ addColorStop: () => {} });
  return ctx;
}

function glStub() {
  const gl = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === "getShaderParameter" || prop === "getProgramParameter") return () => true;
        if (typeof prop === "string" && /^[A-Z_0-9]+$/.test(prop)) return 1;
        return () => ({});
      },
    }
  );
  return gl;
}

let ctx2d;
let webglAvailable;
const realGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  ctx2d = null;
  webglAvailable = true;
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type === "2d") {
      // First 2d context requested is the output canvas.
      if (!this.__ctx) this.__ctx = recorder2d();
      if (!ctx2d) ctx2d = this.__ctx;
      return this.__ctx;
    }
    return webglAvailable ? glStub() : null;
  };
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
  vi.restoreAllMocks();
});

const BASE = {
  stars: [{ source_id: "1", alt: 60, az: 10, magnitude: 1, bp_rp: 0.5 }],
  planets: [
    { name: "mars", alt: 30, az: 200, distance_au: 1.2 },
    { name: "jupiter", alt: -5, az: 90, distance_au: 5 },
  ],
  dsos: [],
  constellations: [],
  lat: 25.76,
  lon: -80.19,
  datetimeUtc: "2026-04-08T02:00:00.000Z",
  caption: "Miami · 7 Apr 2026, 22:00 EDT",
  backdropImage: {},
};

const drawn = () => ctx2d.texts.map((t) => t.text);

describe("renderSnapshot", () => {
  it("produces a 2000 x 2000 image", () => {
    const canvas = renderSnapshot(BASE);
    expect(SNAPSHOT_PX).toBe(2000);
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(2000);
  });

  it("burns the Milky Way credit into the image when the panorama is in it (CC BY 4.0)", () => {
    renderSnapshot(BASE);
    expect(ctx2d.images).toBe(1);
    expect(drawn()).toContain("Milky Way: ESO/S. Brunier · CC BY 4.0");
  });

  it("omits the Milky Way credit when WebGL is unavailable and no panorama is drawn", () => {
    webglAvailable = false;
    renderSnapshot(BASE);
    expect(ctx2d.images).toBe(0);
    expect(drawn().some((t) => t.includes("Brunier"))).toBe(false);
  });

  it("always credits the star catalogs", () => {
    renderSnapshot(BASE);
    expect(drawn()).toContain("Stars: ESA/Gaia/DPAC & ESA Hipparcos");
  });

  it("credits Stellarium only when constellation figures are drawn", () => {
    renderSnapshot(BASE);
    expect(drawn().some((t) => t.includes("Stellarium"))).toBe(false);

    ctx2d = null;
    renderSnapshot({
      ...BASE,
      constellations: [
        {
          id: "Ori", name: "Orion",
          segments: [{ from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true }],
          label_alt: 48, label_az: 92, label_visible: true,
        },
      ],
    });
    expect(drawn()).toContain("Figures: Stellarium · CC BY-SA");
    expect(drawn()).toContain("ORION"); // uppercase, as the chart shows it
  });

  it("draws the place/time caption faintly", () => {
    renderSnapshot(BASE);
    const caption = ctx2d.texts.find((t) => t.text === BASE.caption);
    expect(caption).toBeDefined();
    expect(caption.globalAlpha).toBeLessThanOrEqual(0.35);
  });

  it("labels planets that are up and skips ones below the horizon", () => {
    renderSnapshot(BASE);
    expect(drawn()).toContain("Mars");
    expect(drawn()).not.toContain("Jupiter");
  });

  it("marks the cardinal directions", () => {
    renderSnapshot(BASE);
    for (const c of ["N", "E", "S", "W"]) expect(drawn()).toContain(c);
  });
});
