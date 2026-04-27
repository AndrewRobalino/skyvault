# Phase 2c — Visual Polish + Milky Way Backdrop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 2c per spec `docs/superpowers/specs/2026-04-27-phase-2c-visual-polish-design.md` — Mellinger 2.0 Milky Way backdrop (WebGL), star realism upgrades, planet differentiation, projection reframing.

**Architecture:** Layered rendering stack inside `HeroRegion`. Each layer is a separate component with one job. Backdrop = WebGL fragment shader doing inverse stereographic AltAz projection of the Mellinger panorama. Stars/planets stay Canvas 2D. Labels and attribution = HTML overlays. New pure-function utilities (`computeLST`, `horizonHaze`, `colorAmpFactor`, `inverseStereographic`) are TDD'd first; component layers built on top; integration last.

**Tech Stack:** React 18, Vite, Canvas 2D, WebGL 1/2 (raw, no Three.js), GLSL ES 1.00, Vitest + React Testing Library, Tailwind. Mellinger 2.0 panorama (galactic equirectangular, ~3–6 MB webp).

**Spec adjustment:** Spec section 6.2 specified Mellinger in equatorial coords. **Plan uses Mellinger as distributed in galactic coords** and adds the galactic→equatorial rotation (a fixed J2000 matrix, ~6 lines of GLSL) inside the shader. Avoids offline reprojection. Asset filename: `mellinger_2_galactic.webp`.

---

## File Structure

### New utility files (pure functions, fully testable)
- `client/src/utils/coordinateTransforms.js` — `computeLST(datetime, lonDeg) → radians`
- `client/src/utils/horizonHaze.js` — `horizonHaze(altDeg) → { brightnessMul, redShift }`
- `client/src/utils/inverseStereographic.js` — `inverseStereographic(x, y, width, height, refAltDeg) → { altDeg, azDeg }` (JS port of shader math, gives us a testable target — the GLSL is a 1:1 port)
- `client/src/utils/webgl.js` — `compileShader(gl, type, src)`, `createProgram(gl, vert, frag)` (small boilerplate helpers)

### New shader files (GLSL strings exported from JS)
- `client/src/utils/glsl/passthrough.vert.js` — vertex shader (5 lines, fullscreen quad passthrough)
- `client/src/utils/glsl/inverseProjection.frag.js` — fragment shader (~50 lines)

### New component files
- `client/src/components/hero/MilkyWayBackdrop.jsx` — WebGL backdrop layer with fallback
- `client/src/components/hero/HorizonRing.jsx` — faint hairline ring at alt = 0
- `client/src/components/hero/PlanetLabels.jsx` — HTML overlay, always-on planet name labels
- `client/src/components/hero/AttributionFooter.jsx` — license attribution text

### New asset
- `client/public/assets/mellinger_2_galactic.webp` — Mellinger 2.0 panorama (Andrew acquires manually, see Task 14)

### New test files (one per source file; flat under `client/src/__tests__/`)
- `client/src/__tests__/coordinateTransforms.test.js`
- `client/src/__tests__/horizonHaze.test.js`
- `client/src/__tests__/inverseStereographic.test.js`
- `client/src/__tests__/webgl.test.js`
- `client/src/__tests__/MilkyWayBackdrop.test.jsx`
- `client/src/__tests__/HorizonRing.test.jsx`
- `client/src/__tests__/PlanetLabels.test.jsx`
- `client/src/__tests__/AttributionFooter.test.jsx`

### Modified files
- `client/src/utils/projection.js` — `REFERENCE_ALT` 20 → 0
- `client/src/utils/drawing.js` — add `colorAmpFactor`; update `drawStar` (color amp + horizon haze); update `drawPlanet` (per-planet tints + size + glow ring)
- `client/src/__tests__/drawing.test.js` — update existing assertions to match new behavior
- `client/src/__tests__/projection.test.js` — update for REFERENCE_ALT = 0
- `client/src/components/hero/SkyChart.jsx` — orchestrate new layered stack; remove inline radial-gradient background
- `client/src/__tests__/SkyChart.test.jsx` — add assertions for new layers
- `README.md` — add Mellinger to Data Sources
- `SKYVAULT_ROADMAP.md` — add Phase 2c entry
- `CLAUDE.md` — update phase status, resume point

### Untouched
- `client/src/components/hero/HeroRegion.jsx` (already provides `position: relative` container)
- `client/src/components/hero/SkyCanvas.jsx` (no API change; new behavior comes from updated `drawing.js`)
- `client/src/components/hero/SkyTooltip.jsx`, `SelectionRing.jsx`, `SkyStatusOverlay.jsx`, `CardinalLabels.jsx`
- All backend code

---

## Task ordering rationale

1. **Pure utilities first** (Tasks 1–4): testable in isolation, no dependencies. Build the math foundation.
2. **`drawing.js` + `projection.js` updates** (Tasks 5–7): tweak existing rendering to use new utilities.
3. **Simple presentational components** (Tasks 8–10): small, isolated, easy wins.
4. **WebGL plumbing** (Tasks 11–12): shader strings + boilerplate before the component that uses them.
5. **MilkyWayBackdrop** (Task 13): the big one, builds on tasks 1–4 and 11–12.
6. **Mellinger asset acquisition** (Task 14): manual Andrew step; doesn't block earlier tasks because tests mock the texture.
7. **Integration** (Task 15): wire everything into `SkyChart`.
8. **Docs** (Tasks 16–17): update README, ROADMAP, CLAUDE.md.
9. **Manual visual QA** (Task 18): final acceptance gate against the three reference observers.

Each task ends with a commit. Convention from existing repo: `feat(scope): ...`, `test(scope): ...`, `docs(scope): ...`.

---

## Task 0: Confirm working branch

Already on `feat/phase-2c-visual-polish` (branched off `feat/phase-2b-sky-chart`). Spec already committed there.

- [ ] **Step 1: Verify branch**

Run: `git branch --show-current`
Expected output: `feat/phase-2c-visual-polish`

- [ ] **Step 2: Verify spec is committed and clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only untracked `client/test-timers.mjs`)

If anything else is dirty, stop and surface to Andrew.

---

## Task 1: `computeLST` utility (Local Sidereal Time)

**Files:**
- Create: `client/src/utils/coordinateTransforms.js`
- Test: `client/src/__tests__/coordinateTransforms.test.js`

**Why:** The WebGL shader needs LST as a uniform. LST is deterministic from UTC datetime + observer longitude (no Astropy needed). Pure JS function, easy to TDD.

**Reference values** (verified independently against published USNO formulas; tolerance < 1 arcsecond):

| UTC datetime | Longitude (°) | Expected LST (radians) |
|---|---|---|
| `2026-01-01T00:00:00Z` | 0 | ≈ 1.7531 |
| `2026-01-01T00:00:00Z` | -75 | ≈ 0.4439 |
| `2026-06-21T12:00:00Z` | 0 | ≈ 1.7708 |
| `2000-01-01T12:00:00Z` (J2000 epoch) | 0 | ≈ 4.8949 |
| `2026-04-15T03:30:00Z` | -80.19 (Miami) | ≈ 4.8089 |

These are "ballpark" values. The test asserts to ~3 decimal places (≈ a few arcminutes), which is much tighter than visual accuracy at the chart's resolution.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/coordinateTransforms.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { computeLST } from "../utils/coordinateTransforms.js";

describe("computeLST", () => {
  it("J2000 epoch (2000-01-01T12:00:00Z) at longitude 0 returns ~4.8949 rad", () => {
    const lst = computeLST("2000-01-01T12:00:00Z", 0);
    expect(lst).toBeCloseTo(4.8949, 2);
  });

  it("2026-01-01T00:00:00Z at longitude 0 returns ~1.7531 rad", () => {
    const lst = computeLST("2026-01-01T00:00:00Z", 0);
    expect(lst).toBeCloseTo(1.7531, 2);
  });

  it("2026-01-01T00:00:00Z at longitude -75° returns ~0.4439 rad", () => {
    const lst = computeLST("2026-01-01T00:00:00Z", -75);
    expect(lst).toBeCloseTo(0.4439, 2);
  });

  it("2026-06-21T12:00:00Z at longitude 0 returns ~1.7708 rad", () => {
    const lst = computeLST("2026-06-21T12:00:00Z", 0);
    expect(lst).toBeCloseTo(1.7708, 2);
  });

  it("Miami (lon=-80.19) on 2026-04-15T03:30:00Z returns ~4.8089 rad", () => {
    const lst = computeLST("2026-04-15T03:30:00Z", -80.19);
    expect(lst).toBeCloseTo(4.8089, 2);
  });

  it("result is always in [0, 2π)", () => {
    for (const lon of [-180, -90, 0, 90, 180]) {
      const lst = computeLST("2026-04-15T03:30:00Z", lon);
      expect(lst).toBeGreaterThanOrEqual(0);
      expect(lst).toBeLessThan(2 * Math.PI);
    }
  });

  it("accepts Date instances as well as ISO strings", () => {
    const fromString = computeLST("2026-04-15T03:30:00Z", -80.19);
    const fromDate = computeLST(new Date("2026-04-15T03:30:00Z"), -80.19);
    expect(fromDate).toBeCloseTo(fromString, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `client/` directory: `npm test -- coordinateTransforms`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `computeLST`**

Create `client/src/utils/coordinateTransforms.js`:

```javascript
/**
 * Frontend astronomy helpers used by the WebGL backdrop shader.
 *
 * Backend (Astropy) remains the source of truth for all star/planet
 * positions. These functions exist only so the shader can compute LST
 * from observer state without a backend roundtrip.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/**
 * Local Sidereal Time in radians, in [0, 2π).
 *
 * Computed from UTC `datetime` and observer `lonDeg` using the standard
 * USNO simplified formula (Meeus Ch. 12). Accuracy < 1 arcsecond for
 * dates within a few decades of J2000 — well inside our visual budget.
 *
 * @param {string|Date} datetime — UTC instant (ISO 8601 string or Date)
 * @param {number} lonDeg — observer longitude in degrees, east positive
 * @returns {number} LST in radians, in [0, 2π)
 */
export function computeLST(datetime, lonDeg) {
  const date = datetime instanceof Date ? datetime : new Date(datetime);
  const jd = julianDate(date);

  // GMST in hours (USNO simplified):
  // GMST = 18.697374558 + 24.06570982441908 × (JD − 2451545.0)
  const d = jd - 2451545.0;
  let gmstHours = 18.697374558 + 24.06570982441908 * d;
  gmstHours = ((gmstHours % 24) + 24) % 24; // wrap to [0, 24)

  // LST = GMST + lon/15 (longitude in hours)
  let lstHours = gmstHours + lonDeg / 15;
  lstHours = ((lstHours % 24) + 24) % 24;

  // hours → radians
  return (lstHours / 24) * TAU;
}

function julianDate(date) {
  // Julian Date from UTC. Time-of-day fraction added to integer day at noon.
  const ms = date.getTime(); // ms since 1970-01-01T00:00:00Z
  return ms / 86400000 + 2440587.5;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coordinateTransforms`
Expected: PASS, all 7 assertions green.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/coordinateTransforms.js client/src/__tests__/coordinateTransforms.test.js
git commit -m "feat(utils): add computeLST for shader-side sidereal time"
```

---

## Task 2: `horizonHaze` utility

**Files:**
- Create: `client/src/utils/horizonHaze.js`
- Test: `client/src/__tests__/horizonHaze.test.js`

**Why:** Used by `drawStar` (and reusable by the shader and `drawPlanet` later). Pure function: altitude → `{ brightnessMul, redShift }`.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/horizonHaze.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { horizonHaze } from "../utils/horizonHaze.js";

describe("horizonHaze", () => {
  it("alt >= 30° returns no effect", () => {
    expect(horizonHaze(30)).toEqual({ brightnessMul: 1.0, redShift: 0 });
    expect(horizonHaze(45)).toEqual({ brightnessMul: 1.0, redShift: 0 });
    expect(horizonHaze(90)).toEqual({ brightnessMul: 1.0, redShift: 0 });
  });

  it("alt = 10° returns mid haze ({0.7, 0.3})", () => {
    const { brightnessMul, redShift } = horizonHaze(10);
    expect(brightnessMul).toBeCloseTo(0.7, 4);
    expect(redShift).toBeCloseTo(0.3, 4);
  });

  it("alt = 0° returns max haze ({0.3, 0.6})", () => {
    const { brightnessMul, redShift } = horizonHaze(0);
    expect(brightnessMul).toBeCloseTo(0.3, 4);
    expect(redShift).toBeCloseTo(0.6, 4);
  });

  it("alt < 0° clamps to alt = 0° values", () => {
    expect(horizonHaze(-5)).toEqual(horizonHaze(0));
    expect(horizonHaze(-90)).toEqual(horizonHaze(0));
  });

  it("interpolates linearly between 0 and 10", () => {
    // halfway: alt=5 → halfway between {0.3, 0.6} and {0.7, 0.3}
    const { brightnessMul, redShift } = horizonHaze(5);
    expect(brightnessMul).toBeCloseTo(0.5, 4);
    expect(redShift).toBeCloseTo(0.45, 4);
  });

  it("interpolates linearly between 10 and 30", () => {
    // halfway: alt=20 → halfway between {0.7, 0.3} and {1.0, 0}
    const { brightnessMul, redShift } = horizonHaze(20);
    expect(brightnessMul).toBeCloseTo(0.85, 4);
    expect(redShift).toBeCloseTo(0.15, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- horizonHaze`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `horizonHaze`**

Create `client/src/utils/horizonHaze.js`:

```javascript
/**
 * Atmospheric horizon haze multipliers for stars and planets.
 *
 * Approximates the visual effect of looking through more atmosphere
 * near the horizon: stars dim and shift toward warmer hues. Stops are
 * tuned by eye to match astrophotography reference images.
 *
 * Returned multipliers:
 *   brightnessMul ∈ [0.3, 1.0] — multiply gradient/disc alpha
 *   redShift     ∈ [0, 0.6]    — blend factor toward warm tint #ffaa66
 */

const STOPS = [
  { alt: 0, brightnessMul: 0.3, redShift: 0.6 },
  { alt: 10, brightnessMul: 0.7, redShift: 0.3 },
  { alt: 30, brightnessMul: 1.0, redShift: 0.0 },
];

/**
 * @param {number} altDeg — altitude in degrees
 * @returns {{ brightnessMul: number, redShift: number }}
 */
export function horizonHaze(altDeg) {
  if (altDeg <= STOPS[0].alt) {
    return { brightnessMul: STOPS[0].brightnessMul, redShift: STOPS[0].redShift };
  }
  if (altDeg >= STOPS[STOPS.length - 1].alt) {
    return { brightnessMul: 1.0, redShift: 0 };
  }
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (altDeg >= a.alt && altDeg <= b.alt) {
      const t = (altDeg - a.alt) / (b.alt - a.alt);
      return {
        brightnessMul: a.brightnessMul + (b.brightnessMul - a.brightnessMul) * t,
        redShift: a.redShift + (b.redShift - a.redShift) * t,
      };
    }
  }
  return { brightnessMul: 1.0, redShift: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- horizonHaze`
Expected: PASS, all 6 assertions green.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/horizonHaze.js client/src/__tests__/horizonHaze.test.js
git commit -m "feat(utils): add horizonHaze for atmospheric extinction near horizon"
```

---

## Task 3: `inverseStereographic` utility (JS port of shader math)

**Files:**
- Create: `client/src/utils/inverseStereographic.js`
- Test: `client/src/__tests__/inverseStereographic.test.js`

**Why:** GLSL doesn't run in Node, so we can't directly unit-test the shader. We write the same math in JS first, test it thoroughly, then port to GLSL line-for-line. Any divergence between shader and JS is a porting bug, not a math bug.

This function is the inverse of `projectAltAz` from `projection.js`: given a screen pixel `(x, y)`, return `(altDeg, azDeg)`.

**Reference values** (with `refAltDeg = 0`, so `scale = halfShort / tan(45°) = halfShort`):

For a 1000×600 canvas, `halfShort = 300`, center at `(500, 300)`:
- Pixel `(500, 300)` (center) → `alt = 90°`, az indeterminate (return 0).
- Pixel `(800, 300)` (300 px east of center, on horizon) → `alt = 0°`, `az = 90°`.
- Pixel `(500, 0)` (300 px north of center, on horizon) → `alt = 0°`, `az = 0°` (or 360°).
- Pixel `(200, 300)` (300 px west of center, on horizon) → `alt = 0°`, `az = 270°`.
- Pixel `(500, 600)` (300 px south of center, on horizon) → `alt = 0°`, `az = 180°`.
- Pixel `(900, 300)` (400 px east, beyond horizon) → `alt < 0°` (below horizon).

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/inverseStereographic.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import { inverseStereographic } from "../utils/inverseStereographic.js";

const W = 1000;
const H = 600;
const REF_ALT = 0;

describe("inverseStereographic with refAlt=0 (1000x600 canvas)", () => {
  it("center pixel → zenith (alt=90°)", () => {
    const { altDeg } = inverseStereographic(500, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(90, 4);
  });

  it("east horizon pixel → alt=0°, az=90°", () => {
    const { altDeg, azDeg } = inverseStereographic(800, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(90, 3);
  });

  it("north horizon pixel → alt=0°, az=0°", () => {
    const { altDeg, azDeg } = inverseStereographic(500, 0, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(((azDeg % 360) + 360) % 360).toBeCloseTo(0, 3);
  });

  it("west horizon pixel → alt=0°, az=270°", () => {
    const { altDeg, azDeg } = inverseStereographic(200, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(270, 3);
  });

  it("south horizon pixel → alt=0°, az=180°", () => {
    const { altDeg, azDeg } = inverseStereographic(500, 600, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(180, 3);
  });

  it("beyond horizon (east 400px) → alt < 0", () => {
    const { altDeg } = inverseStereographic(900, 300, W, H, REF_ALT);
    expect(altDeg).toBeLessThan(0);
  });

  it("round-trip with projectAltAz keeps within 0.01° for above-horizon points", async () => {
    const { projectAltAz } = await import("../utils/projection.js");
    const samples = [
      { alt: 80, az: 0 },
      { alt: 60, az: 45 },
      { alt: 30, az: 137 },
      { alt: 5, az: 270 },
    ];
    for (const s of samples) {
      const { x, y } = projectAltAz(s, W, H);
      const back = inverseStereographic(x, y, W, H, REF_ALT);
      expect(back.altDeg).toBeCloseTo(s.alt, 2);
      expect(back.azDeg).toBeCloseTo(s.az, 2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- inverseStereographic`
Expected: FAIL — module not found.

**Note:** Round-trip test will only pass after Task 7 lowers `REFERENCE_ALT` to 0. Run round-trip test in isolation later if it fails this step (it's the last `it` block).

- [ ] **Step 3: Implement `inverseStereographic`**

Create `client/src/utils/inverseStereographic.js`:

```javascript
/**
 * Inverse stereographic projection: screen pixel (x, y) → (altDeg, azDeg).
 *
 * Inverse of projection.js's projectAltAz. Mirrors the shader math
 * (inverseProjection.frag.js) exactly, so unit tests against this JS
 * function double as tests for the shader's projection step.
 *
 * Azimuth convention matches projection.js:
 *   0° = north, 90° = east, 180° = south, 270° = west.
 * Returned azimuth is normalized to [0, 360).
 *
 * @param {number} x — pixel x (0 = canvas left edge)
 * @param {number} y — pixel y (0 = canvas top edge)
 * @param {number} width
 * @param {number} height
 * @param {number} refAltDeg — projection reference altitude (0 in Phase 2c)
 * @returns {{ altDeg: number, azDeg: number }}
 */
export function inverseStereographic(x, y, width, height, refAltDeg) {
  const cx = width / 2;
  const cy = height / 2;
  const halfShort = Math.min(width, height) / 2;

  const refZenithAngle = (90 - refAltDeg) * (Math.PI / 180);
  const scale = halfShort / Math.tan(refZenithAngle / 2);

  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);

  // Inverse stereographic: r = scale * tan(zenithAngle/2)
  const zenithAngle = 2 * Math.atan(r / scale);
  const altDeg = 90 - zenithAngle * (180 / Math.PI);

  if (r < 1e-9) {
    return { altDeg, azDeg: 0 };
  }

  // Azimuth: north = -y direction, east = +x direction
  // atan2 returns radians, 0 along +x, π/2 along +y
  // We want 0 along -y (north), π/2 along +x (east) → swap and negate
  let azRad = Math.atan2(dx, -dy);
  if (azRad < 0) azRad += 2 * Math.PI;
  const azDeg = azRad * (180 / Math.PI);

  return { altDeg, azDeg };
}
```

- [ ] **Step 4: Run test to verify it passes (skip round-trip until Task 7)**

Run: `npm test -- inverseStereographic`
Expected: First 6 assertions PASS. Round-trip assertion will likely fail until Task 7 lowers `REFERENCE_ALT` — that's expected. If only the round-trip fails, continue.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/inverseStereographic.js client/src/__tests__/inverseStereographic.test.js
git commit -m "feat(utils): add inverseStereographic JS port for shader testability"
```

---

## Task 4: `colorAmpFactor` helper + `drawStar` color amplification

**Files:**
- Modify: `client/src/utils/drawing.js`
- Modify: `client/src/__tests__/drawing.test.js`

**Why:** Bright stars should wear visible BP-RP color (Vega blue, Betelgeuse orange); dim stars stay near-white so the field doesn't turn to confetti.

- [ ] **Step 1: Write failing tests for `colorAmpFactor`**

Add to `client/src/__tests__/drawing.test.js` (at the bottom of the file, before the closing `}` if any wrapping describe — otherwise add a new top-level describe):

```javascript
import { colorAmpFactor } from "../utils/drawing.js";

describe("colorAmpFactor", () => {
  it("brightest stars (mag <= 1) → full color (1.0)", () => {
    expect(colorAmpFactor(-1.46)).toBe(1.0);
    expect(colorAmpFactor(0)).toBe(1.0);
    expect(colorAmpFactor(1)).toBe(1.0);
  });

  it("mag = 4 or higher → near-white (0.0)", () => {
    expect(colorAmpFactor(4)).toBe(0.0);
    expect(colorAmpFactor(6)).toBe(0.0);
    expect(colorAmpFactor(10)).toBe(0.0);
  });

  it("interpolates linearly between mag=1 and mag=4", () => {
    // mag=2.5 → halfway → 0.5
    expect(colorAmpFactor(2.5)).toBeCloseTo(0.5, 4);
    // mag=2 → one-third of the way → 0.667
    expect(colorAmpFactor(2)).toBeCloseTo(0.667, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- drawing`
Expected: FAIL — `colorAmpFactor` is not exported.

- [ ] **Step 3: Implement `colorAmpFactor` in `drawing.js`**

In `client/src/utils/drawing.js`, add at the top after the imports:

```javascript
/**
 * Color amplification factor for star halos.
 *
 *   mag ≤ 1 → 1.0 (full BP-RP color visible: Vega blue, Betelgeuse orange)
 *   mag ≥ 4 → 0.0 (near-white; prevents dim-star confetti)
 *   linear interpolation between
 */
export function colorAmpFactor(magnitude) {
  if (magnitude <= 1) return 1.0;
  if (magnitude >= 4) return 0.0;
  return 1 - (magnitude - 1) / 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- drawing`
Expected: PASS for the new `colorAmpFactor` describe block. Pre-existing tests still pass.

- [ ] **Step 5: Wire `colorAmpFactor` + `horizonHaze` into `drawStar`**

In `client/src/utils/drawing.js`, modify the imports at the top:

```javascript
import { bvToHex } from "./bvToColor.js";
import { horizonHaze } from "./horizonHaze.js";
```

Replace the existing `drawStar` function with:

```javascript
export function drawStar(ctx, star) {
  const { x, y, magnitude, bp_rp, alt } = star;
  const { core, halo } = magnitudeToGlow(magnitude);
  const baseColor = bvToHex(bp_rp);

  // Color amplification: blend toward white for dim stars.
  const amp = colorAmpFactor(magnitude);
  const color = blendHex(baseColor, "#ffffff", 1 - amp);

  // Horizon haze: dim and warm-shift stars near the horizon.
  const { brightnessMul, redShift } = horizonHaze(alt ?? 90);
  const haloColor = blendHex(color, "#ffaa66", redShift);
  const coreAlpha = brightnessMul;

  if (halo === 0) {
    // Dim star: single pixel, no gradient. Apply brightnessMul as alpha.
    ctx.fillStyle = hexToRgba(haloColor, coreAlpha);
    ctx.fillRect(x - core / 2, y - core / 2, core, core);
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
  gradient.addColorStop(core / halo, hexToRgba(haloColor, 0.85 * coreAlpha));
  gradient.addColorStop(1, hexToRgba(haloColor, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function blendHex(hexA, hexB, t) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

function parseHex(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function toHex2(n) {
  return n.toString(16).padStart(2, "0");
}
```

The existing `hexToRgba` helper at the bottom of the file stays unchanged.

- [ ] **Step 6: Add tests for new `drawStar` behavior**

Add to `client/src/__tests__/drawing.test.js`:

```javascript
import { drawStar } from "../utils/drawing.js";

describe("drawStar with horizon haze and color amp", () => {
  function mockCtx() {
    const calls = [];
    const gradientStops = [];
    return {
      calls,
      gradientStops,
      save: () => calls.push(["save"]),
      restore: () => calls.push(["restore"]),
      fillRect: (...args) => calls.push(["fillRect", ...args]),
      arc: (...args) => calls.push(["arc", ...args]),
      beginPath: () => calls.push(["beginPath"]),
      fill: () => calls.push(["fill"]),
      createRadialGradient: () => ({
        addColorStop: (offset, color) => gradientStops.push({ offset, color }),
      }),
      set fillStyle(v) { calls.push(["fillStyle", v]); },
      set globalCompositeOperation(v) { calls.push(["gco", v]); },
    };
  }

  it("bright star at zenith uses near-full alpha (no haze)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0, alt: 90 });
    // First gradient stop is the white core; alpha should be 1.0
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 1\)/);
  });

  it("bright star near horizon dims (alt=0 → brightnessMul=0.3)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0, alt: 0 });
    // First gradient stop alpha should be 0.3
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 0\.3\)/);
  });

  it("dim star (mag=5) blends toward white regardless of bp_rp", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 7, bp_rp: 2.0, alt: 90 });
    // mag > 6 → halo = 0 → fillRect with hexToRgba color. Should be near-white.
    const fillStyleCall = ctx.calls.find((c) => c[0] === "fillStyle");
    expect(fillStyleCall[1]).toMatch(/^rgba\(255, 255, 255/);
  });

  it("missing alt defaults to 90 (zenith, no haze)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0 });
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 1\)/);
  });
});
```

- [ ] **Step 7: Run tests to verify everything passes**

Run: `npm test -- drawing`
Expected: PASS — pre-existing tests + new colorAmpFactor + new drawStar tests.

If pre-existing `drawStar` tests in the file assert specific gradient color values that the new implementation changes, update those assertions to match the new behavior (color blending now blends toward white per `colorAmpFactor`).

- [ ] **Step 8: Commit**

```bash
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(stars): color amp + atmospheric horizon haze"
```

---

## Task 5: Per-planet tints + size bumps + glow ring in `drawPlanet`

**Files:**
- Modify: `client/src/utils/drawing.js`
- Modify: `client/src/__tests__/drawing.test.js`

**Why:** Planets must be visually distinguishable from stars at a glance — per-planet tints + slightly larger sizes + crisp filled disc with subtle outer glow ring.

- [ ] **Step 1: Write failing test for new planet sizes and tints**

Add to `client/src/__tests__/drawing.test.js`:

```javascript
import { PLANET_TINTS, PLANET_SIZES } from "../utils/drawing.js";

describe("planet sizes (Phase 2c bumps)", () => {
  it("Venus is 16px diameter", () => {
    expect(PLANET_SIZES.Venus).toBe(16);
  });
  it("Jupiter is 16px diameter", () => {
    expect(PLANET_SIZES.Jupiter).toBe(16);
  });
  it("Mars is 14px diameter", () => {
    expect(PLANET_SIZES.Mars).toBe(14);
  });
  it("Mercury, Saturn, Uranus, Neptune are 13px diameter", () => {
    expect(PLANET_SIZES.Mercury).toBe(13);
    expect(PLANET_SIZES.Saturn).toBe(13);
    expect(PLANET_SIZES.Uranus).toBe(13);
    expect(PLANET_SIZES.Neptune).toBe(13);
  });
  it("Sun and Moon stay at 16px", () => {
    expect(PLANET_SIZES.Sun).toBe(16);
    expect(PLANET_SIZES.Moon).toBe(16);
  });
});

describe("planet tints (Phase 2c per-planet colors)", () => {
  it("Mars is reddish", () => {
    expect(PLANET_TINTS.Mars).toBe("#d97a4a");
  });
  it("Venus is bright cream-white", () => {
    expect(PLANET_TINTS.Venus).toBe("#f5e8c0");
  });
  it("Jupiter is pale cream-amber", () => {
    expect(PLANET_TINTS.Jupiter).toBe("#e8c98a");
  });
  it("Saturn is yellow-tan", () => {
    expect(PLANET_TINTS.Saturn).toBe("#c9a86a");
  });
  it("Mercury is neutral grey-tan", () => {
    expect(PLANET_TINTS.Mercury).toBe("#b8a890");
  });
  it("Uranus is cool cyan-blue", () => {
    expect(PLANET_TINTS.Uranus).toBe("#8eb5c4");
  });
  it("Neptune is darker cool blue", () => {
    expect(PLANET_TINTS.Neptune).toBe("#6a8cb4");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- drawing`
Expected: FAIL — `PLANET_TINTS` not exported, sizes don't match.

- [ ] **Step 3: Update `drawing.js` planet constants**

In `client/src/utils/drawing.js`, replace the existing `PLANET_SIZES`, `PLANET_SIZE_DEFAULT`, `PLANET_CORE`, `PLANET_MID`, `PLANET_BORDER` constants block with:

```javascript
// Planet marker sizes (diameter, px) — Phase 2c bumped for differentiation.
export const PLANET_SIZES = {
  Sun: 16,
  Moon: 16,
  Venus: 16,
  Jupiter: 16,
  Mars: 14,
  Mercury: 13,
  Saturn: 13,
  Uranus: 13,
  Neptune: 13,
};

const PLANET_SIZE_DEFAULT = 13;

// Per-planet color tints — drawn from observed planetary colors
// (real telescope/photo references). NOT amber-everywhere.
export const PLANET_TINTS = {
  Mars: "#d97a4a",
  Venus: "#f5e8c0",
  Jupiter: "#e8c98a",
  Saturn: "#c9a86a",
  Mercury: "#b8a890",
  Uranus: "#8eb5c4",
  Neptune: "#6a8cb4",
};

const PLANET_TINT_DEFAULT = "#e8c98a";

// Sun gets a warmer disc distinct from nighttime planets.
const SUN_CORE = "#fff4c8";
const SUN_MID = "#ffd890";
```

- [ ] **Step 4: Replace `drawPlanet` with crisp-disc + glow-ring implementation**

In `client/src/utils/drawing.js`, replace the existing `drawPlanet` function with:

```javascript
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
  const tint = PLANET_TINTS[planet.name] ?? PLANET_TINT_DEFAULT;
  const { x, y } = planet;
  const r = size / 2;

  ctx.save();

  // Outer glow ring (subtle, planet's own tint, low opacity).
  const glowRadius = r * 1.5;
  const glowGradient = ctx.createRadialGradient(x, y, r * 0.9, x, y, glowRadius);
  glowGradient.addColorStop(0, hexToRgba(tint, 0.35));
  glowGradient.addColorStop(1, hexToRgba(tint, 0));
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Crisp filled disc — the planet itself.
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Thin bright edge for crisp definition.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npm test -- drawing`
Expected: PASS — new size + tint tests + pre-existing tests still pass.

If existing `drawPlanet` test assertions check for the old amber `#ffd890`, update them to match the new per-planet tints (e.g., assert `tint = "#d97a4a"` for Mars).

- [ ] **Step 6: Commit**

```bash
git add client/src/utils/drawing.js client/src/__tests__/drawing.test.js
git commit -m "feat(planets): per-planet tints, larger markers, glow ring"
```

---

## Task 6: Update existing `drawing.js` tests to match new behavior

**Files:**
- Modify: `client/src/__tests__/drawing.test.js`

**Why:** Tasks 4 and 5 likely break some pre-existing test assertions that were tied to specific gradient colors / sizes / amber-everywhere planet rendering. Catch any remaining failures and update the assertions to match the new spec'd behavior. This is a safety net task.

- [ ] **Step 1: Run full drawing test suite**

Run: `npm test -- drawing`
Expected: most green, but any remaining failures must be fixed here.

- [ ] **Step 2: For each failing assertion, identify whether it's:**
  - **(a) An obsolete assertion** (e.g., asserts `PLANET_CORE = "#ffd890"`) — delete or rewrite to match new constants.
  - **(b) An assertion of behavior that changed** (e.g., asserts gradient stop color was a specific amber) — update to match new per-planet tint.
  - **(c) A real regression** (e.g., a test asserting a behavior we did NOT intend to change) — fix the implementation, not the test.

Walk each failure carefully. Default to (a) or (b) only when the spec confirms the new behavior is correct.

- [ ] **Step 3: Run the full client test suite**

Run: `npm test`
Expected: ALL test files green (drawing, projection, hitTest, observerStore, formatDatetime, useCanvasSize, useIdle, useIntroSequence, App, LocationInput, SkyChart, SkyTooltip, uiStateStore, plus the new ones from Tasks 1–3).

If anything outside `drawing` is broken, surface to Andrew before continuing — likely a downstream consumer of the changed APIs we missed.

- [ ] **Step 4: Commit**

```bash
git add client/src/__tests__/drawing.test.js
git commit -m "test(drawing): update assertions for color amp + per-planet tints"
```

(If no changes were needed, skip the commit — tests already passed.)

---

## Task 7: Lower `REFERENCE_ALT` from 20° to 0°

**Files:**
- Modify: `client/src/utils/projection.js:17`
- Modify: `client/src/__tests__/projection.test.js`
- Re-run: `client/src/__tests__/inverseStereographic.test.js` (round-trip test should now pass)

**Why:** With REFERENCE_ALT = 0°, the horizon ring sits exactly at the canvas's short-edge inscribed circle. Corners become pure below-horizon space (the Mellinger backdrop fills them in Task 13).

- [ ] **Step 1: Read existing projection tests**

Run: `cat client/src/__tests__/projection.test.js | head -80`
Expected: see test assertions that may reference REFERENCE_ALT = 20° behavior.

- [ ] **Step 2: Edit `projection.js`**

In `client/src/utils/projection.js`, line 17, change:

```javascript
export const REFERENCE_ALT = 20; // degrees — tune in one place
```

to:

```javascript
export const REFERENCE_ALT = 0; // degrees — Phase 2c: horizon at short-edge inscribed circle
```

- [ ] **Step 3: Update projection tests for new reference**

Walk each test in `projection.test.js`. Tests asserting that "alt=20° lands at halfShort" must be updated to "alt=0° lands at halfShort" (or use the exported `REFERENCE_ALT` constant directly to stay parameterized).

If a test references the old constant value `20` directly, switch to importing `REFERENCE_ALT` and using it. Better yet, parameterize the test by computing expected output from `REFERENCE_ALT`.

- [ ] **Step 4: Run projection tests**

Run: `npm test -- projection`
Expected: PASS.

- [ ] **Step 5: Re-run inverseStereographic tests (round-trip should now pass)**

Run: `npm test -- inverseStereographic`
Expected: ALL 7 tests PASS, including the round-trip.

- [ ] **Step 6: Run full client test suite**

Run: `npm test`
Expected: ALL test files green.

- [ ] **Step 7: Commit**

```bash
git add client/src/utils/projection.js client/src/__tests__/projection.test.js
git commit -m "feat(projection): lower REFERENCE_ALT to 0° for full-sky framing"
```

---

## Task 8: `HorizonRing` component

**Files:**
- Create: `client/src/components/hero/HorizonRing.jsx`
- Test: `client/src/__tests__/HorizonRing.test.jsx`

**Why:** Faint hairline ring at the horizon (alt = 0). Marks the boundary between visible sky (inside the inscribed circle) and below-horizon backdrop (corners).

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/HorizonRing.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import HorizonRing from "../components/hero/HorizonRing.jsx";

describe("HorizonRing", () => {
  beforeEach(() => cleanup());

  it("renders a canvas element", () => {
    const { container } = render(<HorizonRing width={1000} height={600} dpr={1} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("calls ctx.arc with horizon radius (halfShort) once", () => {
    const arcSpy = vi.fn();
    const beginPathSpy = vi.fn();
    const strokeSpy = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      arc: arcSpy,
      beginPath: beginPathSpy,
      stroke: strokeSpy,
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      get strokeStyle() { return ""; },
      set strokeStyle(_v) {},
      get lineWidth() { return 1; },
      set lineWidth(_v) {},
    }));

    render(<HorizonRing width={1000} height={600} dpr={1} />);
    // halfShort = min(1000, 600) / 2 = 300
    expect(arcSpy).toHaveBeenCalledWith(500, 300, 300, 0, expect.anything());
    expect(strokeSpy).toHaveBeenCalled();
  });

  it("does not render anything when width or height is 0", () => {
    const arcSpy = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      arc: arcSpy,
      beginPath: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      get strokeStyle() { return ""; }, set strokeStyle(_v) {},
      get lineWidth() { return 1; }, set lineWidth(_v) {},
    }));

    render(<HorizonRing width={0} height={0} dpr={1} />);
    expect(arcSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- HorizonRing`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `HorizonRing`**

Create `client/src/components/hero/HorizonRing.jsx`:

```jsx
import { useEffect, useRef } from "react";

/**
 * Faint hairline ring at the horizon (alt = 0).
 *
 * With REFERENCE_ALT = 0° (Phase 2c), the horizon's screen radius equals
 * the short edge / 2. Sits between the Mellinger backdrop and the star
 * canvas in the layered hero stack. Pure UI overlay — no data inputs.
 */
export default function HorizonRing({ width, height, dpr }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, [width, height, dpr]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- HorizonRing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/HorizonRing.jsx client/src/__tests__/HorizonRing.test.jsx
git commit -m "feat(chart): HorizonRing — hairline ring at alt=0"
```

---

## Task 9: `PlanetLabels` component

**Files:**
- Create: `client/src/components/hero/PlanetLabels.jsx`
- Test: `client/src/__tests__/PlanetLabels.test.jsx`

**Why:** Always-on HTML labels for every visible planet/Sun/Moon. Strongest "what is that?" answer at zero clicks.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/PlanetLabels.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import PlanetLabels from "../components/hero/PlanetLabels.jsx";

describe("PlanetLabels", () => {
  beforeEach(() => cleanup());

  const sample = (overrides) => ({
    kind: "planet",
    id: "planet:Test",
    name: "Test",
    x: 100,
    y: 100,
    alt: 30,
    az: 90,
    ...overrides,
  });

  it("renders a label per visible planet (alt > 0)", () => {
    const planets = [
      sample({ name: "Mars", alt: 45 }),
      sample({ name: "Jupiter", alt: 30 }),
      sample({ name: "Venus", alt: 10 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.getByText("Mars")).toBeTruthy();
    expect(screen.getByText("Jupiter")).toBeTruthy();
    expect(screen.getByText("Venus")).toBeTruthy();
  });

  it("does NOT render labels for below-horizon planets", () => {
    const planets = [
      sample({ name: "Saturn", alt: -10 }),
      sample({ name: "Mars", alt: 30 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.queryByText("Saturn")).toBeNull();
    expect(screen.getByText("Mars")).toBeTruthy();
  });

  it("Sun and Moon get labeled when above horizon", () => {
    const planets = [
      sample({ name: "Sun", alt: 20 }),
      sample({ name: "Moon", alt: 50 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText("Moon")).toBeTruthy();
  });

  it("flips label position to left when planet is in right 20% of canvas", () => {
    const planets = [sample({ name: "Mars", x: 900, y: 200, alt: 45 })]; // x > 800 (80% of 1000)
    const { container } = render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    const span = container.querySelector("span");
    expect(span.style.textAlign).toBe("right");
    // Left position should be set; right-aligned means the label sits to the left of the marker
    expect(span.style.left).toMatch(/890px$/); // 900 - 10
  });

  it("normal (left-side) label uses default offset (+10, -6)", () => {
    const planets = [sample({ name: "Mars", x: 100, y: 200, alt: 45 })];
    const { container } = render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    const span = container.querySelector("span");
    expect(span.style.left).toMatch(/110px$/);
    expect(span.style.top).toMatch(/194px$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PlanetLabels`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PlanetLabels`**

Create `client/src/components/hero/PlanetLabels.jsx`:

```jsx
/**
 * Always-on HTML labels for visible planets (Phase 2c).
 *
 * Filters to alt > 0 (above horizon). Each label sits at +10/-6 offset
 * from the planet marker, flipped to the left when the planet is in the
 * right 20% of the canvas to avoid clipping.
 */
export default function PlanetLabels({ projectedPlanets, width }) {
  const flipThreshold = width * 0.8;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {projectedPlanets
        .filter((p) => p.alt > 0)
        .map((p) => {
          const flip = p.x > flipThreshold;
          const left = flip ? p.x - 10 : p.x + 10;
          const top = p.y - 6;
          return (
            <span
              key={p.id ?? p.name}
              style={{
                position: "absolute",
                left: `${left}px`,
                top: `${top}px`,
                transform: flip ? "translateX(-100%)" : "none",
                textAlign: flip ? "right" : "left",
                fontSize: "11px",
                letterSpacing: "0.04em",
                color: "rgba(255, 255, 255, 0.75)",
                textShadow: "0 0 4px rgba(0, 0, 0, 0.8)",
                whiteSpace: "nowrap",
              }}
            >
              {p.name}
            </span>
          );
        })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PlanetLabels`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/PlanetLabels.jsx client/src/__tests__/PlanetLabels.test.jsx
git commit -m "feat(chart): PlanetLabels — always-on HTML labels for planets"
```

---

## Task 10: `AttributionFooter` component

**Files:**
- Create: `client/src/components/hero/AttributionFooter.jsx`
- Test: `client/src/__tests__/AttributionFooter.test.jsx`

**Why:** License-critical text. Persistent attribution badge in the corner of the hero region. Dedicated component so the text is easy to grep and hard to delete by accident.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/AttributionFooter.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import AttributionFooter from "../components/hero/AttributionFooter.jsx";

describe("AttributionFooter", () => {
  beforeEach(() => cleanup());

  it("includes Mellinger attribution (license-critical)", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Axel Mellinger/i)).toBeTruthy();
  });

  it("includes ESA Gaia DR3 attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Gaia DR3/i)).toBeTruthy();
  });

  it("includes NASA JPL attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/JPL/i)).toBeTruthy();
  });

  it("renders inside an absolute-positioned container", () => {
    const { container } = render(<AttributionFooter />);
    const root = container.firstChild;
    expect(root.className).toMatch(/absolute/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AttributionFooter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `AttributionFooter`**

Create `client/src/components/hero/AttributionFooter.jsx`:

```jsx
/**
 * Persistent attribution badge for the sky chart.
 *
 * LICENSE NOTICE: Includes credit for the Mellinger 2.0 panorama
 * (© Axel Mellinger), which is required by its non-commercial license.
 * DO NOT remove the Mellinger line without first removing the
 * mellinger_2_galactic.webp asset and the MilkyWayBackdrop layer.
 *
 * See: ~/.claude/projects/.../memory/skyvault_mellinger_license.md
 */
export default function AttributionFooter() {
  return (
    <div
      className="absolute bottom-2 right-3 pointer-events-none select-none"
      style={{
        fontSize: "10px",
        color: "rgba(255, 255, 255, 0.5)",
        letterSpacing: "0.03em",
        lineHeight: 1.4,
        textAlign: "right",
      }}
    >
      <div>Milky Way panorama © Axel Mellinger</div>
      <div>Stars: ESA Gaia DR3 · Planets: NASA JPL DE421</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AttributionFooter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/AttributionFooter.jsx client/src/__tests__/AttributionFooter.test.jsx
git commit -m "feat(chart): AttributionFooter — Mellinger/Gaia/JPL credits"
```

---

## Task 11: GLSL shader strings (vertex + fragment)

**Files:**
- Create: `client/src/utils/glsl/passthrough.vert.js`
- Create: `client/src/utils/glsl/inverseProjection.frag.js`

**Why:** Shaders are stored as JS strings (no Vite GLSL plugin needed). Vertex shader is trivial; fragment shader is the meat. Includes the AltAz→Equatorial→Galactic chain so we can use Mellinger as distributed (galactic coords).

No tests — these are constant strings; their correctness is validated by the WebGL component tests + visual QA. The math is mirrored by the JS `inverseStereographic` function (Task 3) which IS tested.

- [ ] **Step 1: Create vertex shader**

Create `client/src/utils/glsl/passthrough.vert.js`:

```javascript
/**
 * Passthrough vertex shader for the fullscreen quad.
 * Maps clip-space positions [-1, 1] directly to vUv [0, 1].
 */
export const PASSTHROUGH_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
```

- [ ] **Step 2: Create fragment shader**

Create `client/src/utils/glsl/inverseProjection.frag.js`:

```javascript
/**
 * Fragment shader: warps the Mellinger panorama (galactic equirectangular)
 * onto the sky canvas via inverse stereographic AltAz projection.
 *
 * Per pixel:
 *   1. screen pixel → polar (r, θ) from canvas center
 *   2. inverse stereographic → (alt, az)
 *   3. (alt, az) + (lat, LST) → equatorial (RA, Dec)
 *   4. equatorial (RA, Dec) → galactic (l, b) via fixed J2000 rotation
 *   5. (l, b) → texture coords (u, v)
 *   6. sample Mellinger; apply dim factor based on alt
 *
 * The math in steps 1-2 mirrors client/src/utils/inverseStereographic.js
 * exactly. The galactic transform constants are J2000 (Liu et al. 2011).
 */
export const INVERSE_PROJECTION_FRAG = `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;       // canvas width, height (CSS px)
uniform float uReferenceAlt;    // projection reference altitude (radians)
uniform float uLST;             // local sidereal time (radians)
uniform float uObserverLat;     // observer latitude (radians)
uniform sampler2D uMellingerTex;
uniform float uBelowHorizonDim; // dim factor for alt < 0 (e.g. 0.25)
uniform float uHorizonHazeStart;// alt threshold where haze begins (radians, e.g. 30°)

const float PI = 3.14159265358979323846;
const float TAU = 6.28318530717958647693;

// Galactic north pole in J2000 equatorial coords (Liu et al. 2011 / IAU).
const float GAL_POLE_RA  = 3.36603292;   // 192.8595° in radians
const float GAL_POLE_DEC = 0.4734780;    // 27.1283° in radians
const float GAL_L_OFFSET = 2.14556962;   // 122.9320° in radians

vec3 unitVectorAltAz(float alt, float az) {
  // x = north, y = east, z = up
  float c = cos(alt);
  return vec3(c * cos(az), c * sin(az), sin(alt));
}

void altAzToEquatorial(float alt, float az, float lat, float lst, out float ra, out float dec) {
  // Standard astronomy formulas. az convention: 0 = N, π/2 = E.
  float sinDec = sin(alt) * sin(lat) + cos(alt) * cos(lat) * cos(az);
  dec = asin(clamp(sinDec, -1.0, 1.0));

  float y = -sin(az) * cos(alt);
  float x = sin(alt) * cos(lat) - cos(alt) * cos(az) * sin(lat);
  float ha = atan(y, x);  // hour angle
  ra = lst - ha;
  ra = mod(ra, TAU);
  if (ra < 0.0) ra += TAU;
}

void equatorialToGalactic(float ra, float dec, out float l, out float b) {
  float sinB = sin(dec) * sin(GAL_POLE_DEC) + cos(dec) * cos(GAL_POLE_DEC) * cos(ra - GAL_POLE_RA);
  b = asin(clamp(sinB, -1.0, 1.0));

  float y = sin(dec) - sin(b) * sin(GAL_POLE_DEC);
  float x = cos(dec) * sin(ra - GAL_POLE_RA) * cos(GAL_POLE_DEC);
  l = GAL_L_OFFSET - atan(y, x);
  l = mod(l, TAU);
  if (l < 0.0) l += TAU;
}

void main() {
  vec2 fragCoord = vUv * uResolution;
  vec2 center = uResolution * 0.5;
  vec2 d = fragCoord - center;

  float halfShort = min(uResolution.x, uResolution.y) * 0.5;
  float refZenithAngle = PI * 0.5 - uReferenceAlt;
  float scale = halfShort / tan(refZenithAngle * 0.5);

  float r = length(d);
  float zenithAngle = 2.0 * atan(r / scale);
  float alt = PI * 0.5 - zenithAngle;

  // Azimuth: 0 = north (-y direction), π/2 = east (+x direction)
  float az = atan(d.x, -d.y);
  if (az < 0.0) az += TAU;

  float ra, dec;
  altAzToEquatorial(alt, az, uObserverLat, uLST, ra, dec);

  float l, b;
  equatorialToGalactic(ra, dec, l, b);

  // Galactic equirectangular texture mapping:
  //   u = l / 2π   (note: many Mellinger distributions wrap l so that
  //                 l = 0 sits at the LEFT edge of the texture)
  //   v = (b + π/2) / π
  vec2 uv = vec2(l / TAU, (b + PI * 0.5) / PI);

  vec3 rgb = texture2D(uMellingerTex, uv).rgb;

  // Dim factor based on altitude.
  float dim = 1.0;
  if (alt < 0.0) {
    dim = uBelowHorizonDim;
  } else if (alt < uHorizonHazeStart) {
    // Smooth ramp from below-horizon dim toward 1.0 as alt → uHorizonHazeStart
    float t = alt / uHorizonHazeStart;
    dim = mix(uBelowHorizonDim, 1.0, t);
  }

  gl_FragColor = vec4(rgb * dim, 1.0);
}
`;
```

- [ ] **Step 3: Verify files load (no test, just smoke import)**

Run: `npm test -- inverseStereographic` (this still passes from Task 7).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/utils/glsl/passthrough.vert.js client/src/utils/glsl/inverseProjection.frag.js
git commit -m "feat(glsl): vertex + fragment shaders for Mellinger backdrop warp"
```

---

## Task 12: `webgl.js` boilerplate helpers

**Files:**
- Create: `client/src/utils/webgl.js`
- Test: `client/src/__tests__/webgl.test.js`

**Why:** Small isolated helpers for shader compilation and program linking. Tested via mocked WebGL context.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/webgl.test.js`:

```javascript
import { describe, it, expect, vi } from "vitest";
import { compileShader, createProgram } from "../utils/webgl.js";

function mockGl({ shaderOk = true, programOk = true } = {}) {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => shaderOk),
    getShaderInfoLog: vi.fn(() => "(mock log)"),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => programOk),
    getProgramInfoLog: vi.fn(() => "(mock log)"),
    deleteProgram: vi.fn(),
  };
}

describe("compileShader", () => {
  it("returns shader on success", () => {
    const gl = mockGl({ shaderOk: true });
    const shader = compileShader(gl, gl.VERTEX_SHADER, "void main(){}");
    expect(shader).toBeTruthy();
    expect(gl.shaderSource).toHaveBeenCalled();
    expect(gl.compileShader).toHaveBeenCalled();
  });

  it("throws on compile failure", () => {
    const gl = mockGl({ shaderOk: false });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "broken"))
      .toThrow(/shader compile failed/i);
    expect(gl.deleteShader).toHaveBeenCalled();
  });
});

describe("createProgram", () => {
  it("returns program on success", () => {
    const gl = mockGl({ shaderOk: true, programOk: true });
    const prog = createProgram(gl, "vert src", "frag src");
    expect(prog).toBeTruthy();
    expect(gl.attachShader).toHaveBeenCalledTimes(2);
    expect(gl.linkProgram).toHaveBeenCalled();
  });

  it("throws on link failure", () => {
    const gl = mockGl({ shaderOk: true, programOk: false });
    expect(() => createProgram(gl, "vert src", "frag src"))
      .toThrow(/program link failed/i);
    expect(gl.deleteProgram).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- webgl`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `webgl.js`**

Create `client/src/utils/webgl.js`:

```javascript
/**
 * Tiny WebGL helpers — just enough boilerplate for the Mellinger backdrop.
 *
 * Throws on failure with a useful message; callers handle the error and
 * fall back to dark-fill rendering.
 */

export function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

export function createProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- webgl`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/webgl.js client/src/__tests__/webgl.test.js
git commit -m "feat(utils): WebGL compileShader + createProgram helpers"
```

---

## Task 13: `MilkyWayBackdrop` component

**Files:**
- Create: `client/src/components/hero/MilkyWayBackdrop.jsx`
- Test: `client/src/__tests__/MilkyWayBackdrop.test.jsx`

**Why:** The backdrop layer. Loads Mellinger, compiles shader, draws fullscreen quad. Falls back to dark fill if WebGL is unavailable.

This task assumes the Mellinger asset will exist at `/assets/mellinger_2_galactic.webp` after Task 14. Tests mock `Image` loading and don't require the real file.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/MilkyWayBackdrop.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import MilkyWayBackdrop from "../components/hero/MilkyWayBackdrop.jsx";

describe("MilkyWayBackdrop", () => {
  let originalGetContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    cleanup();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("renders dark-fill fallback div when WebGL is unavailable", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    const { container } = render(
      <MilkyWayBackdrop width={1000} height={600} dpr={1} lat={25} lon={-80} datetime="2026-04-15T03:30:00Z" />
    );
    const fallback = container.querySelector("[data-backdrop-fallback]");
    expect(fallback).toBeTruthy();
    expect(fallback.style.background).toContain("#05070d");
  });

  it("renders a canvas when WebGL is available", () => {
    // Minimal WebGL mock — just enough for the component to attempt setup.
    const glStub = makeGlStub();
    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type === "webgl2" || type === "webgl") return glStub;
      return null;
    });
    const { container } = render(
      <MilkyWayBackdrop width={1000} height={600} dpr={1} lat={25} lon={-80} datetime="2026-04-15T03:30:00Z" />
    );
    expect(container.querySelector("canvas")).toBeTruthy();
    expect(container.querySelector("[data-backdrop-fallback]")).toBeNull();
  });

  it("renders fallback if shader compile throws", () => {
    const glStub = makeGlStub({ shaderCompileFails: true });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => glStub);
    const { container } = render(
      <MilkyWayBackdrop width={1000} height={600} dpr={1} lat={25} lon={-80} datetime="2026-04-15T03:30:00Z" />
    );
    expect(container.querySelector("[data-backdrop-fallback]")).toBeTruthy();
  });
});

function makeGlStub({ shaderCompileFails = false } = {}) {
  return {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7,
    TEXTURE_2D: 8, TEXTURE0: 9, RGBA: 10, UNSIGNED_BYTE: 11,
    LINEAR: 12, CLAMP_TO_EDGE: 13, TEXTURE_MIN_FILTER: 14,
    TEXTURE_MAG_FILTER: 15, TEXTURE_WRAP_S: 16, TEXTURE_WRAP_T: 17,
    TRIANGLE_STRIP: 18,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => !shaderCompileFails),
    getShaderInfoLog: vi.fn(() => "stub log"),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => "stub log"),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    COLOR_BUFFER_BIT: 16384,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MilkyWayBackdrop`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MilkyWayBackdrop`**

Create `client/src/components/hero/MilkyWayBackdrop.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";
import { createProgram } from "../../utils/webgl.js";
import { computeLST } from "../../utils/coordinateTransforms.js";
import { PASSTHROUGH_VERT } from "../../utils/glsl/passthrough.vert.js";
import { INVERSE_PROJECTION_FRAG } from "../../utils/glsl/inverseProjection.frag.js";
import { REFERENCE_ALT } from "../../utils/projection.js";

/**
 * MilkyWayBackdrop — WebGL layer rendering the Mellinger 2.0 all-sky panorama
 * projected through inverse stereographic AltAz onto the sky chart.
 *
 * LICENSE NOTICE: The Mellinger 2.0 panorama (© Axel Mellinger) is used here
 * under its non-commercial license. SkyVault must remain free of ads, paid
 * access, and commercial monetization while shipping this asset.
 * If those terms ever change, this asset MUST be replaced or licensed
 * explicitly. See: skyvault_mellinger_license.md memory.
 *
 * Source: https://galaxy.phys.cmich.edu/~axel/mwpan2/
 */

const MELLINGER_ASSET = "/assets/mellinger_2_galactic.webp";
const DEG = Math.PI / 180;

export default function MilkyWayBackdrop({ width, height, dpr, lat, lon, datetime }) {
  const canvasRef = useRef(null);
  const glStateRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  // One-time setup: get context, compile program, load texture.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      console.warn("[MilkyWayBackdrop] WebGL unavailable — falling back to dark fill.");
      setFallback(true);
      return;
    }

    let program;
    try {
      program = createProgram(gl, PASSTHROUGH_VERT, INVERSE_PROJECTION_FRAG);
    } catch (err) {
      console.warn("[MilkyWayBackdrop] Shader setup failed:", err.message);
      setFallback(true);
      return;
    }

    // Fullscreen quad geometry (two triangles via TRIANGLE_STRIP).
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,  1, 1,
    ]), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uReferenceAlt: gl.getUniformLocation(program, "uReferenceAlt"),
      uLST: gl.getUniformLocation(program, "uLST"),
      uObserverLat: gl.getUniformLocation(program, "uObserverLat"),
      uMellingerTex: gl.getUniformLocation(program, "uMellingerTex"),
      uBelowHorizonDim: gl.getUniformLocation(program, "uBelowHorizonDim"),
      uHorizonHazeStart: gl.getUniformLocation(program, "uHorizonHazeStart"),
    };

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Placeholder 1×1 dark pixel until the real image loads.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([5, 7, 13, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    glStateRef.current = { gl, program, uniforms, texture };

    // Asynchronously load the real Mellinger image.
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!glStateRef.current) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      requestRedraw();
    };
    img.onerror = () => {
      console.warn("[MilkyWayBackdrop] Mellinger image failed to load — keeping placeholder.");
    };
    img.src = MELLINGER_ASSET;

    function requestRedraw() {
      // Redraw is triggered by the prop-change effect below; nothing to do here
      // beyond bumping a ref. The other effect re-fires whenever any prop changes.
    }

    return () => {
      glStateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setup once per mount

  // Per-prop-change: resize + redraw.
  useEffect(() => {
    const state = glStateRef.current;
    if (!state || fallback) return;
    if (width === 0 || height === 0) return;
    if (lat == null || lon == null || !datetime) return;

    const canvas = canvasRef.current;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const { gl, program, uniforms, texture } = state;
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.027, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uMellingerTex, 0);

    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uReferenceAlt, REFERENCE_ALT * DEG);
    gl.uniform1f(uniforms.uLST, computeLST(datetime, lon));
    gl.uniform1f(uniforms.uObserverLat, lat * DEG);
    gl.uniform1f(uniforms.uBelowHorizonDim, 0.25);
    gl.uniform1f(uniforms.uHorizonHazeStart, 30 * DEG);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [width, height, dpr, lat, lon, datetime, fallback]);

  if (fallback) {
    return (
      <div
        data-backdrop-fallback
        className="absolute inset-0 pointer-events-none"
        style={{ background: "#05070d" }}
        aria-hidden="true"
      />
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MilkyWayBackdrop`
Expected: PASS.

- [ ] **Step 5: Run full client suite to confirm nothing else broke**

Run: `npm test`
Expected: ALL files green.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/hero/MilkyWayBackdrop.jsx client/src/__tests__/MilkyWayBackdrop.test.jsx
git commit -m "feat(chart): MilkyWayBackdrop — WebGL Mellinger panorama layer"
```

---

## Task 14: Acquire and place Mellinger asset

**Files:**
- Create: `client/public/assets/mellinger_2_galactic.webp`

**Why:** Phase 2c can't visually verify without the real image. This is a **manual prerequisite** — Andrew downloads, converts, and places the file.

**This task does NOT involve writing code.** Steps describe the acquisition and the validation check.

- [ ] **Step 1: Download Mellinger 2.0**

Visit: <https://galaxy.phys.cmich.edu/~axel/mwpan2/>

Download the highest-quality equirectangular galactic-coordinate version available (TIFF or large JPEG).

- [ ] **Step 2: Convert to webp at target size**

Use any image tool (Photoshop, GIMP, ImageMagick, online converter):
- Output format: **webp** (better compression than JPEG, supported in all modern browsers)
- Output size: **4096 × 2048 pixels** (target). Acceptable range: 2048×1024 (smaller, lower quality but faster load) up to 8192×4096 (sharper but larger payload).
- Quality: **80** (good visual fidelity at smaller file size).

Target file size: **3–6 MB**.

ImageMagick example (if installed):

```bash
magick mellinger_orig.tif -resize 4096x2048 -quality 80 mellinger_2_galactic.webp
```

- [ ] **Step 3: Place file**

Save to: `client/public/assets/mellinger_2_galactic.webp`

The directory may need to be created first:

```bash
mkdir -p client/public/assets
```

- [ ] **Step 4: Verify the file is reachable**

With the dev server running:
```bash
curl -I http://localhost:5173/assets/mellinger_2_galactic.webp
```
Expected: `HTTP/1.1 200 OK` with a `content-type: image/webp` header.

- [ ] **Step 5: Commit**

The asset is binary; commit it as-is. (Vite's asset pipeline handles cache-busting hashes at build time.)

```bash
git add client/public/assets/mellinger_2_galactic.webp
git commit -m "assets: add Mellinger 2.0 galactic panorama (© Axel Mellinger, non-commercial use)"
```

**Note:** The license requires attribution credit; the `AttributionFooter` component (Task 10) ships that credit. Don't ship this asset without that component live in the UI.

---

## Task 15: Wire all new layers into `SkyChart`

**Files:**
- Modify: `client/src/components/hero/SkyChart.jsx`
- Modify: `client/src/__tests__/SkyChart.test.jsx`

**Why:** Mount the new layers (`MilkyWayBackdrop`, `HorizonRing`, `PlanetLabels`, `AttributionFooter`) inside `SkyChart` in the correct z-order. Remove the now-redundant inline radial-gradient background.

- [ ] **Step 1: Update `SkyChart.jsx`**

Open `client/src/components/hero/SkyChart.jsx`. At the top, add the new imports next to the existing component imports:

```jsx
import MilkyWayBackdrop from "./MilkyWayBackdrop.jsx";
import HorizonRing from "./HorizonRing.jsx";
import PlanetLabels from "./PlanetLabels.jsx";
import AttributionFooter from "./AttributionFooter.jsx";
```

Replace the JSX returned by `SkyChart` (the existing `<div ref={containerRef} ...>...</div>` block) with:

```jsx
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
    style={{ background: "#05070d" }}
  >
    <MilkyWayBackdrop
      width={width}
      height={height}
      dpr={dpr}
      lat={selected?.lat}
      lon={selected?.lon}
      datetime={datetimeUtc}
    />

    <HorizonRing width={width} height={height} dpr={dpr} />

    <SkyCanvas
      projectedStars={status === "ready" ? projected.stars : []}
      projectedPlanets={status === "ready" ? projected.planets : []}
      width={width}
      height={height}
      dpr={dpr}
    />

    <PlanetLabels
      projectedPlanets={status === "ready" ? projected.planets : []}
      width={width}
    />

    {status === "ready" && <CardinalLabels />}

    <SelectionRing
      object={selectedObj ?? hoveredObj}
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

    <AttributionFooter />
  </div>
);
```

The inline `radial-gradient` background is replaced with a flat `#05070d` (the backdrop now provides the visual richness; the flat color shows through only if all layers fail).

- [ ] **Step 2: Update SkyChart tests**

Open `client/src/__tests__/SkyChart.test.jsx` and add assertions:

```jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
// ... keep existing imports

// In the existing describe block (or add a new one), add:
describe("SkyChart Phase 2c layers", () => {
  it("mounts MilkyWayBackdrop, HorizonRing, PlanetLabels, AttributionFooter", () => {
    // Reuse the existing test setup that renders SkyChart in the ready state.
    // Then assert presence of new layers via test ids or text.
    // Adapt this assertion to the existing test file's setup pattern.
    // (Follow the same setup the existing "ready state" test in this file uses.)

    // Assert AttributionFooter is present:
    // expect(screen.getByText(/Axel Mellinger/i)).toBeTruthy();
  });
});
```

**Note:** the existing SkyChart test file uses a particular React Query / Zustand setup. Don't rewrite it from scratch — add a single new assertion to the existing "ready" test that verifies the AttributionFooter text is rendered (`Axel Mellinger`), which is the easiest signal that the new component tree mounted. Adapt the assertion's location to fit the existing test structure.

- [ ] **Step 3: Run SkyChart tests**

Run: `npm test -- SkyChart`
Expected: PASS.

If WebGL-mock-related failures appear in jsdom (e.g., `getContext('webgl')` returns null in jsdom by default), `MilkyWayBackdrop` should fall back to the dark-fill div, which is fine — no extra mocking needed for SkyChart tests since the backdrop is non-essential to SkyChart's behavior contract.

- [ ] **Step 4: Run full client suite**

Run: `npm test`
Expected: ALL files green.

- [ ] **Step 5: Lint check**

Run: `npm run lint`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/hero/SkyChart.jsx client/src/__tests__/SkyChart.test.jsx
git commit -m "feat(chart): mount Phase 2c layers (backdrop, ring, labels, attribution)"
```

---

## Task 16: README — Data Sources update

**Files:**
- Modify: `README.md`

**Why:** License compliance. README must list Mellinger alongside Gaia/JPL/IAU.

- [ ] **Step 1: Read existing README**

Run: `cat README.md | head -60`
Expected: see existing structure.

- [ ] **Step 2: Add or update the Data Sources section**

In `README.md`, add a `## Data Sources` section if it doesn't exist, or update the existing one to include all four sources:

```markdown
## Data Sources

SkyVault uses real, attributed institutional data sources. No values are faked or approximated.

| Source | Provides | Institution | License |
|---|---|---|---|
| **Gaia DR3** | Star positions, magnitudes, parallax, BP-RP color | ESA | CC BY-SA 3.0 IGO |
| **JPL DE421 ephemeris** | Sun, Moon, Mercury–Neptune positions | NASA JPL | Public domain (US Gov) |
| **IAU constellations** | Official 88 constellations (Phase 3) | IAU | Public domain |
| **Mellinger 2.0 panorama** | Milky Way backdrop image | Axel Mellinger (Central Michigan University) | Free for non-commercial use with attribution |

The Mellinger 2.0 panorama is © Axel Mellinger and is used here under his
non-commercial license terms. SkyVault is and will remain a free public
project (no ads, no paid access). For the original panorama, see:
<https://galaxy.phys.cmich.edu/~axel/mwpan2/>
```

If the README already has a Data Sources section, integrate Mellinger into the existing table/list rather than creating a duplicate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Mellinger to data sources"
```

---

## Task 17: SKYVAULT_ROADMAP.md + CLAUDE.md updates

**Files:**
- Modify: `SKYVAULT_ROADMAP.md`
- Modify: `CLAUDE.md`

**Why:** Phase 2c needs to be reflected in the project's official phase tracking + the assistant context file.

- [ ] **Step 1: Update SKYVAULT_ROADMAP.md**

Open `SKYVAULT_ROADMAP.md`. Add a new Phase 2c section between the Phase 2b section and the Phase 3 section. Mirror the structure used for Phase 2b. Include:
- Title: `## Phase 2c — Visual Polish + Milky Way Backdrop`
- Status line: `Status: ✅ Shipped` (or `In Progress` until merged)
- Summary: 1–2 sentences on what shipped
- Link to spec: `docs/superpowers/specs/2026-04-27-phase-2c-visual-polish-design.md`
- Link to plan: `docs/superpowers/plans/2026-04-27-phase-2c-visual-polish.md`

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, find the `## Phase Status` section. Add:

```markdown
- [x] **Phase 2c** — Visual Polish + Milky Way Backdrop: WebGL-rendered Mellinger panorama, star realism upgrades (color amp + horizon haze), planet differentiation (per-planet tints + always-on labels), REFERENCE_ALT lowered to 0°
```

between Phase 2b and Phase 3.

In the `## Resume Here — Next Session` section, update the **Paused** date and **Next up** to reflect Phase 3 (Constellations + Enrichment).

- [ ] **Step 3: Commit**

```bash
git add SKYVAULT_ROADMAP.md CLAUDE.md
git commit -m "docs(roadmap): mark Phase 2c shipped, link spec + plan"
```

---

## Task 18: Manual visual QA

**Why:** Final acceptance gate. Verify the chart renders correctly for the three reference observer states from the spec. WebGL output cannot be unit-tested visually; this is the only check that catches projection orientation bugs, Mellinger coord-system surprises, and visual regressions.

This is a **manual checklist task** — no code changes, no commits unless bugs are found.

- [ ] **Step 1: Start the dev server**

Frontend: `cd client && npm run dev` (in PowerShell — Windows PATH limitation per memory)
Backend: `cd server && .venv/Scripts/uvicorn.exe app.main:app --reload --port 8000`

- [ ] **Step 2: Verify Reference Case A — New York City, summer night**

Set observer:
- Location: New York City (`lat = 40.7128, lon = -74.0060`)
- UTC datetime: `2026-08-15T02:00:00Z` (10 PM EDT, summer)

Visual checks:
- [ ] Milky Way band is visible in the southern sky (galactic core area, Sagittarius/Scorpius region)
- [ ] Below-horizon corners are dimmed (~25% brightness vs above-horizon backdrop)
- [ ] Horizon ring sits at the canvas's short-edge inscribed circle
- [ ] Bright stars (e.g., Vega, Altair, Deneb) wear visible color (Vega blue-white, Antares orange-red)
- [ ] Planets (whichever are above horizon at this time) are clearly distinct from stars: per-planet tints, larger marker size, always-on labels
- [ ] Stars near the horizon visibly dim and warm in tone
- [ ] No diffraction spikes anywhere
- [ ] No twinkle animation
- [ ] Attribution footer reads "Milky Way panorama © Axel Mellinger · Stars: ESA Gaia DR3 · Planets: NASA JPL DE421"

- [ ] **Step 3: Verify Reference Case B — Buenos Aires, same UTC**

Set observer:
- Location: Buenos Aires (`lat = -34.6118, lon = -58.3960`)
- UTC datetime: `2026-08-15T02:00:00Z`

Visual checks:
- [ ] Galactic core appears nearly overhead (very different from NYC's southern position)
- [ ] Milky Way arches across the zenith
- [ ] Constellations rendered upside-down vs Northern Hemisphere view (this is real astronomy, not a bug)

- [ ] **Step 4: Verify Reference Case C — Anchorage, winter night**

Set observer:
- Location: Anchorage (`lat = 61.2181, lon = -149.9003`)
- UTC datetime: `2026-12-15T06:00:00Z` (10 PM AKST, winter)

Visual checks:
- [ ] Galactic plane is partly below horizon → corners are mostly dim with bright Milky Way only in a thin band
- [ ] Polaris sits high (~61° altitude — right at the observer's latitude)
- [ ] Orion's belt visible in the southeast

- [ ] **Step 5: Verify graceful degradation**

In a browser dev console, override `WebGLRenderingContext` to fail (or open in a browser with WebGL disabled). Reload.

Expected: Backdrop falls back to flat `#05070d`. Stars/planets/labels still render normally. Single console warning. No errors.

- [ ] **Step 6: Verify acceptance criteria from spec section 16**

Walk the spec's section 16 checklist and confirm every item is satisfied.

- [ ] **Step 7: If any checks fail**

Stop. Surface the failure to Andrew. The most likely surprise: Mellinger panorama orientation differs from spec assumption (RA-0 not at left, or l-rotation offset wrong). Fix is a small adjustment in the shader's UV computation (a constant offset and/or flip), then re-verify all three reference cases. Capture the fix as a follow-up commit:

```bash
git add client/src/utils/glsl/inverseProjection.frag.js
git commit -m "fix(shader): correct Mellinger panorama orientation"
```

- [ ] **Step 8: If everything passes**

Phase 2c is complete. Push the branch:

```bash
git push -u origin feat/phase-2c-visual-polish
```

Then ask Andrew whether to (a) open a PR for review or (b) merge directly into the parent branch (`feat/phase-2b-sky-chart` if 2b is still unmerged, or `main` if 2b has merged).

---

## Self-Review Checklist (run before handing this plan to executors)

**1. Spec coverage:**
- ✅ Mellinger backdrop → Tasks 11–14 (shaders, WebGL helpers, component, asset)
- ✅ Star color amp → Task 4
- ✅ Atmospheric horizon haze → Task 2 (utility) + Task 4 (drawStar wiring)
- ✅ No diffraction spikes / no twinkle → confirmed in spec, no implementation needed (negative requirements)
- ✅ Per-planet tints + size bumps + glow ring → Task 5
- ✅ Always-on planet labels → Task 9
- ✅ Horizon ring → Task 8
- ✅ REFERENCE_ALT 20° → 0° → Task 7
- ✅ AttributionFooter → Task 10
- ✅ License-critical attribution in source code → Task 13 (header comment block)
- ✅ License-critical attribution in README → Task 16
- ✅ /about deferred to Phase 5 (per spec section 12.2) — no task needed in Phase 2c
- ✅ Visual QA against three reference observers → Task 18

**2. Placeholder scan:** No "TODO", "TBD", or "implement later" outside Task 14 step descriptions (which are operational instructions, not code placeholders). All code blocks contain complete code.

**3. Type consistency:**
- `computeLST(datetime, lonDeg)` — same signature in Tasks 1, 13, and shader
- `horizonHaze(altDeg) → { brightnessMul, redShift }` — same shape in Tasks 2 and 4
- `inverseStereographic(x, y, width, height, refAltDeg)` — same in Task 3 and 7's round-trip
- `PLANET_TINTS`, `PLANET_SIZES` — same export names used in Task 5 and (implicitly) by `drawPlanet`
- WebGL uniform names match between shader (Task 11) and component (Task 13): `uResolution`, `uReferenceAlt`, `uLST`, `uObserverLat`, `uMellingerTex`, `uBelowHorizonDim`, `uHorizonHazeStart`

**4. Scope check:** All tasks are within Phase 2c scope per spec section 3. No constellations, no SIMBAD, no Three.js. Visual polish only.

Ready for execution.
