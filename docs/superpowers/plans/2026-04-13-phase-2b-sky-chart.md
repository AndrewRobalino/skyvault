# Phase 2b — Canvas 2D Sky Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the immersive rectangular Canvas 2D sky chart that replaces the Phase 2a `HeroRegion` placeholder. Real Gaia DR3 stars + JPL DE421 planets rendered via stereographic projection, with progressive-disclosure interaction (clean on load, hover highlights, click tooltip).

**Architecture:** A `SkyChart` container owns React state (hovered/selected IDs) and orchestrates children. `SkyCanvas` is a purely imperative `<canvas>` drawing component. Hit testing runs in JS against a pre-projected array; hover/selection render as absolute-positioned HTML overlays (no canvas redraws on hover). The projection, hit-test, and drawing pipelines dispatch on object `kind` so Phase 3+ can add constellations, galaxies, comets without refactoring.

**Tech Stack:** React 18 + Vite, Canvas 2D (native, no new deps), Tailwind CSS (existing design tokens), Zustand (existing `observerStore` / `uiStateStore`), @tanstack/react-query (existing `useSky` / `usePlanets`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-13-phase-2b-sky-chart-design.md`

---

## Execution Preamble

### Branch setup (run before Task A1)

```bash
cd C:\Users\andre\skyvault
git checkout main
git pull origin main
git checkout -b feat/phase-2b-sky-chart
```

### Commit convention
Conventional commits, all commits scoped to `(chart)` or `(test)`:
- `feat(chart): ...`
- `fix(chart): ...`
- `refactor(chart): ...`
- `test(chart): ...`
- `docs(chart): ...`

### Running tests (from `client/`)
- Full suite: `npm run test`
- Single file: `npm run test -- src/__tests__/FILE.test.js`
- Watch mode: `npm run test:watch`

### Running lint
- `npm run lint`

### Test conventions
- Tests live in `client/src/__tests__/` (flat directory — matches Phase 2a pattern).
- File naming: `NAME.test.js` for utils, `NAME.test.jsx` for components.
- Setup in `src/__tests__/setup.js` (already configured: jsdom, jest-dom matchers, auto-cleanup).
- Use `describe`, `it`, `expect` from `vitest` (globals enabled).
- Import source via relative paths from `src/__tests__/` (e.g., `../utils/projection.js`).

---

## File Structure

### New files

```
client/src/utils/
├── projection.js        Stereographic projection (AltAz → canvas x,y)
├── hitTest.js           findNearestWithinRadius for mouse events
└── drawing.js           magnitudeToGlow + drawStar + drawPlanet

client/src/hooks/
└── useCanvasSize.js     ResizeObserver + DPR tracking

client/src/components/hero/
├── SkyChart.jsx         Container, owns selection state, orchestrates children
├── SkyCanvas.jsx        <canvas> with imperative drawing in useEffect
├── CardinalLabels.jsx   N/S/E/W absolute-positioned labels
├── SelectionRing.jsx    Absolute div over hovered or selected object
├── SkyTooltip.jsx       Floating card with object data + source badge
└── SkyStatusOverlay.jsx Idle / loading / error overlay

client/src/__tests__/
├── projection.test.js
├── hitTest.test.js
├── drawing.test.js
├── useCanvasSize.test.jsx
├── SkyChart.test.jsx
└── SkyTooltip.test.jsx
```

### Modified files

```
client/src/components/hero/HeroRegion.jsx   Replace placeholder with SkyChart, update sizing
CLAUDE.md                                    Mark Phase 2b complete at end
SKYVAULT_ROADMAP.md                          Mark Phase 2b complete at end
```

---

## Part A — Pure Utility Functions (TDD)

### Task A1: Stereographic projection math

**Files:**
- Create: `client/src/utils/projection.js`
- Create: `client/src/__tests__/projection.test.js`

- [ ] **Step 1: Write the failing tests**

Create `client/src/__tests__/projection.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  projectAltAz,
  projectStars,
  projectPlanets,
  REFERENCE_ALT,
} from "../utils/projection.js";

describe("projectAltAz", () => {
  it("projects zenith (alt=90) to the rectangle center", () => {
    const result = projectAltAz({ alt: 90, az: 0 }, 800, 450);
    expect(result.x).toBeCloseTo(400, 5);
    expect(result.y).toBeCloseTo(225, 5);
  });

  it("projects due north (alt=0, az=0) above zenith along +y-up axis", () => {
    const { x, y } = projectAltAz({ alt: 0, az: 0 }, 800, 450);
    // North is "up" on the chart — canvas y decreases going up.
    expect(x).toBeCloseTo(400, 5);
    expect(y).toBeLessThan(225);
  });

  it("projects due east (alt=0, az=90) to the right of zenith", () => {
    const { x, y } = projectAltAz({ alt: 0, az: 90 }, 800, 450);
    expect(x).toBeGreaterThan(400);
    expect(y).toBeCloseTo(225, 5);
  });

  it("projects due west (alt=0, az=270) to the left of zenith", () => {
    const { x } = projectAltAz({ alt: 0, az: 270 }, 800, 450);
    expect(x).toBeLessThan(400);
  });

  it("at REFERENCE_ALT, radial distance equals half the shorter side", () => {
    const width = 800;
    const height = 450;
    const halfShort = Math.min(width, height) / 2; // 225
    const { x, y } = projectAltAz({ alt: REFERENCE_ALT, az: 0 }, width, height);
    const dy = Math.abs(y - height / 2);
    expect(dy).toBeCloseTo(halfShort, 3);
    expect(x).toBeCloseTo(width / 2, 5);
  });

  it("non-square rectangles keep zenith centered", () => {
    const r1 = projectAltAz({ alt: 90, az: 0 }, 1200, 675);
    expect(r1.x).toBeCloseTo(600, 5);
    expect(r1.y).toBeCloseTo(337.5, 5);

    const r2 = projectAltAz({ alt: 90, az: 0 }, 327, 245);
    expect(r2.x).toBeCloseTo(163.5, 5);
    expect(r2.y).toBeCloseTo(122.5, 5);
  });

  it("returns finite x,y for very low altitude at wide azimuth", () => {
    const { x, y } = projectAltAz({ alt: 1, az: 135 }, 800, 450);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("projectStars", () => {
  it("returns empty array for empty input", () => {
    expect(projectStars([], 800, 450)).toEqual([]);
  });

  it("attaches kind='star' and preserves source_id", () => {
    const stars = [
      {
        source_id: 4089383515393106688,
        alt: 45,
        az: 180,
        magnitude: 1.2,
        bp_rp: 0.4,
      },
    ];
    const projected = projectStars(stars, 800, 450);
    expect(projected).toHaveLength(1);
    expect(projected[0].kind).toBe("star");
    expect(projected[0].id).toBe("star:4089383515393106688");
    expect(projected[0].source_id).toBe(4089383515393106688);
    expect(typeof projected[0].x).toBe("number");
    expect(typeof projected[0].y).toBe("number");
  });
});

describe("projectPlanets", () => {
  it("attaches kind='planet' and namespaces id by name", () => {
    const planets = [
      { name: "Jupiter", alt: 40, az: 120, distance_au: 5.03 },
    ];
    const projected = projectPlanets(planets, 800, 450);
    expect(projected).toHaveLength(1);
    expect(projected[0].kind).toBe("planet");
    expect(projected[0].id).toBe("planet:Jupiter");
    expect(projected[0].name).toBe("Jupiter");
  });
});
```

- [ ] **Step 2: Run the tests and verify they all fail**

```bash
cd client
npm run test -- src/__tests__/projection.test.js
```

Expected: all tests fail with `Cannot find module '../utils/projection.js'` or similar.

- [ ] **Step 3: Implement `projection.js`**

Create `client/src/utils/projection.js`:

```js
/**
 * Stereographic projection from zenith.
 *
 * Given an altitude / azimuth pair in degrees, returns (x, y) pixel
 * coordinates inside a rectangle of size (width × height). The zenith
 * (alt=90°) maps to the rectangle center. An object at REFERENCE_ALT°
 * altitude maps to the shorter half-edge of the rectangle, so
 * everything from zenith down to REFERENCE_ALT fills the rectangle.
 *
 * Azimuth convention: 0° = north, 90° = east, 180° = south, 270° = west.
 * Canvas y increases downward, so north appears above zenith on screen.
 *
 * Phase 3+ will add new kinds (constellation_line, galaxy, comet). The
 * projection pipeline stays the same for any point object.
 */

export const REFERENCE_ALT = 20; // degrees — tune in one place

const DEG = Math.PI / 180;

export function projectAltAz({ alt, az }, width, height) {
  const zenithAngle = (90 - alt) * DEG;     // radians; 0 at zenith
  const r = Math.tan(zenithAngle / 2);      // stereographic radial distance

  const azRad = az * DEG;
  const xNorm = r * Math.sin(azRad);        // east positive
  const yNorm = -r * Math.cos(azRad);       // screen y down, north up

  const halfShort = Math.min(width, height) / 2;
  const refZenithAngle = (90 - REFERENCE_ALT) * DEG;
  const scale = halfShort / Math.tan(refZenithAngle / 2);

  return {
    x: width / 2 + xNorm * scale,
    y: height / 2 + yNorm * scale,
  };
}

export function projectStars(stars, width, height) {
  return stars.map((s) => {
    const { x, y } = projectAltAz(s, width, height);
    return {
      kind: "star",
      id: `star:${s.source_id}`,
      source_id: s.source_id,
      x,
      y,
      alt: s.alt,
      az: s.az,
      magnitude: s.magnitude,
      bp_rp: s.bp_rp,
      distance_ly: s.distance_ly,
      parallax_mas: s.parallax_mas,
      teff_k: s.teff_k,
      source: s.source ?? "Gaia DR3",
    };
  });
}

export function projectPlanets(planets, width, height) {
  return planets.map((p) => {
    const { x, y } = projectAltAz(p, width, height);
    return {
      kind: "planet",
      id: `planet:${p.name}`,
      name: p.name,
      x,
      y,
      alt: p.alt,
      az: p.az,
      distance_au: p.distance_au,
      phase_angle: p.phase_angle ?? null,
      illumination: p.illumination ?? null,
      phase_name: p.phase_name ?? null,
      source: p.source ?? "JPL DE421 via Astropy",
    };
  });
}
```

- [ ] **Step 4: Run the tests and verify they all pass**

```bash
npm run test -- src/__tests__/projection.test.js
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/projection.js client/src/__tests__/projection.test.js
git commit -m "feat(chart): stereographic projection utility + tests"
```

---

### Task A2: Hit testing for mouse events

**Files:**
- Create: `client/src/utils/hitTest.js`
- Create: `client/src/__tests__/hitTest.test.js`

- [ ] **Step 1: Write the failing tests**

Create `client/src/__tests__/hitTest.test.js`:

```js
import { describe, it, expect } from "vitest";
import { findNearestWithinRadius, STAR_RADIUS, PLANET_RADIUS } from "../utils/hitTest.js";

describe("findNearestWithinRadius", () => {
  it("returns null for empty projected array", () => {
    expect(findNearestWithinRadius([], 100, 100)).toBeNull();
  });

  it("returns null when no object is within radius", () => {
    const projected = [{ kind: "star", id: "star:1", x: 0, y: 0 }];
    expect(findNearestWithinRadius(projected, 500, 500)).toBeNull();
  });

  it("returns the star when cursor is inside its radius", () => {
    const projected = [{ kind: "star", id: "star:42", x: 100, y: 100 }];
    const hit = findNearestWithinRadius(projected, 105, 100);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe("star:42");
  });

  it("returns the nearer of two stars within radius", () => {
    const projected = [
      { kind: "star", id: "star:far", x: 100, y: 100 },
      { kind: "star", id: "star:near", x: 104, y: 100 },
    ];
    const hit = findNearestWithinRadius(projected, 105, 100);
    expect(hit.id).toBe("star:near");
  });

  it("planets have a larger effective radius than stars", () => {
    // At distance ~18px, a star (14px radius) would NOT match,
    // but a planet (22px radius) WILL match.
    const star = { kind: "star", id: "star:1", x: 100, y: 100 };
    const planet = { kind: "planet", id: "planet:Mars", x: 100, y: 100 };

    const starOnly = findNearestWithinRadius([star], 118, 100);
    expect(starOnly).toBeNull();

    const planetOnly = findNearestWithinRadius([planet], 118, 100);
    expect(planetOnly).not.toBeNull();
    expect(planetOnly.id).toBe("planet:Mars");
  });

  it("planet wins when cursor is inside planet radius, regardless of close star", () => {
    // At d=20, cursor is outside star radius (14) but inside planet radius (22).
    const projected = [
      { kind: "star", id: "star:close", x: 100, y: 100 },
      { kind: "planet", id: "planet:Mars", x: 100, y: 120 },
    ];
    const hit = findNearestWithinRadius(projected, 100, 120);
    expect(hit.id).toBe("planet:Mars");
  });

  it("exports radius constants", () => {
    expect(STAR_RADIUS).toBe(14);
    expect(PLANET_RADIUS).toBe(22);
  });
});
```

- [ ] **Step 2: Run the tests and verify they all fail**

```bash
npm run test -- src/__tests__/hitTest.test.js
```

Expected: all tests fail with module-not-found error.

- [ ] **Step 3: Implement `hitTest.js`**

Create `client/src/utils/hitTest.js`:

```js
/**
 * Hit testing for mouse/touch events on the sky chart.
 *
 * Linear scan over a pre-projected array of {kind, id, x, y, ...} objects.
 * Returns the nearest object within that kind's cursor radius, or null.
 *
 * At Phase 2b scale (~2000–3500 stars + ~10 planets), a linear scan is
 * ~2000 distance checks per mousemove — trivially fast. If we scale up
 * to 10k+ objects in v2 we'd bucket into a spatial grid.
 */

export const STAR_RADIUS = 14;   // pixels
export const PLANET_RADIUS = 22; // pixels (sparse, larger markers)

function radiusFor(kind) {
  return kind === "planet" ? PLANET_RADIUS : STAR_RADIUS;
}

export function findNearestWithinRadius(projected, mouseX, mouseY) {
  let best = null;
  let bestDistSq = Infinity;

  for (const obj of projected) {
    const r = radiusFor(obj.kind);
    const dx = obj.x - mouseX;
    const dy = obj.y - mouseY;
    const distSq = dx * dx + dy * dy;
    if (distSq > r * r) continue;
    if (distSq < bestDistSq) {
      best = obj;
      bestDistSq = distSq;
    }
  }

  return best;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm run test -- src/__tests__/hitTest.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/hitTest.js client/src/__tests__/hitTest.test.js
git commit -m "feat(chart): hit-test utility for canvas mouse events"
```

---

### Task A3: Drawing helpers (magnitudeToGlow)

**Files:**
- Create: `client/src/utils/drawing.js` (first pass: magnitudeToGlow only — canvas ops added in Part C)
- Create: `client/src/__tests__/drawing.test.js`

- [ ] **Step 1: Write the failing tests**

Create `client/src/__tests__/drawing.test.js`:

```js
import { describe, it, expect } from "vitest";
import { magnitudeToGlow } from "../utils/drawing.js";

describe("magnitudeToGlow", () => {
  it("brightest tier (mag <= 0) returns bold halo", () => {
    expect(magnitudeToGlow(-1.46)).toEqual({ core: 3.0, halo: 18 });
    expect(magnitudeToGlow(0)).toEqual({ core: 3.0, halo: 18 });
  });

  it("mag 0–2 tier returns medium halo", () => {
    expect(magnitudeToGlow(2)).toEqual({ core: 2.5, halo: 12 });
  });

  it("mag 2–4 tier returns smaller halo", () => {
    expect(magnitudeToGlow(4)).toEqual({ core: 2.0, halo: 6 });
  });

  it("mag 4–6 tier returns dim halo", () => {
    expect(magnitudeToGlow(6)).toEqual({ core: 1.5, halo: 3 });
  });

  it("mag > 6 clamps to pixel-dot tier (no halo)", () => {
    expect(magnitudeToGlow(6.5)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(10)).toEqual({ core: 1.0, halo: 0 });
  });

  it("interpolates linearly between breakpoints", () => {
    // Midway between mag 0 (core 3.0, halo 18) and mag 2 (core 2.5, halo 12)
    const { core, halo } = magnitudeToGlow(1);
    expect(core).toBeCloseTo(2.75, 5);
    expect(halo).toBeCloseTo(15, 5);
  });

  it("returns sane default for null/NaN magnitude", () => {
    expect(magnitudeToGlow(null)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(undefined)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(NaN)).toEqual({ core: 1.0, halo: 0 });
  });
});
```

- [ ] **Step 2: Run the tests and verify they all fail**

```bash
npm run test -- src/__tests__/drawing.test.js
```

Expected: all tests fail with module-not-found.

- [ ] **Step 3: Implement `drawing.js` (magnitudeToGlow only — canvas ops come later)**

Create `client/src/utils/drawing.js`:

```js
/**
 * Canvas drawing helpers for the sky chart.
 *
 * Pure functions: magnitudeToGlow (data → render spec).
 * Canvas operations (drawStar, drawPlanet) are added in a later task;
 * they receive a 2D context and are not pure, but their size/color
 * inputs come from magnitudeToGlow + bvToHex.
 */

// Calibration stops: [magnitude breakpoint, core px, halo px]
const STAR_GLOW_STOPS = [
  [0, 3.0, 18],
  [2, 2.5, 12],
  [4, 2.0, 6],
  [6, 1.5, 3],
];

const DIM_TIER = { core: 1.0, halo: 0 }; // mag > 6 or invalid

export function magnitudeToGlow(mag) {
  if (mag == null || !Number.isFinite(mag)) return { ...DIM_TIER };
  if (mag > 6) return { ...DIM_TIER };
  if (mag <= 0) return { core: STAR_GLOW_STOPS[0][1], halo: STAR_GLOW_STOPS[0][2] };

  for (let i = 0; i < STAR_GLOW_STOPS.length - 1; i++) {
    const [m0, c0, h0] = STAR_GLOW_STOPS[i];
    const [m1, c1, h1] = STAR_GLOW_STOPS[i + 1];
    if (mag >= m0 && mag <= m1) {
      const t = (mag - m0) / (m1 - m0);
      return {
        core: c0 + (c1 - c0) * t,
        halo: h0 + (h1 - h0) * t,
      };
    }
  }

  return { ...DIM_TIER };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm run test -- src/__tests__/drawing.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(chart): magnitudeToGlow helper for star sizing + tests"
```

---

## Part B — Canvas Size Hook

### Task B1: useCanvasSize

**Files:**
- Create: `client/src/hooks/useCanvasSize.js`
- Create: `client/src/__tests__/useCanvasSize.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/__tests__/useCanvasSize.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { useCanvasSize } from "../hooks/useCanvasSize.js";

// Minimal ResizeObserver mock — capture callback so tests can trigger it.
let resizeCallback = null;

class MockResizeObserver {
  constructor(cb) {
    resizeCallback = cb;
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  resizeCallback = null;
  global.ResizeObserver = MockResizeObserver;
  window.devicePixelRatio = 1;
});

afterEach(() => {
  delete global.ResizeObserver;
});

function Probe({ onSize }) {
  const ref = useRef(null);
  const size = useCanvasSize(ref);
  onSize(size);
  return (
    <div
      ref={ref}
      data-testid="probe"
      style={{ width: 800, height: 450 }}
    />
  );
}

describe("useCanvasSize", () => {
  it("returns zero size before ResizeObserver fires", () => {
    let latest = null;
    render(<Probe onSize={(s) => (latest = s)} />);
    expect(latest).toEqual({ width: 0, height: 0, dpr: 1 });
  });

  it("updates to observed dimensions and reflects DPR", () => {
    let latest = null;
    window.devicePixelRatio = 2;
    const { getByTestId } = render(<Probe onSize={(s) => (latest = s)} />);
    const el = getByTestId("probe");

    act(() => {
      resizeCallback([
        { target: el, contentRect: { width: 1200, height: 675 } },
      ]);
    });

    expect(latest.width).toBe(1200);
    expect(latest.height).toBe(675);
    expect(latest.dpr).toBe(2);
  });

  it("debounces rapid resize events (coalesces to final value)", async () => {
    vi.useFakeTimers();
    let latest = null;
    const { getByTestId } = render(<Probe onSize={(s) => (latest = s)} />);
    const el = getByTestId("probe");

    act(() => {
      resizeCallback([{ target: el, contentRect: { width: 500, height: 300 } }]);
      resizeCallback([{ target: el, contentRect: { width: 700, height: 400 } }]);
      resizeCallback([{ target: el, contentRect: { width: 900, height: 500 } }]);
    });

    // Before debounce fires, nothing updates
    expect(latest.width).toBe(0);

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(latest.width).toBe(900);
    expect(latest.height).toBe(500);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm run test -- src/__tests__/useCanvasSize.test.jsx
```

Expected: all tests fail with module-not-found.

- [ ] **Step 3: Implement `useCanvasSize.js`**

Create `client/src/hooks/useCanvasSize.js`:

```js
import { useEffect, useRef, useState } from "react";

/**
 * Observe a container ref's rendered size and the current devicePixelRatio.
 * Output is debounced 150ms so window drags don't thrash downstream consumers.
 *
 * Returns { width, height, dpr } in CSS pixels and raw DPR ratio.
 * width/height start at 0 and update once ResizeObserver fires.
 */
const DEBOUNCE_MS = 150;

export function useCanvasSize(ref) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  });
  const timerRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSize({ width, height, dpr });
      }, DEBOUNCE_MS);
    });
    ro.observe(el);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ro.disconnect();
    };
  }, [ref]);

  // Respond to DPR changes (multi-monitor drag) via matchMedia.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    const handler = () => {
      setSize((prev) => ({ ...prev, dpr: window.devicePixelRatio || 1 }));
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return size;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm run test -- src/__tests__/useCanvasSize.test.jsx
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useCanvasSize.js client/src/__tests__/useCanvasSize.test.jsx
git commit -m "feat(chart): useCanvasSize hook for DPR-aware responsive rendering"
```

---

## Part C — Canvas Drawing Functions

### Task C1: drawStar and drawPlanet

**Files:**
- Modify: `client/src/utils/drawing.js`
- Modify: `client/src/__tests__/drawing.test.js` (append new tests)

- [ ] **Step 1: Append failing tests to `drawing.test.js`**

Add to `client/src/__tests__/drawing.test.js` (below the existing `magnitudeToGlow` describe block):

```js
import { drawStar, drawPlanet } from "../utils/drawing.js";

function makeMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillRect: vi.fn(),
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalCompositeOperation(_) {},
  };
}

describe("drawStar", () => {
  it("draws a filled rect (1px) for dim stars with halo=0", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 7, bp_rp: null });
    expect(ctx.fillRect).toHaveBeenCalled();
    // No gradient for dim stars
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("draws a radial gradient halo for bright stars", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 400, y: 200, magnitude: -1.46, bp_rp: 0.02 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("drawPlanet", () => {
  it("draws planet marker with ring for non-Moon bodies", () => {
    const ctx = makeMockCtx();
    drawPlanet(ctx, { x: 400, y: 200, name: "Jupiter" });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("Moon uses custom path with illumination shadow", () => {
    const ctx = makeMockCtx();
    drawPlanet(ctx, {
      x: 400,
      y: 200,
      name: "Moon",
      illumination: 0.5,
      phase_name: "first quarter",
    });
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify drawStar/drawPlanet tests fail**

```bash
npm run test -- src/__tests__/drawing.test.js
```

Expected: the `drawStar` and `drawPlanet` describe blocks fail with `drawStar is not a function`. The `magnitudeToGlow` block still passes.

- [ ] **Step 3: Implement drawStar and drawPlanet**

Append to `client/src/utils/drawing.js`:

```js
import { bvToHex } from "./bvToColor.js";

// Planet marker sizes (diameter, px)
const PLANET_SIZES = {
  Sun: 16,
  Moon: 16,
  Venus: 12,
  Jupiter: 12,
  Mars: 11,
  Mercury: 10,
  Saturn: 10,
  Uranus: 10,
  Neptune: 10,
};

const PLANET_SIZE_DEFAULT = 10;

// Amber planet tint (matches Phase 2a accent theme).
const PLANET_CORE = "#ffd890";
const PLANET_MID = "#e8a968";
const PLANET_BORDER = "rgba(255, 216, 144, 0.4)";

// Sun gets a warmer disc distinct from nighttime planets.
const SUN_CORE = "#fff4c8";
const SUN_MID = "#ffd890";

export function drawStar(ctx, star) {
  const { x, y, magnitude, bp_rp } = star;
  const { core, halo } = magnitudeToGlow(magnitude);
  const color = bvToHex(bp_rp);

  if (halo === 0) {
    // Dim star: single pixel, no gradient.
    ctx.fillStyle = color;
    ctx.fillRect(x - core / 2, y - core / 2, core, core);
    return;
  }

  // Bright star: white core + tinted halo gradient.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(core / halo, hexToRgba(color, 0.85));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlanet(ctx, planet) {
  if (planet.name === "Moon") {
    drawMoon(ctx, planet);
    return;
  }
  if (planet.name === "Sun") {
    drawSun(ctx, planet);
    return;
  }

  const size = PLANET_SIZES[planet.name] ?? PLANET_SIZE_DEFAULT;
  const { x, y } = planet;
  const halo = size * 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, PLANET_CORE);
  gradient.addColorStop(size / halo, PLANET_MID);
  gradient.addColorStop(1, "rgba(232, 169, 104, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bordered ring on the disc itself.
  ctx.save();
  ctx.strokeStyle = PLANET_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx, planet) {
  const { x, y } = planet;
  const size = PLANET_SIZES.Sun;
  const halo = size * 2.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(size / halo, SUN_CORE);
  gradient.addColorStop(0.7, SUN_MID);
  gradient.addColorStop(1, "rgba(255, 216, 144, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx, planet) {
  const { x, y, illumination } = planet;
  const size = PLANET_SIZES.Moon;
  const r = size / 2;
  const frac = illumination ?? 1.0;

  // Filled disc.
  ctx.save();
  ctx.fillStyle = "#e8e3d6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Shadow arc representing the unlit fraction.
  if (frac < 0.98) {
    ctx.fillStyle = "rgba(5, 6, 13, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    // Clip a vertical ellipse from the center to the limb based on fraction.
    // Phase shape: a stretched oval overlaid to block the unlit side.
    const shadowWidth = r * 2 * (1 - frac);
    ctx.ellipse(
      x + r - shadowWidth / 2,
      y,
      shadowWidth / 2,
      r,
      0,
      0,
      Math.PI * 2,
      true
    );
    ctx.fill("evenodd");
  }

  // Subtle border.
  ctx.strokeStyle = "rgba(232, 227, 214, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Small utility: hex "#rrggbb" + alpha → "rgba(r,g,b,a)"
function hexToRgba(hex, alpha) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm run test -- src/__tests__/drawing.test.js
```

Expected: all tests pass (7 magnitudeToGlow + 2 drawStar + 2 drawPlanet = 11 total).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(chart): canvas drawing fns for stars, planets, Moon, Sun"
```

---

## Part D — Presentational Components

### Task D1: CardinalLabels

**Files:**
- Create: `client/src/components/hero/CardinalLabels.jsx`

- [ ] **Step 1: Create `CardinalLabels.jsx`**

```jsx
/**
 * Four fixed compass labels positioned at the rectangle edges.
 * North, South, East, West. Amber-muted monospace, consistent with
 * the Phase 2a type system.
 *
 * Pure presentational — no props. Parent positions this component
 * absolutely inside the chart container.
 */
export default function CardinalLabels() {
  const cls =
    "absolute font-mono text-[10px] uppercase tracking-[0.25em] text-accent-dim/80 pointer-events-none select-none";
  return (
    <>
      <span className={`${cls} left-1/2 top-3 -translate-x-1/2`}>N</span>
      <span className={`${cls} left-1/2 bottom-3 -translate-x-1/2`}>S</span>
      <span className={`${cls} right-3 top-1/2 -translate-y-1/2`}>E</span>
      <span className={`${cls} left-3 top-1/2 -translate-y-1/2`}>W</span>
    </>
  );
}
```

**Direction mapping (matches the spec's projection math):**

`projectAltAz` uses `xNorm = r * sin(az)`, so az=0° (N) → 0 and negative y (top of canvas); az=90° (E) → positive x (right); az=180° (S) → positive y (bottom); az=270° (W) → negative x (left). Labels are placed to match the pixels the math actually produces: N top, E right, S bottom, W left. This is the map/planisphere orientation documented in the spec (line 139, `// east positive`).

- [ ] **Step 2: Smoke render (no test file — covered by SkyChart tests)**

This component has no logic to unit-test. Its correctness is asserted via `SkyChart.test.jsx` in Part F.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/hero/CardinalLabels.jsx
git commit -m "feat(chart): CardinalLabels component (N/S/E/W on rectangle edges)"
```

---

### Task D2: SelectionRing

**Files:**
- Create: `client/src/components/hero/SelectionRing.jsx`

- [ ] **Step 1: Create `SelectionRing.jsx`**

```jsx
/**
 * Absolute-positioned HTML ring rendered over a hovered or selected
 * object on the sky chart. Pure CSS — avoids redrawing the canvas on
 * hover.
 *
 * Props:
 *   object: projected object ({x, y, kind}) or null
 *   variant: "hover" | "selected"
 */
export default function SelectionRing({ object, variant = "hover" }) {
  if (!object) return null;

  const baseSize = object.kind === "planet" ? 28 : 22;
  const opacity = variant === "selected" ? 0.85 : 0.45;
  const borderColor =
    variant === "selected"
      ? `rgba(232, 184, 109, ${opacity})`
      : `rgba(220, 225, 240, ${opacity})`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full"
      style={{
        left: object.x - baseSize / 2,
        top: object.y - baseSize / 2,
        width: baseSize,
        height: baseSize,
        border: `1px solid ${borderColor}`,
        boxShadow:
          variant === "selected"
            ? `0 0 12px 2px rgba(232, 184, 109, 0.25)`
            : undefined,
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/hero/SelectionRing.jsx
git commit -m "feat(chart): SelectionRing HTML overlay for hover/selection"
```

---

### Task D3: SkyTooltip + tests

**Files:**
- Create: `client/src/components/hero/SkyTooltip.jsx`
- Create: `client/src/__tests__/SkyTooltip.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/__tests__/SkyTooltip.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyTooltip from "../components/hero/SkyTooltip.jsx";

const container = { width: 1200, height: 675 };

describe("<SkyTooltip>", () => {
  it("renders nothing when object is null", () => {
    const { container: c } = render(
      <SkyTooltip object={null} container={container} />
    );
    expect(c.firstChild).toBeNull();
  });

  it("renders star tooltip with Gaia source_id and source badge", () => {
    const star = {
      kind: "star",
      id: "star:4089383515393106688",
      source_id: 4089383515393106688,
      x: 400,
      y: 300,
      magnitude: -1.46,
      bp_rp: 0.02,
      distance_ly: 8.6,
      alt: 42.1,
      az: 183.4,
      source: "Gaia DR3",
    };
    render(<SkyTooltip object={star} container={container} />);
    expect(screen.getByText(/Star/i)).toBeInTheDocument();
    expect(screen.getByText(/4089383515393106688/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.46/)).toBeInTheDocument();
    expect(screen.getByText(/0\.02/)).toBeInTheDocument();
    expect(screen.getByText(/8\.6 ly/)).toBeInTheDocument();
    expect(screen.getByText(/42\.1°/)).toBeInTheDocument();
    expect(screen.getByText(/183\.4°/)).toBeInTheDocument();
    expect(screen.getByText(/Source: Gaia DR3/)).toBeInTheDocument();
  });

  it("shows em-dash for missing distance or bp_rp on a star", () => {
    const star = {
      kind: "star",
      id: "star:1",
      source_id: 1,
      x: 400,
      y: 300,
      magnitude: 5.5,
      bp_rp: null,
      distance_ly: null,
      alt: 10,
      az: 20,
      source: "Gaia DR3",
    };
    render(<SkyTooltip object={star} container={container} />);
    // Two em dashes: color index, distance
    const dashes = screen.getAllByText(/—/);
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders planet tooltip with AU distance and JPL source", () => {
    const jupiter = {
      kind: "planet",
      id: "planet:Jupiter",
      name: "Jupiter",
      x: 400,
      y: 300,
      distance_au: 5.03,
      alt: 31.7,
      az: 124.9,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={jupiter} container={container} />);
    expect(screen.getByText(/Jupiter/)).toBeInTheDocument();
    expect(screen.getByText(/5\.03 AU/)).toBeInTheDocument();
    expect(screen.getByText(/31\.7°/)).toBeInTheDocument();
    expect(screen.getByText(/Source: JPL DE421 via Astropy/)).toBeInTheDocument();
  });

  it("renders Moon tooltip with illumination and phase", () => {
    const moon = {
      kind: "planet",
      id: "planet:Moon",
      name: "Moon",
      x: 400,
      y: 300,
      distance_au: 0.0026,
      alt: 60,
      az: 180,
      illumination: 0.5,
      phase_name: "first quarter",
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={moon} container={container} />);
    expect(screen.getByText(/Moon/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/first quarter/i)).toBeInTheDocument();
  });

  it("flips to left side when anchor is near the right edge", () => {
    const star = {
      kind: "star",
      id: "star:1",
      source_id: 1,
      x: 1180, // very close to right edge
      y: 300,
      magnitude: 1,
      bp_rp: 0.5,
      distance_ly: 10,
      alt: 45,
      az: 90,
      source: "Gaia DR3",
    };
    const { container: c } = render(
      <SkyTooltip object={star} container={container} />
    );
    const tooltip = c.firstChild;
    // Flipped tooltip places itself to the LEFT of the anchor,
    // so its computed `left` style should be less than anchor.x.
    const leftPx = parseFloat(tooltip.style.left);
    expect(leftPx).toBeLessThan(1180);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm run test -- src/__tests__/SkyTooltip.test.jsx
```

Expected: fails with module-not-found.

- [ ] **Step 3: Implement `SkyTooltip.jsx`**

Create `client/src/components/hero/SkyTooltip.jsx`:

```jsx
const TOOLTIP_W = 240;
const ANCHOR_OFFSET = 12;

function formatNumber(n, decimals) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function formatLy(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)} ly`;
}

function formatAu(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} AU`;
}

function formatDeg(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}°`;
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink-dim text-xs uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[13px] text-ink">{value}</span>
    </div>
  );
}

function StarBody({ object }) {
  return (
    <>
      <div className="mb-2">
        <p className="text-ink-dim text-[11px] uppercase tracking-[0.18em]">Star</p>
        <p className="font-mono text-[11px] text-ink-dim mt-0.5 break-all">
          Gaia DR3 · {object.source_id}
        </p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Magnitude" value={formatNumber(object.magnitude, 2)} />
        <Row label="Color index" value={formatNumber(object.bp_rp, 2)} />
        <Row label="Distance" value={formatLy(object.distance_ly)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}

function PlanetBody({ object }) {
  const isMoon = object.name === "Moon";
  return (
    <>
      <div className="mb-2">
        <p className="text-ink text-sm font-medium">{object.name}</p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Distance" value={formatAu(object.distance_au)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
        {isMoon && object.illumination != null && (
          <Row
            label="Illumination"
            value={`${Math.round(object.illumination * 100)}%`}
          />
        )}
        {isMoon && object.phase_name && (
          <Row label="Phase" value={object.phase_name} />
        )}
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}

/**
 * Floating object-details card anchored to a projected object on the sky.
 * Flips horizontally when it would overflow the container.
 *
 * Props:
 *   object    — projected object (or null to render nothing)
 *   container — { width, height } of the sky chart container (for edge flipping)
 */
export default function SkyTooltip({ object, container }) {
  if (!object) return null;

  const anchorX = object.x;
  const anchorY = object.y;

  // Default: anchor + 12px right, 12px up
  let left = anchorX + ANCHOR_OFFSET;
  let top = anchorY - ANCHOR_OFFSET;

  // Flip horizontally if we'd overflow
  if (left + TOOLTIP_W > container.width) {
    left = anchorX - ANCHOR_OFFSET - TOOLTIP_W;
  }
  // Clamp top to at least 0
  if (top < 0) top = 0;

  return (
    <div
      role="dialog"
      className="
        pointer-events-auto absolute z-20
        rounded-md border border-rule/60 bg-bg/95 backdrop-blur-sm
        p-3 shadow-lg
        animate-[fadeIn_120ms_ease-out]
      "
      style={{ left, top, width: TOOLTIP_W }}
    >
      {object.kind === "star" ? (
        <StarBody object={object} />
      ) : (
        <PlanetBody object={object} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
npm run test -- src/__tests__/SkyTooltip.test.jsx
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/SkyTooltip.jsx client/src/__tests__/SkyTooltip.test.jsx
git commit -m "feat(chart): SkyTooltip with star/planet/Moon variants + edge flip"
```

---

### Task D4: SkyStatusOverlay

**Files:**
- Create: `client/src/components/hero/SkyStatusOverlay.jsx`

- [ ] **Step 1: Create `SkyStatusOverlay.jsx`**

```jsx
import ErrorCard from "../ui/ErrorCard.jsx";

function errorMessage(error) {
  if (!error) return "Something went wrong.";
  if (error.status === 404 || error.status === 422) {
    return "Location could not be computed.";
  }
  if (error.status >= 500) {
    return "Sky computation failed. Please try again.";
  }
  if (error.status === 0) {
    return "Can't reach the server. Check your connection.";
  }
  return error.message || "Something went wrong.";
}

/**
 * Renders one of three overlay states on top of the sky canvas:
 *   - idle: no observer chosen yet
 *   - loading: a query is in flight (optionally showing the prior chart dimmed)
 *   - error: one of the queries failed
 *
 * Returns null for the success state (canvas + tooltip take over).
 *
 * Props:
 *   state: "idle" | "loading" | "error" | "ready"
 *   placeName?: string   (loading state display)
 *   error?: Error        (error state display)
 *   onRetry?: () => void (error state button)
 */
export default function SkyStatusOverlay({ state, placeName, error, onRetry }) {
  if (state === "ready") return null;

  const base =
    "absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none";

  if (state === "idle") {
    return (
      <div className={base}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Awaiting observer
        </p>
        <p className="font-serif italic text-ink text-lg md:text-xl">
          Pick a date and location
        </p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={`${base} animate-pulse`}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Computing sky
        </p>
        <p className="font-serif italic text-ink text-lg md:text-xl">
          for {placeName || "your location"}
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
        <ErrorCard message={errorMessage(error)} onRetry={onRetry} />
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify ErrorCard's actual prop interface matches**

Read `client/src/components/ui/ErrorCard.jsx` and adjust prop names on the SkyStatusOverlay side if needed.

```bash
cat client/src/components/ui/ErrorCard.jsx
```

If `ErrorCard` uses different prop names (e.g. `children` instead of `message`, or `retry` instead of `onRetry`), update `SkyStatusOverlay.jsx` to match. If `ErrorCard` does not exist or has a very different API, fall back to an inline error block:

```jsx
<div role="alert" className="rounded-md border border-danger/40 bg-bg p-4 max-w-sm">
  <p className="text-ink text-sm mb-3">{errorMessage(error)}</p>
  {onRetry && (
    <button
      onClick={onRetry}
      className="rounded border border-accent-dim/60 px-3 py-1 text-xs uppercase tracking-wider text-accent hover:text-ink"
    >
      Retry
    </button>
  )}
</div>
```

Pick whichever matches the existing component contract.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/hero/SkyStatusOverlay.jsx
git commit -m "feat(chart): SkyStatusOverlay (idle / loading / error states)"
```

---

## Part E — Canvas Component

### Task E1: SkyCanvas (imperative canvas drawing)

**Files:**
- Create: `client/src/components/hero/SkyCanvas.jsx`

- [ ] **Step 1: Create `SkyCanvas.jsx`**

```jsx
import { useEffect, useRef } from "react";
import { drawStar, drawPlanet } from "../../utils/drawing.js";

/**
 * Pure imperative canvas component.
 *
 *   props in → pixels out.
 *
 * No hit testing, no selection, no React children. Parent (SkyChart) passes
 * pre-projected star/planet arrays plus the container dimensions and DPR.
 *
 * Drawing happens in useEffect. Canvas is transparent — CSS gradient on the
 * container provides the sky background.
 */
export default function SkyCanvas({ projectedStars, projectedPlanets, width, height, dpr }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (width === 0 || height === 0) return;

    // Size the canvas buffer for DPR.
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Draw stars first (denser, form the backdrop), then planets on top.
    for (const s of projectedStars) {
      if (s.x < -32 || s.x > width + 32) continue;
      if (s.y < -32 || s.y > height + 32) continue;
      drawStar(ctx, s);
    }

    for (const p of projectedPlanets) {
      if (p.x < -32 || p.x > width + 32) continue;
      if (p.y < -32 || p.y > height + 32) continue;
      drawPlanet(ctx, p);
    }
  }, [projectedStars, projectedPlanets, width, height, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/hero/SkyCanvas.jsx
git commit -m "feat(chart): SkyCanvas imperative renderer (stars + planets)"
```

---

## Part F — Container + Integration

### Task F1: SkyChart container

**Files:**
- Create: `client/src/components/hero/SkyChart.jsx`

- [ ] **Step 1: Create `SkyChart.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { useSky } from "../../hooks/useSky.js";
import { usePlanets } from "../../hooks/usePlanets.js";
import { useCanvasSize } from "../../hooks/useCanvasSize.js";
import { projectStars, projectPlanets } from "../../utils/projection.js";
import { findNearestWithinRadius } from "../../utils/hitTest.js";
import SkyCanvas from "./SkyCanvas.jsx";
import CardinalLabels from "./CardinalLabels.jsx";
import SelectionRing from "./SelectionRing.jsx";
import SkyTooltip from "./SkyTooltip.jsx";
import SkyStatusOverlay from "./SkyStatusOverlay.jsx";

function statusFor({ selected, skyQuery, planetsQuery }) {
  if (!selected) return "idle";
  if (skyQuery.isError || planetsQuery.isError) return "error";
  if (skyQuery.isLoading || planetsQuery.isLoading) return "loading";
  if (skyQuery.data && planetsQuery.data) return "ready";
  return "loading";
}

export default function SkyChart() {
  const selected = useObserverStore((s) => s.selected);
  const datetimeUtc = useObserverStore((s) => s.datetimeUtc);

  const skyQuery = useSky(selected, datetimeUtc);
  const planetsQuery = usePlanets(selected, datetimeUtc);

  const containerRef = useRef(null);
  const { width, height, dpr } = useCanvasSize(containerRef);

  const projected = useMemo(() => {
    const stars = projectStars(skyQuery.data?.stars ?? [], width, height);
    const planets = projectPlanets(planetsQuery.data?.planets ?? [], width, height);
    return { stars, planets, all: [...stars, ...planets] };
  }, [skyQuery.data, planetsQuery.data, width, height]);

  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Clear hover + selection whenever data changes (positions have moved).
  useEffect(() => {
    setHoveredId(null);
    setSelectedId(null);
  }, [skyQuery.data, planetsQuery.data]);

  const hoveredObj = useMemo(
    () => projected.all.find((o) => o.id === hoveredId) ?? null,
    [hoveredId, projected.all]
  );
  const selectedObj = useMemo(
    () => projected.all.find((o) => o.id === selectedId) ?? null,
    [selectedId, projected.all]
  );

  const status = statusFor({ selected, skyQuery, planetsQuery });

  const getMouseCoords = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
  };

  const handleMouseMove = (e) => {
    if (status !== "ready") return;
    const coords = getMouseCoords(e);
    if (!coords) return;
    const hit = findNearestWithinRadius(projected.all, coords.mx, coords.my);
    setHoveredId(hit?.id ?? null);
  };

  const handleMouseLeave = () => setHoveredId(null);

  const handleClick = (e) => {
    if (status !== "ready") return;
    const coords = getMouseCoords(e);
    if (!coords) return;
    const hit = findNearestWithinRadius(projected.all, coords.mx, coords.my);
    setSelectedId(hit?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ariaLabel = selected
    ? `Night sky for ${selected.displayName} on ${datetimeUtc ?? ""}`
    : "Night sky chart";

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="absolute inset-0 cursor-default data-[hover=true]:cursor-pointer"
      data-hover={hoveredId != null ? "true" : "false"}
      style={{
        background:
          "radial-gradient(ellipse 60% 70% at 50% 45%, #0a1026 0%, #05070d 55%, #020308 100%)",
      }}
    >
      <SkyCanvas
        projectedStars={status === "ready" ? projected.stars : []}
        projectedPlanets={status === "ready" ? projected.planets : []}
        width={width}
        height={height}
        dpr={dpr}
      />

      {status === "ready" && <CardinalLabels />}

      <SelectionRing
        object={selectedObj ?? (selectedObj ? null : hoveredObj)}
        variant={selectedObj ? "selected" : "hover"}
      />

      <SkyTooltip object={selectedObj} container={{ width, height }} />

      <SkyStatusOverlay
        state={status}
        placeName={selected?.displayName}
        error={skyQuery.error || planetsQuery.error}
        onRetry={() => {
          skyQuery.refetch();
          planetsQuery.refetch();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/hero/SkyChart.jsx
git commit -m "feat(chart): SkyChart container orchestrating canvas + interactions"
```

---

### Task F2: Wire SkyChart into HeroRegion

**Files:**
- Modify: `client/src/components/hero/HeroRegion.jsx`

- [ ] **Step 1: Replace HeroRegion placeholder with SkyChart + new sizing**

Replace the entire contents of `client/src/components/hero/HeroRegion.jsx` with:

```jsx
import ExploreIn3DButton from "./ExploreIn3DButton.jsx";
import SkyChart from "./SkyChart.jsx";

/**
 * Hero region — rectangular skylight containing the 2D sky chart.
 *
 * Size clamps so the chart plus a peek of controls below fits
 * above-the-fold on common laptop viewports (no scrolling required).
 */
export default function HeroRegion() {
  return (
    <section
      className="
        relative w-full overflow-hidden border border-rule bg-bg/80
        h-[min(56.25vw,calc(100vh-14rem))]
        min-h-[260px]
      "
    >
      <SkyChart />

      {/* Explore-in-3D button stays visible in the corner. */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
        <ExploreIn3DButton />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Manual smoke test — start dev server and verify it renders**

```bash
cd client
npm run dev
```

Open http://localhost:5173 in a browser.

- Idle state: you should see "Awaiting observer / Pick a date and location" eyebrow
- Submit "Miami, 2026-04-13, 21:00 UTC" (use the controls strip below)
- Chart renders with stars and planets
- Hover over a bright star — ring appears
- Click it — tooltip appears with Gaia source_id, magnitude, distance, source badge
- Click empty sky — tooltip dismisses

If anything is broken, fix it before committing.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/hero/HeroRegion.jsx
git commit -m "feat(chart): mount SkyChart inside HeroRegion, apply viewport-cap sizing"
```

---

## Part G — Integration Tests

### Task G1: SkyChart component tests

**Files:**
- Create: `client/src/__tests__/SkyChart.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `client/src/__tests__/SkyChart.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SkyChart from "../components/hero/SkyChart.jsx";
import { useObserverStore } from "../stores/observerStore.js";

// Stub the data hooks so tests don't hit the network.
vi.mock("../hooks/useSky.js", () => ({
  useSky: vi.fn(),
}));
vi.mock("../hooks/usePlanets.js", () => ({
  usePlanets: vi.fn(),
}));

import { useSky } from "../hooks/useSky.js";
import { usePlanets } from "../hooks/usePlanets.js";

// Stub canvas since jsdom doesn't support 2D context drawing.
HTMLCanvasElement.prototype.getContext = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  arc: vi.fn(),
  beginPath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  ellipse: vi.fn(),
  fillRect: vi.fn(),
  set fillStyle(_) {},
  set strokeStyle(_) {},
  set lineWidth(_) {},
  set globalCompositeOperation(_) {},
});

// ResizeObserver mock that fires synchronously with a known size.
class MockRO {
  constructor(cb) { this.cb = cb; }
  observe(el) {
    this.cb([{ target: el, contentRect: { width: 800, height: 450 } }]);
  }
  disconnect() {}
}

function renderWithProviders(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function resetStore() {
  useObserverStore.getState().reset();
}

function mockQuery(overrides) {
  return {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetStore();
  global.ResizeObserver = MockRO;
  useSky.mockReturnValue(mockQuery({}));
  usePlanets.mockReturnValue(mockQuery({}));
  vi.useFakeTimers();
});

describe("<SkyChart>", () => {
  it("idle state renders 'Pick a date and location'", () => {
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Pick a date and location/i)).toBeInTheDocument();
  });

  it("loading state shows the selected place name", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(mockQuery({ isLoading: true }));
    usePlanets.mockReturnValue(mockQuery({ isLoading: true }));
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Computing sky/i)).toBeInTheDocument();
    expect(screen.getByText(/Miami, FL/)).toBeInTheDocument();
  });

  it("error state renders an error affordance and retry triggers refetches", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    const skyRefetch = vi.fn();
    const planetsRefetch = vi.fn();
    useSky.mockReturnValue(
      mockQuery({ isError: true, error: { status: 500 }, refetch: skyRefetch })
    );
    usePlanets.mockReturnValue(mockQuery({ refetch: planetsRefetch }));
    renderWithProviders(<SkyChart />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(skyRefetch).toHaveBeenCalled();
    expect(planetsRefetch).toHaveBeenCalled();
  });

  it("ready state renders cardinal labels N/S/E/W", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({ data: { observer: {}, stars: [], count: 0 } })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    renderWithProviders(<SkyChart />);
    // Advance debounce timer so canvas size flushes
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("N")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("click on an object shows the tooltip; click empty area dismisses it", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [
            {
              source_id: 42,
              ra: 0,
              dec: 0,
              alt: 90, // zenith → projects to container center (400, 225)
              az: 0,
              magnitude: -1.46,
              bp_rp: 0.02,
              distance_ly: 8.6,
              parallax_mas: 379,
              teff_k: 9940,
            },
          ],
        },
      })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });

    const root = container.querySelector("[role='img']");
    expect(root).toBeTruthy();

    // Simulate click at the projected zenith (400, 225 inside an 800×450 chart).
    // The container mock is 800×450 so center is 400,225.
    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    fireEvent.click(root, { clientX: 400, clientY: 225 });
    expect(screen.getByText(/Gaia DR3/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();

    // Click empty area — tooltip dismisses.
    fireEvent.click(root, { clientX: 10, clientY: 10 });
    expect(screen.queryByText(/Gaia DR3 · 42/)).not.toBeInTheDocument();
  });

  it("Escape keypress clears an active selection", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [
            { source_id: 7, ra: 0, dec: 0, alt: 90, az: 0, magnitude: 1, bp_rp: 0 },
          ],
        },
      })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    const root = container.querySelector("[role='img']");
    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    fireEvent.click(root, { clientX: 400, clientY: 225 });
    expect(screen.getByText(/Gaia DR3 · 7/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/Gaia DR3 · 7/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and confirm initial failures**

```bash
npm run test -- src/__tests__/SkyChart.test.jsx
```

Expected: tests run but some may fail if the canvas mock / ResizeObserver mock interact oddly. Iterate until all pass. No new code should be needed — only test-mock adjustments.

- [ ] **Step 3: Run full test suite to verify no regressions**

```bash
npm run test
```

Expected: all previous tests (52+) plus the new projection/hitTest/drawing/useCanvasSize/SkyTooltip/SkyChart tests pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/__tests__/SkyChart.test.jsx
git commit -m "test(chart): SkyChart integration tests (idle/loading/error/ready/select/dismiss)"
```

---

### Task G2: Lint pass

- [ ] **Step 1: Run lint**

```bash
cd client
npm run lint
```

Expected: zero errors, zero warnings.

- [ ] **Step 2: If lint finds issues, fix them**

Typical fixes: unused imports, missing React imports (shouldn't be needed with automatic runtime), JSX key warnings. Fix inline and re-run.

- [ ] **Step 3: If fixes were needed, commit them**

```bash
git add -A
git commit -m "refactor(chart): lint cleanup"
```

---

## Part H — Docs + Manual QA + Wrap

### Task H1: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Flip Phase 2b checkbox**

In `CLAUDE.md`, find the Phase Status section and change:

```
- [ ] **Phase 2b** — 2D Sky Chart: Canvas 2D stereographic projection inside the hero placeholder
```

to:

```
- [x] **Phase 2b** — 2D Sky Chart: Canvas 2D stereographic projection inside the hero placeholder
```

- [ ] **Step 2: Update "Resume Here — Next Session"**

Replace the Phase 2b-next block with:

```markdown
## Resume Here — Next Session

**Paused:** YYYY-MM-DD, Phase 2b complete.

**Current state:** Phase 1 + 2a + 2b are complete. The sky chart renders live inside the hero region — real Gaia DR3 stars (projected + drawn with magnitude/color-calibrated glow), real JPL DE421 planets (distinct amber markers, Moon with illumination shadow), cardinal labels, hover + click-to-tooltip, viewport-capped sizing.

**Next up:** Phase 3 — Constellations + Enrichment. IAU stick figures on the chart, SIMBAD + NASA Exoplanet Archive lookups triggered from the existing click-tooltip.
```

(Replace `YYYY-MM-DD` with the actual completion date.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): mark Phase 2b complete, update resume point for Phase 3"
```

---

### Task H2: Update SKYVAULT_ROADMAP.md

**Files:**
- Modify: `SKYVAULT_ROADMAP.md`

- [ ] **Step 1: Mark Phase 2b complete**

In `SKYVAULT_ROADMAP.md`:

**Edit 1:** Find the heading `## Phase 2b — 2D Sky Chart (Canvas 2D)` and append ` ✅ COMPLETE` so it reads `## Phase 2b — 2D Sky Chart (Canvas 2D) ✅ COMPLETE`.

**Edit 2:** Immediately below that heading (before the existing `**Goal:**` line) add a one-line shipped callout:

```markdown
> **Shipped:** rectangular full-bleed stereographic projection, star rendering with magnitude/color-calibrated glow, planet rendering with distinct amber markers, Moon with illumination shadow, cardinal labels, hover + click-to-tooltip progressive disclosure, viewport-capped sizing. See `docs/superpowers/specs/2026-04-13-phase-2b-sky-chart-design.md` and `docs/superpowers/plans/2026-04-13-phase-2b-sky-chart.md`.
```

Leave the rest of the Phase 2b section (goals, in-scope, out-of-scope, tasks) untouched — it is the historical record of what was planned.

- [ ] **Step 2: Commit**

```bash
git add SKYVAULT_ROADMAP.md
git commit -m "docs(roadmap): mark Phase 2b shipped, link spec + plan"
```

---

### Task H3: Manual smoke test checklist (documented pass)

Run these by hand before merging. This task documents what was checked.

- [ ] **Step 1: Start backend + frontend**

Backend (separate shell):
```bash
cd server
source .venv/Scripts/activate   # Windows bash
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd client
npm run dev
```

- [ ] **Step 2: Run through the manual checklist from the spec**

All items below should pass. If any fail, fix and re-run.

- Load with no data → idle overlay visible with "Pick a date and location"
- Submit "Miami, 2026-04-13, 21:00 UTC" (via controls strip) → chart renders
- Sirius is visible and the brightest object near the expected altitude (~45° at that time)
- Hover various stars → ring appears smoothly, no flicker
- Click Sirius → tooltip shows `Gaia DR3 · 2947050466531873024` (or similar), magnitude ≈ -1.46, source badge
- Click empty sky → tooltip dismisses
- Press Escape with a tooltip open → dismisses
- Resize window wide → narrow → layout smoothly, no blank frames
- Submit a new location (Portoviejo, Ecuador) → previous chart clears, new sky renders
- 1366×768 DevTools emulation → chart fits above-the-fold, controls peek below
- iPhone-width emulation (~390px) → chart usable, tooltip fits, tap works
- Select Moon → illumination and phase_name show in tooltip

- [ ] **Step 3: If issues, fix them and commit fixes**

Use conventional commit messages: `fix(chart): ...`.

---

### Task H4: Push the branch and open the PR

- [ ] **Step 1: Push (Andrew runs this himself from PowerShell — git push fails from Claude shell on Windows)**

```powershell
cd C:\Users\andre\skyvault
git push -u origin feat/phase-2b-sky-chart
```

- [ ] **Step 2: Open PR on GitHub**

Title: `Phase 2b — Canvas 2D sky chart`

Body (template):
```markdown
## Summary
- Replaces the Phase 2a HeroRegion placeholder with an interactive Canvas 2D sky chart
- Rectangular full-bleed stereographic projection — zenith at center, wide scale
- Real Gaia DR3 stars rendered with magnitude/color-calibrated glow
- Real JPL DE421 planets with distinct amber markers; Moon with illumination shadow
- Progressive disclosure interaction: clean on load, hover highlights, click tooltip
- Viewport-capped sizing so chart + peek of controls fit above the fold on laptops

## Test plan
- [x] Backend tests unchanged (52 passing)
- [x] Frontend tests: projection, hitTest, drawing, useCanvasSize, SkyTooltip, SkyChart (~20 new, full suite green)
- [x] Lint clean
- [x] Manual smoke test on desktop + mobile viewport

Spec: `docs/superpowers/specs/2026-04-13-phase-2b-sky-chart-design.md`
Plan: `docs/superpowers/plans/2026-04-13-phase-2b-sky-chart.md`
```

- [ ] **Step 3: Merge when approved, then delete the feature branch**

```powershell
# After merge
git checkout main
git pull origin main
git branch -d feat/phase-2b-sky-chart
```

---

## Summary

**Total tasks:** 19 (A1–A3, B1, C1, D1–D4, E1, F1–F2, G1–G2, H1–H4)
**New files:** 10 (3 utils + 1 hook + 6 components) + 6 test files
**Modified files:** 3 (`HeroRegion.jsx`, `CLAUDE.md`, `SKYVAULT_ROADMAP.md`)
**New dependencies:** 0
**Expected test count at end:** ~72 frontend (52 existing + ~20 new) + 52 backend unchanged
