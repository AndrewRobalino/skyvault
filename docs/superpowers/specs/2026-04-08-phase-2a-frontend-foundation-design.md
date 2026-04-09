# Phase 2a — Frontend Foundation (Design Spec)

**Date:** 2026-04-08
**Author:** Andrew Robalino Garcia (product + design direction) with Claude (brainstorming facilitator)
**Status:** Design locked. Awaiting author review before implementation plan is written.
**Supersedes:** The "Phase 2 — Star Map Rendering" section of `SKYVAULT_ROADMAP.md` and the "Why Three.js over D3/Canvas2D?" key decision — both revised as part of this spec. The repo-root `CLAUDE.md`'s "Phase Status" and "Resume Here — Next Session" sections are also updated by this plan.

---

## 1. Summary

Phase 2a delivers the SkyVault frontend foundation: a Vite + React + Tailwind scaffold with a dark galactic themed layout shell, the ESO Gigagalaxy Zoom Milky Way as a full-viewport permanent background, a controls form with global place-name geocoding, a styled results list displaying real Gaia DR3 + JPL DE421 data from the Phase 1 backend, and an intro animation + idle-aware chrome state machine.

**No sky chart rendering this session.** The hero region is a reserved empty slot with a "coming soon" placeholder and a disabled `EXPLORE IN 3D →` stub button. The 2D Canvas stereographic sky disc arrives in Phase 2b (next session). The Three.js 3D "Explore Mode" is deferred to Phase 4.

One backend addition is required to make the frontend functional: a `GET /api/v1/geocode` proxy endpoint for the Photon OSM-based geocoder. Everything else in Phase 2a is frontend work.

---

## 2. Context and Rationale

### 2.1 The Canvas 2D vs Three.js pivot

The original `SKYVAULT_ROADMAP.md` committed to Three.js 3D celestial sphere rendering for Phase 2 and included a "Why Three.js over D3/Canvas2D?" decision justifying that choice. This spec reverses that decision for v1 rendering and moves Three.js to Phase 4.

**Reasons for the pivot:**

1. **Andrew's validated design reference is a 2D disc.** The Charlotte mock at `C:\Users\andre\Downloads\charlotte_sky_2002_09_19.html` (which Andrew approved as the aesthetic direction) IS a 2D Canvas stereographic projection. Every element he liked — the editorial feel, the hover tooltip pattern, the info panel stack, the "sky chart you could frame" character — is native to the 2D paradigm.
2. **Snapshot download is a stated product feature.** `canvas.toDataURL('image/png')` is trivial in Canvas 2D (~5 lines). Three.js requires `preserveDrawingBuffer: true` (perf cost), explicit camera framing for the snapshot, and additional plumbing.
3. **Casual-user friendliness.** Canvas 2D has no camera controls to learn. Three.js requires drag-to-rotate + scroll-to-zoom + touch support, plus onboarding for users who don't intuit 3D navigation.
4. **Milky Way background compatibility.** A flat Milky Way panorama reads cleanly behind a 2D disc. In Three.js it would require an equirectangular HDR skybox on an inverted sphere — a separate research track and additional asset pipeline.
5. **Mobile performance.** 170k stars via `THREE.Points` on a mid-range phone is feasible but not free. Canvas 2D with a magnitude-filtered subset (typically ~1500 stars at mag < 5) is trivial on any device.

**The "both modes" resolution:** Andrew explicitly wanted both a 2D default and a 3D explore mode. We agreed to do them **sequentially**, not in parallel:

- **Phase 2a (this session):** frontend foundation + controls + results list (no chart)
- **Phase 2b (next session):** 2D Canvas stereographic sky disc in the hero region
- **Phase 4 (later):** Three.js 3D mode activated from the stub button placed this session

Honest cost estimate for shipping both modes: ~1.5x the frontend work of either alone (not 2x — coordinate pipeline, color/size mapping, data fetching, and controls form are shared). Building them in parallel would 2-3x the time-to-first-ship and double the testing burden. Sequential is the disciplined choice.

### 2.2 Phase renumbering

The roadmap's original "Phase 1 frontend" was scoped as "Vite + React + Tailwind scaffold, input form, console.log the API responses, no rendering yet." That minimal scope was never built. Instead, the frontend foundation has been expanded to include the full themed shell, intro animation, idle state machine, and styled results list. This expanded scope doesn't fit under "Phase 1 frontend" or under "Phase 2 rendering" cleanly, so we're naming it **Phase 2a — Frontend Foundation**. The sky chart render becomes **Phase 2b — 2D Sky Chart**.

### 2.3 Design reference

The Charlotte mock (`C:\Users\andre\Downloads\charlotte_sky_2002_09_19.html`) remains the aesthetic reference for editorial/atlas feel, but this spec departs from it in two deliberate ways:

1. **Palette shifted cool** — Charlotte uses warm gold (`#d4a847`) on cream over near-black. This spec uses a cool off-white ink (`#dce1f0`) with a restrained amber accent (`#e8b86d`) because the Milky Way backdrop is dominantly cool and Charlotte's warm gold would fight it visually.
2. **Layout switched from left/right to vertical stack** — Charlotte uses a two-column grid (1fr + 280px aside). This spec uses a vertical stack (hero → controls → info rows) because (a) Andrew explicitly requested a bigger sky region than a 280px aside can contain, (b) vertical layout collapses trivially on mobile without a breakpoint rewrite, (c) the sky chart gets the full stage without visual competition from side panels.

Font pairing (Cormorant Garamond italic serif + JetBrains Mono) is preserved from Charlotte — it's the right editorial/scientific voice for this product.

---

## 3. Scope

### 3.1 In-scope for Phase 2a

**Frontend scaffolding:**
- Vite + React 18 + Tailwind CSS project under `client/`
- ESLint + Prettier configuration
- Vitest + React Testing Library + jsdom for tests

**Visual shell:**
- Framed layout with gold corner brackets (max-width 1280px centered)
- Dark galactic palette (see §5.1) wired through `tailwind.config.js`
- Cormorant Garamond + JetBrains Mono via Google Fonts
- ESO Gigagalaxy Zoom Milky Way as full-viewport permanent background with opacity ~0.28 and a radial vignette overlay
- Header with centered eyebrow + italic serif title + metadata subhead
- Footer with attribution row

**Controls form:**
- Location text input with placeholder `"City, country (e.g., Portoviejo, Ecuador)"`
- "📍 Use my location" button (browser geolocation API)
- Native date picker with `min="1900-01-01"` and `max="2100-12-31"` attributes
- Optional time input (native `<input type="time">`)
- Timezone selector (Local / UTC toggle)
- Submit button with loading state
- "Did you mean..." candidate dropdown after geocode submit

**Hero region (placeholder this session):**
- Full-width 16:9 aspect ratio container (4:3 on mobile)
- "Coming soon" placeholder text
- Disabled `EXPLORE IN 3D →` stub button with "coming soon" badge
- Reserved for Phase 2b sky chart

**Info panels (post-submit results):**
- Row 1: 2-column grid on desktop, stacked on mobile
  - `<LunarPanel>` — Moon phase (SVG), illumination %, rise/set
  - `<PlanetsPanel>` — Mercury through Neptune with AltAz, distance, source badge
- Row 2 (full width):
  - `<StarsPanel>` — Top 30 brightest visible stars by magnitude, with name/designation, AltAz, magnitude, BP-RP color, distance (ly), source badge

**Intro animation + idle state machine:**
- Session-gated intro (sessionStorage flag, `?replay` URL override)
- Respects `prefers-reduced-motion`
- Black → galaxy fade-in → content fade-in → user interacts → active state
- Idle detection on mousemove / mousedown / keydown / touchstart / scroll
- Two visual states on every component: NORMAL and GLASS
- Transitions: idle ~15s → GLASS, further idle ~5s → HIDDEN, any input → NORMAL
- `visibilitychange` pauses the timer, does not replay intro
- Focused form input counts as active regardless of idle timer

**State management:**
- `observerStore` (Zustand) — `rawQuery`, `candidates`, `selected`, `date`, `time`, `datetimeUtc`, `submitted`
- `uiStateStore` (Zustand) — `introState`, `activityState`, `lastActivityAt`, `prefersReducedMotion`
- React Query hooks: `useGeocode`, `useSky`, `usePlanets`

**Backend additions:**
- `server/app/routers/geocode.py` — new `GET /api/v1/geocode` endpoint
- `server/app/services/geocoder.py` — Photon HTTP client with in-memory TTL cache
- `server/app/schemas/geocode.py` — Pydantic models
- CORS middleware update in `server/app/main.py` allowing `http://localhost:5173`
- New runtime dependency: `httpx>=0.27`
- Tests: `test_geocoder.py` (unit), `test_geocode_endpoint.py` (integration), `test_geocoder_acceptance.py` (network, marked)

**Documentation updates:**
- Revise `SKYVAULT_ROADMAP.md` Phase 2 section and "Why Three.js over D3/Canvas2D?" decision
- Update repo-root `CLAUDE.md` Phase Status and Resume Here sections

### 3.2 Explicitly deferred (NOT in Phase 2a)

**Phase 2b (next session):**
- Canvas 2D stereographic sky disc rendering
- Hover tooltips on sky objects
- Click-for-detail info cards
- Magnitude slider filtering

**Phase 3:**
- IAU constellation stick-figure overlays
- SIMBAD enrichment (alternate names, spectral class, object type)
- NASA Exoplanet Archive enrichment (exoplanet host badges)

**Phase 4:**
- Three.js 3D "Explore Mode" (stub button activation)
- JPL Horizons enrichment (asteroids, comets, spacecraft)
- Snapshot download feature
- `/about` page with full source attribution
- Quick presets (Tonight, My birthday, Apollo 11, etc.)
- Live autocomplete as user types (v1 has submit-then-pick only)
- Keyboard shortcuts
- Dockerize, CI, deployed live URL
- Production CORS and security headers
- Rate limiting on our own API
- Full accessibility audit (beyond `prefers-reduced-motion`)
- Self-hosted or paid geocoder for production scale

**v2 (post-launch):**
- Deep sky objects (Messier catalog)
- Deeper Gaia subset with LOD rendering
- ISS and satellite passes
- Light pollution overlay
- Shareable permalink URLs
- Time-lapse mode
- Internationalization

---

## 4. Architecture

### 4.1 Data flow

```
User types "Portoviejo" + 2026-04-08 + 22:00 → Submit
        ↓
<ControlsStrip> writes { rawQuery, date, time } to observerStore
        ↓
useGeocode() React Query hook fires:
  GET /api/v1/geocode?q=Portoviejo&limit=5&lang=en
        ↓
FastAPI router → services/geocoder.geocode() → Photon public API
        ↓
Response cached server-side (1h TTL, max 256 entries)
        ↓
Returns top 5 candidates with lat/lon + display_name + country
        ↓
<DidYouMeanDropdown> renders candidate list
User clicks "Portoviejo, Manabí, Ecuador"
        ↓
observerStore: selectCandidate(idx) → sets selected + computes datetimeUtc
        ↓
useSky() + usePlanets() React Query hooks fire in parallel:
  GET /api/v1/sky?lat=-1.06&lon=-80.45&datetime=2026-04-08T22:00:00Z
  GET /api/v1/planets?lat=-1.06&lon=-80.45&datetime=2026-04-08T22:00:00Z
        ↓
Backend returns real Gaia DR3 + JPL DE421 data (Phase 1 code, unchanged)
        ↓
Info panels render:
  <LunarPanel> extracts Moon from planets response
  <PlanetsPanel> shows Mercury-Neptune
  <StarsPanel> shows top 30 stars by magnitude
        ↓
Every row displays a source badge with the attribution string
```

### 4.2 Component tree

```
<App>
  <QueryClientProvider>
    <AppBackground />                       — fixed-position ESO Milky Way, z-index -1
    <IntroSequence>                         — orchestrates the fade-in choreography
      <FrameContainer>                      — 1280px max, gold corner brackets
        <Header>                            — title, eyebrow, metadata subhead
        <main>
          <HeroRegion>                      — 16:9 reserved slot, "coming soon" content
            <ExploreIn3DButton disabled />
          </HeroRegion>
          <ControlsStrip>
            <LocationInput>
              <UseMyLocationButton />
              <DidYouMeanDropdown />
            </LocationInput>
            <DateInput />
            <TimeInput />
            <TimezoneToggle />
            <SubmitButton />
          </ControlsStrip>
          <InfoPanelsGrid>
            <LunarPanel />                  — 2-col row, 1st column
            <PlanetsPanel />                — 2-col row, 2nd column
            <StarsPanel />                  — full-width row below
          </InfoPanelsGrid>
        </main>
        <Footer />                          — attribution row
      </FrameContainer>
    </IntroSequence>
  </QueryClientProvider>
</App>
```

### 4.3 State boundaries (strict, never crossed)

| State type | Belongs in | Examples |
|---|---|---|
| Ephemeral local UI | `useState` inside component | dropdown open/closed, input focus, form field validation messages |
| Semantic "what are we looking at" | `observerStore` (Zustand) | rawQuery, candidates, selected location, date, time, datetimeUtc, submitted |
| Visual chrome state | `uiStateStore` (Zustand) | introState, activityState (normal/glass/hidden), lastActivityAt, prefersReducedMotion |
| Server data | React Query | geocode results, sky data, planets data |

Why two Zustand stores instead of one: `observerStore` is semantic (what am I computing the sky for) and `uiStateStore` is visual (how is the chrome presenting itself). Mixing them would cause every observer update to re-render visual-state consumers and vice versa. Separation keeps renders tight.

Why React Query for server data instead of Zustand: query caching, stale-while-revalidate, automatic retry, and built-in loading/error states. Reimplementing this in Zustand is busywork and loses the cache benefits.

### 4.4 Directory layout

```
client/
├── public/
│   └── milky-way.webp                     # ESO Gigagalaxy Zoom, ~400KB
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── App.jsx
│   │   │   ├── AppBackground.jsx          # full-viewport ESO image
│   │   │   ├── IntroSequence.jsx          # fade-in choreography
│   │   │   ├── FrameContainer.jsx         # gold corner brackets
│   │   │   ├── Header.jsx
│   │   │   └── Footer.jsx
│   │   ├── hero/
│   │   │   ├── HeroRegion.jsx
│   │   │   └── ExploreIn3DButton.jsx
│   │   ├── controls/
│   │   │   ├── ControlsStrip.jsx
│   │   │   ├── LocationInput.jsx
│   │   │   ├── DidYouMeanDropdown.jsx
│   │   │   ├── UseMyLocationButton.jsx
│   │   │   ├── DateInput.jsx
│   │   │   ├── TimeInput.jsx
│   │   │   ├── TimezoneToggle.jsx
│   │   │   └── SubmitButton.jsx
│   │   ├── info/
│   │   │   ├── InfoPanelsGrid.jsx
│   │   │   ├── LunarPanel.jsx
│   │   │   ├── MoonSvg.jsx
│   │   │   ├── PlanetsPanel.jsx
│   │   │   ├── StarsPanel.jsx
│   │   │   └── SourceBadge.jsx
│   │   └── ui/
│   │       ├── Panel.jsx                  # shared panel primitive
│   │       ├── LoadingSkeleton.jsx
│   │       ├── ErrorCard.jsx
│   │       └── Button.jsx
│   ├── hooks/
│   │   ├── useGeocode.js                  # React Query wrapper
│   │   ├── useSky.js
│   │   ├── usePlanets.js
│   │   ├── useGeolocation.js              # browser GPS wrapper
│   │   ├── useIdle.js                     # idle detection + state machine
│   │   ├── useIntroSequence.js            # sessionStorage + ?replay logic
│   │   └── useFSM.js                      # tiny explicit FSM helper, ~20 lines
│   ├── stores/
│   │   ├── observerStore.js
│   │   └── uiStateStore.js
│   ├── utils/
│   │   ├── formatCoords.js                # lat/lon → display string
│   │   ├── formatDatetime.js              # date+time+tz → ISO UTC
│   │   ├── bvToColor.js                   # BP-RP → hex color
│   │   └── magnitudeToSize.js             # apparent magnitude → display px
│   ├── styles/
│   │   └── global.css                     # Tailwind base + font imports + custom utilities
│   ├── __tests__/                         # Vitest tests (or co-located *.test.jsx)
│   ├── App.jsx
│   └── main.jsx
├── .eslintrc.cjs
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js

server/app/                                 # additions only
├── routers/
│   └── geocode.py                         # NEW
├── services/
│   └── geocoder.py                        # NEW
├── schemas/
│   └── geocode.py                         # NEW
└── main.py                                # MODIFIED — mount router, add CORS

server/tests/                               # additions only
├── test_geocoder.py                       # NEW — unit, mocked
├── test_geocode_endpoint.py               # NEW — integration, mocked service
└── test_geocoder_acceptance.py            # NEW — network, marked
```

---

## 5. Design language

### 5.1 Color palette — hybrid "cool base + restrained warm accent"

```css
:root {
  --bg:         #05060d;              /* deep near-black page background */
  --bg-frame:   #0a0d1c;              /* slightly lifted frame bg */
  --bg-panel:   rgba(10,14,28,0.55);  /* semi-transparent panel overlay */
  --ink:        #dce1f0;              /* cool off-white, primary text */
  --ink-dim:    #7a8299;              /* cool gray, metadata/labels */
  --accent:     #e8b86d;              /* restrained amber, headings + values */
  --accent-dim: #6a5329;              /* dim amber, rules + corner brackets */
  --rule:       #1e2238;              /* dark cool rule between sections */
  --danger:     #e08585;              /* validation errors, horizon-below states */
}
```

Wired through `tailwind.config.js` under `theme.extend.colors` as:
```js
colors: {
  bg: { DEFAULT: '#05060d', frame: '#0a0d1c' },
  ink: { DEFAULT: '#dce1f0', dim: '#7a8299' },
  accent: { DEFAULT: '#e8b86d', dim: '#6a5329' },
  rule: '#1e2238',
  danger: '#e08585',
}
```

Semi-transparent `--bg-panel` stays as a CSS variable (Tailwind's color scale doesn't handle rgba cleanly).

Components use utilities like `bg-bg`, `text-ink`, `text-accent`, `border-accent-dim`. No inline styles.

### 5.2 Typography

- **Cormorant Garamond** (serif, italic for headings and display) — weights 400, 500, 600, plus italic 400
- **JetBrains Mono** (monospace for labels, metadata, numeric values) — weights 300, 400, 500

Loaded from Google Fonts in `index.html` `<head>` via preconnect + stylesheet link. Swap to self-hosted `.woff2` files in Phase 4 for performance.

### 5.3 Background image

**Source:** ESO "Gigagalaxy Zoom" panorama, catalog ID `eso0932a`
**Credit:** ESO/S. Brunier
**License:** Creative Commons Attribution 4.0 (CC-BY 4.0)
**Canonical URL:** https://www.eso.org/public/images/eso0932a/

**Asset prep:**
- Download original high-res version
- Convert to WebP at 1920×960 resolution, quality ~85
- Target file size: ~400KB
- Store at `client/public/milky-way.webp`

**Credit line in footer:** `"Milky Way: ESO/S. Brunier · CC-BY 4.0"` (added this session alongside the existing attribution row).

**CSS placement (full-viewport permanent background):**

```css
.app-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: var(--bg);
  isolation: isolate;
}
.app-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/milky-way.webp');
  background-size: cover;
  background-position: center;
  opacity: 0.28;                    /* starting point, tune on screen */
  mix-blend-mode: screen;           /* starlight punches through */
}
.app-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(5,6,13,0.7) 100%
  );                                /* vignette for text contrast */
  pointer-events: none;
}
```

Initial opacity `0.28`; expect to tune between 0.2 and 0.4 once real text is over it.

### 5.4 Layout structure

**Vertical stack, max-width 1280px centered, gold corner brackets on the frame:**

1. **Header** (centered, padding-bottom with bottom rule)
   - Eyebrow: `"OBSERVATORIUM · SKYVAULT"` in mono, amber, uppercase, letter-spaced
   - H1: italic Cormorant Garamond, `clamp(32px, 6vw, 58px)`, `"The Sky over [Location]"`
   - Subhead: mono, dim ink, `"08 APRIL 2026 · 22:00 UTC · 1.06°S 80.45°W"`

2. **Hero region** (full width, `aspect-ratio: 16/9` on desktop, `4/3` on mobile)
   - Subtle inner border, background slightly darker than the frame
   - Centered placeholder content: `EXPLORE IN 3D →` button (disabled, "coming soon" badge below) + italic subtext `"Interactive sky chart · arrives next session"`

3. **Controls strip** (full width, horizontal flex on ≥880px, vertical flex below)
   - LocationInput (flex-grow)
   - UseMyLocationButton (compact, icon-only)
   - DateInput
   - TimeInput
   - TimezoneToggle (small pill)
   - SubmitButton (amber, `GO →`)

4. **Info panels row 1** (`grid-cols-2` on ≥880px, `grid-cols-1` below, gap-6)
   - LunarPanel
   - PlanetsPanel

5. **Info panels row 2** (full width)
   - StarsPanel

6. **Footer** (top rule, mono uppercase, letter-spaced)
   - Primary line: `"POWERED BY ESA GAIA DR3 · NASA JPL · IAU · ESO"`
   - Secondary line (smaller, dimmer): `"Milky Way: ESO/S. Brunier · CC-BY 4.0 · Design reference: Charlotte mock"`

**Gold corner brackets** (copied from Charlotte mock, recolored):
```css
.frame::before, .frame::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 1px solid var(--accent-dim);
}
.frame::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.frame::after  { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
```

**Breakpoint:** single `@media (min-width: 880px)` — below this, everything collapses to a single column.

---

## 6. UX specifications

### 6.1 Input flow with Photon geocoder

**User flow:**

1. User types a place name into `<LocationInput>`
2. User picks a date in `<DateInput>` (and optionally a time in `<TimeInput>`)
3. User clicks Submit (or presses Enter in the location field)
4. `useGeocode()` fires → backend hits Photon → returns top 5 candidates
5. `<DidYouMeanDropdown>` appears below the location input with the candidates
6. Each candidate shows `display_name` (e.g., `"Portoviejo, Manabí, Ecuador"`) with a country flag emoji
7. User clicks a candidate
8. `observerStore.selectCandidate(idx)` sets `selected` and computes `datetimeUtc`
9. `useSky()` and `usePlanets()` fire in parallel
10. Results populate the info panels

**Alternative: "Use my location" button:**
1. User clicks the 📍 button
2. `useGeolocation()` calls `navigator.geolocation.getCurrentPosition()`
3. On success: lat/lon populate `observerStore.selected` directly (skipping the geocoder), `displayName` set to `"Current location (±Nm)"`
4. Sky and planets queries fire

**Alternative: enter coordinates directly (power user):**
A small "Enter coordinates instead" link (hidden in a dropdown or accordion) swaps the location input for two lat/lon number fields. Bypasses the geocoder entirely.

**Submit button states:**
- Idle: `GO →` in amber
- Geocoding: spinner + `"Looking up…"`
- Sky/planets loading: spinner + `"Computing sky…"`
- Ready: amber `GO →` re-enabled when new input is provided
- Disabled: gray with reduced opacity when required fields are empty

### 6.2 Intro animation sequence

**State machine:**

```
┌─────────── IntroSequence FSM ──────────┐

  INITIAL
    │  (on mount, check sessionStorage + ?replay)
    ▼
  CHECK_FLAG
    │
    ├─ flag set AND no ?replay ──▶ DONE (immediate, content already visible)
    │
    └─ flag not set OR ?replay ──▶ BLACK_SCREEN
                                        │
                                        │  wait 1.5s
                                        ▼
                                   GALAXY_FADE_IN
                                        │  (2s CSS animation, opacity 0 → 0.28)
                                        │
                                        ▼
                                   CONTENT_FADE_IN
                                        │  (starts at ~60% of galaxy fade)
                                        │  (content enters in GLASS state)
                                        │
                                        ▼
                                      DONE
                                        │  (sessionStorage flag set)
                                        │
                                        ▼
                                 (hands off to useIdle)
```

**Implementation notes:**
- Full sequence duration: ~3.5-4 seconds
- Pure CSS keyframe animations — no JS-driven frame loop
- React effect on mount reads sessionStorage + URL params, sets a root class
- CSS transitions gated on the root class
- `prefers-reduced-motion: reduce` → immediate jump to DONE, no animations

**sessionStorage key:** `skyvault.introPlayed` (value: `"true"`)
**URL param override:** `?replay` (doesn't clear the flag, just skips the check)

**Edge cases handled:**
- Tab hidden mid-animation: CSS `animation-play-state: paused` via `visibilitychange` listener
- Window resize during animation: ignored (opacity-based, not layout-based)
- User clicks/types during animation: intro completes normally, just queues the input for when IntroSequence reaches DONE

### 6.3 Idle-aware chrome state machine

**Two visual states on every component:**

| State | Opacity | Backdrop blur | Text | Borders |
|---|---|---|---|---|
| `NORMAL` | 1.0 | none | full color | full opacity |
| `GLASS` | 0.55 | 4-6px (mobile: 0) | dim ink only | accent-dim, softened |
| `HIDDEN` | 0 | n/a | n/a | n/a |

Controlled by a single class on `document.body`: `.ui-normal`, `.ui-glass`, `.ui-hidden`. Every component has CSS rules like `.ui-glass .panel { ... }` to define its glass variant.

**Initial state after intro hand-off:**

When `IntroSequence` reaches `DONE`, the activity state is `GLASS` (content has just faded in as glass — see §6.2). The idle FSM begins from `GLASS`, not `NORMAL`. The first user input event after intro completes snaps the state to `NORMAL`. From there, the timer-driven cycle below applies.

If the user has `prefers-reduced-motion: reduce`, the intro is skipped and the activity state starts at `NORMAL` directly (no glass entry).

**State transitions (driven by `useIdle`):**

```
GLASS (initial after intro)
  │  any user input
  ▼
NORMAL
  │  15s no activity
  ▼
GLASS
  │  5s more no activity
  ▼
HIDDEN
  │  any user input
  ▼
NORMAL (instant snap)
```

**Events that count as activity (reset timer):**
- `mousemove`
- `mousedown` / `touchstart`
- `keydown`
- `scroll`
- `focusin` on any input element
- Form input has `document.activeElement` matching an input/textarea

**Events that do NOT reset the timer:**
- `mouseenter` / `mouseleave` (too easy to trigger passively)
- Pure CSS hover states (not a JS event)

**Visibility handling:**
- `visibilitychange` → `hidden`: pause the timer, record `hiddenAt` timestamp
- `visibilitychange` → `visible`:
  - If `Date.now() - hiddenAt < 5000ms`: resume from previous state
  - Otherwise: snap to `GLASS` state (intermediate, not active, not fully hidden)
  - Don't replay intro regardless

**Focused input immunity:**
- While `document.activeElement` is an `<input>`, `<textarea>`, or `<select>`, treat as continuously active regardless of timer
- Prevents punishing users who are reading the form while deciding

**Timeouts (configurable in `uiStateStore`):**
- `ACTIVE_TO_GLASS_MS = 15000`
- `GLASS_TO_HIDDEN_MS = 5000`

Tunable during development; freeze values in a later polish pass.

### 6.4 Progressive disclosure philosophy

**Phase 2a default:** Scannable info panels, source badges visible, no interactive drill-down.
**Phase 2b additions:** Hover tooltip on sky disc for quick ID, click for detail panel.
**Phase 3 additions:** Click-through to full object info with multi-source attribution (SIMBAD metadata, exoplanet badges, spectral class, constellation membership).

The goal is "beautiful by default, deep when explored." A user who just wants to see their birthday sky gets that without any UI learning. A curious user gets increasing levels of depth without ever being dumped on.

---

## 7. Backend additions

### 7.1 `GET /api/v1/geocode` endpoint

**Query parameters:**

| Name | Type | Required | Constraints | Default |
|---|---|---|---|---|
| `q` | str | yes | min_length=2, max_length=200 | — |
| `limit` | int | no | ge=1, le=10 | 5 |
| `lang` | str | no | pattern=`^[a-z]{2}$` | `"en"` |

**Response (Pydantic model `GeocodeResponse`):**

```python
class GeocodeCandidate(BaseModel):
    display_name: str               # "Portoviejo, Manabí, Ecuador"
    name: str                       # "Portoviejo"
    country: str | None             # "Ecuador"
    state: str | None               # "Manabí"
    lat: float                      # -1.057
    lon: float                      # -80.454
    osm_type: str                   # "node" | "way" | "relation"
    osm_id: str                     # "123456789"
    place_type: str | None          # "city" | "town" | "village" | ...

class GeocodeResponse(BaseModel):
    query: str                      # echo of the user query
    candidates: list[GeocodeCandidate]
    count: int                      # len(candidates)
    source: str = "Photon (photon.komoot.io) / OpenStreetMap"
```

**Error responses:**

| Condition | HTTP | Body |
|---|---|---|
| `q` < 2 or > 200 chars | 422 | Pydantic validation error |
| `lang` not 2 lowercase letters | 422 | Pydantic validation error |
| `limit` out of [1, 10] | 422 | Pydantic validation error |
| Photon 0 results | **200** | Empty candidates, `count: 0` — NOT an error |
| Photon timeout (10s) | 503 | `{"detail": "Geocoder service temporarily unavailable"}` |
| Photon 5xx | 502 | `{"detail": "Geocoder upstream error"}` |
| httpx network error | 503 | `{"detail": "Geocoder service temporarily unavailable"}` |
| Internal server error | 500 | `{"detail": "Internal server error"}` — no stack leak |

### 7.2 `services/geocoder.py`

**Configuration constants:**
```python
PHOTON_BASE_URL = "https://photon.komoot.io/api"
USER_AGENT = "SkyVault/0.1 (phase 2a development)"
REQUEST_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 3600        # 1 hour
CACHE_MAX_ENTRIES = 256
CACHE_EVICT_BATCH = 32          # evict oldest 32 when over limit
```

**In-memory cache implementation:** Custom ~30-line dict-based cache keyed by `(query_lowercase_stripped, limit, lang)`. Stores `(cached_at_timestamp, response)` tuples. On lookup: if key present and `now - cached_at < CACHE_TTL_SECONDS`, return cached response. On miss or stale: make HTTP request, store result, return. On cache full (size > `CACHE_MAX_ENTRIES`): sort by `cached_at` ascending, delete oldest `CACHE_EVICT_BATCH` entries.

**Why not `functools.lru_cache`:** Doesn't work with async functions directly. Custom cache is simpler than adding `async-lru` as a dependency.

**Photon response parsing:** Photon returns GeoJSON FeatureCollection. Each feature has `geometry.coordinates` as `[lon, lat]` (GeoJSON order) and `properties` with `name`, `country`, `state`, `osm_type`, `osm_id`, `type` (place type). Map these to `GeocodeCandidate` fields, constructing `display_name` as `f"{name}, {state + ', ' if state else ''}{country}"` with sensible fallbacks when fields are missing.

### 7.3 CORS middleware

Update to `server/app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],    # Vite dev server only
    allow_credentials=False,                     # no auth in v1
    allow_methods=["GET"],                       # all endpoints are GET
    allow_headers=["*"],
)
```

Dev-only configuration. Tightened in Phase 4 for production origins.

### 7.4 New runtime dependency: `httpx>=0.27`

**Justification:** Async HTTP client for calling Photon from async FastAPI endpoints. No async HTTP client exists in Python's stdlib. `httpx` is maintained by the Starlette/FastAPI team, has a `requests`-compatible API, and is already a transitive dependency of FastAPI's `TestClient`. Smallest clean addition that unblocks the feature.

**Alternatives rejected:**
- `requests` — sync, blocks the event loop inside async endpoints
- `aiohttp` — heavier, different idioms from the FastAPI ecosystem
- stdlib async HTTP — doesn't exist

**Line added to `server/requirements.txt`:**
```
httpx>=0.27
```

Approved by Andrew on 2026-04-08.

---

## 8. Frontend components (detail)

### 8.1 `<AppBackground>`
- Fixed-position div, `z-index: -1`, covering the full viewport
- Contains the ESO Milky Way image via CSS `::before` pseudo-element
- Vignette overlay via `::after` pseudo-element
- Opacity controlled by a CSS custom property so the intro animation can fade it in

### 8.2 `<IntroSequence>`
- Reads `sessionStorage.getItem('skyvault.introPlayed')` and URL params on mount
- Triggers the intro FSM if not played (or `?replay` is present)
- Uses CSS keyframe animations scoped via root classes: `.intro-pending`, `.intro-playing`, `.intro-done`
- Calls `markComplete()` at the end to set sessionStorage flag and transition to idle machine control
- Respects `prefers-reduced-motion` — sets intro state to DONE immediately

### 8.3 `<FrameContainer>`
- Max-width 1280px, centered, padding responsive via clamp
- Gold corner bracket pseudo-elements
- Inner background slightly lifted from the outer `--bg`
- Contains Header, main, Footer children slots

### 8.4 `<Header>`
- Centered eyebrow (mono, amber, uppercase, letter-spaced, with hairline rules on each side)
- H1 (italic Cormorant Garamond, clamp font-size)
- Metadata subhead (mono, dim ink)
- Values pulled from `observerStore.selected` and `observerStore.datetimeUtc`
- Before submit: placeholder text like `"The Sky · SkyVault"` and `"Enter a location to begin"`

### 8.5 `<HeroRegion>`
- Full-width card with `aspect-ratio: 16/9` desktop, `4/3` mobile
- Inner background slightly darker than frame
- Subtle inner border
- Centered content: ExploreIn3DButton (disabled) + italic subtext
- In Phase 2b, this container is filled by the 2D sky disc component

### 8.6 `<ExploreIn3DButton>`
- Disabled button styled in amber-dim
- "coming soon" badge next to the label
- Hover cursor: `not-allowed`
- Phase 4: unlocks and routes to `/explore-3d` or toggles a render mode

### 8.7 `<ControlsStrip>`
- Horizontal flex on desktop (flex-row, gap-4, items-end)
- Vertical flex on mobile (flex-col, gap-3)
- Contains all input components + submit button
- Orchestrates the submit flow: validates → fires `useGeocode` → on success, shows DidYouMeanDropdown

### 8.8 `<LocationInput>`
- Large text input with placeholder
- Magnifier icon on the left (just decoration)
- Wired to `observerStore.rawQuery` via `setRawQuery`
- Debounced input handler (300ms) updates the store without firing queries
- On Enter key or Submit, triggers the actual geocoder query
- Renders `<UseMyLocationButton>` inside its right side
- Renders `<DidYouMeanDropdown>` below when `observerStore.candidates.length > 0`

### 8.9 `<DidYouMeanDropdown>`
- Card with gold-dim border, semi-transparent background
- Header row: mono label "DID YOU MEAN"
- List of candidates, each row: country flag emoji + display_name (italic serif) + subtle hover state
- Click handler: `observerStore.selectCandidate(idx)`
- Closes when `selected` is set
- Keyboard navigation: arrow keys to move, Enter to pick, Escape to close

### 8.10 `<UseMyLocationButton>`
- Compact icon button with "📍" emoji (or SVG icon)
- On click: calls `useGeolocation()` hook
- Shows a spinner while waiting for GPS lock
- On success: populates `observerStore.selected` directly with `{ lat, lon, displayName: "Current location" }`, skipping the dropdown
- On permission denied or timeout: shows inline error message

### 8.11 `<DateInput>`
- Native `<input type="date">`
- `min="1900-01-01"`, `max="2100-12-31"`
- Styled to match theme (accent-colored focus border, dim text)
- Default value: today's date (browser local)
- Wired to `observerStore.date`

### 8.12 `<TimeInput>`
- Native `<input type="time">` — optional
- Placeholder text: "now" when empty
- Default: empty (backend fills in current time if omitted)
- Wired to `observerStore.time`

### 8.13 `<TimezoneToggle>`
- Small pill with two options: `Local` | `UTC`
- Default: `Local`
- When `Local`, time is interpreted in the user's IANA timezone (from `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- When `UTC`, time is interpreted as literal UTC
- Conversion to UTC happens in `observerStore` when `submit()` is called, before fetches fire

### 8.14 `<SubmitButton>`
- Amber accent, uppercase mono label
- States:
  - Idle: `GO →`
  - Disabled (missing required fields): reduced opacity, `cursor: not-allowed`
  - Loading geocode: spinner + `"LOOKING UP…"`
  - Loading sky/planets: spinner + `"COMPUTING SKY…"`
- On click: calls `observerStore.submit()` which triggers the `useGeocode` query

### 8.15 `<LunarPanel>`
- Header: `LUNAR CONDITIONS` (mono, amber, uppercase)
- Body: SVG moon illustration (phase-accurate via illumination %) + metadata rows
  - Phase name (italic serif: "waxing crescent", "first quarter", etc.)
  - Illumination: `34%` (mono)
  - Altitude / azimuth (mono)
  - Source badge: `NASA JPL DE421 via Astropy`
- Data pulled from `usePlanets()` result, filtering for the Moon entry
- Empty state: "Moon below horizon" if alt < 0

### 8.16 `<PlanetsPanel>`
- Header: `WANDERING STARS` (mono, amber, uppercase)
- Body: list of visible planets (Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune — below horizon shown struck-through per Charlotte mock style)
- Each row: italic serif name, mono alt/az values, distance from Earth, source badge
- Source badge: `NASA JPL DE421 via Astropy`
- Data from `usePlanets()`

### 8.17 `<StarsPanel>`
- Header: `BRIGHTEST STARS` (mono, amber, uppercase)
- Body: table or row list of top 30 by magnitude
- Each row: name (if named) / HIP or source_id fallback, mono alt/az, magnitude, color swatch (from BP-RP), distance ly (from parallax)
- Source badge at bottom of panel: `ESA Gaia DR3`
- Data from `useSky()`, sorted client-side by `magnitude` ascending, sliced to 30
- Empty state: "No stars above horizon" if result array is empty

### 8.18 `<SourceBadge>`
- Reusable chip component
- Props: `source` (string), `identifier` (optional string)
- Renders: mono font, `--accent-dim` color, small size, letter-spaced
- Example: `"Gaia DR3 · 4089383515393106688"`

### 8.19 `<Footer>`
- Full-width row with top rule
- Primary line: attribution sources (mono, uppercase, letter-spaced)
- Secondary line: smaller, dimmer, credits including ESO CC-BY

### 8.20 `<ErrorCard>`
- Reusable error display primitive
- Props: `title`, `message`, `retryAction` (optional function)
- Rendered by panels when their query is in error state
- Scoped to its parent container — doesn't take over the whole app

### 8.21 Hooks

- `useGeocode(query, submitted)` — React Query wrapper for `/api/v1/geocode`, staleTime 1h, `enabled: submitted && query.length >= 2`. The `submitted` flag is required so the query only fires after the user clicks Submit (or presses Enter), matching the "submit-then-pick" model in §6.1. Live autocomplete as the user types is deferred to Phase 4 (§3.2).
- `useSky(lat, lon, datetimeUtc)` — React Query wrapper for `/api/v1/sky`, enabled when all params are set
- `usePlanets(lat, lon, datetimeUtc)` — React Query wrapper for `/api/v1/planets`
- `useGeolocation()` — wrapper around `navigator.geolocation.getCurrentPosition` with 10s timeout, returns `{ position, error, isLoading }`
- `useIdle()` — attaches event listeners, manages the idle FSM, writes to `uiStateStore`
- `useIntroSequence()` — reads sessionStorage + URL params, returns `{ shouldPlay, markComplete }`
- `useFSM(states, initial, transitions)` — tiny ~20-line explicit FSM helper. No dependency. Used by `useIdle` and `useIntroSequence` for clean transitions.

### 8.22 Stores

**`observerStore.js` (Zustand):**
```js
{
  rawQuery: '',
  candidates: [],
  selected: null,           // { lat, lon, displayName, country }
  date: '',                 // 'YYYY-MM-DD'
  time: '',                 // 'HH:MM' or ''
  timezone: 'Local',        // 'Local' | 'UTC'
  datetimeUtc: null,        // ISO 8601 UTC string, computed
  submitted: false,

  setRawQuery: (s) => ...,
  setCandidates: (arr) => ...,
  selectCandidate: (idx) => ...,
  setDate: (s) => ...,
  setTime: (s) => ...,
  setTimezone: (s) => ...,
  submit: () => ...,        // validates, computes datetimeUtc, sets submitted
  reset: () => ...,
}
```

**`uiStateStore.js` (Zustand):**
```js
{
  introState: 'pending',             // 'pending' | 'playing' | 'done'
  activityState: 'normal',           // 'normal' | 'glass' | 'hidden'
  lastActivityAt: Date.now(),
  prefersReducedMotion: false,

  startIntro: () => ...,
  completeIntro: () => ...,
  markActive: () => ...,
  markGlass: () => ...,
  markHidden: () => ...,
  setReducedMotion: (bool) => ...,
}
```

---

## 9. Error handling matrix

### 9.1 Frontend error surfaces

| Scenario | Component | UX response |
|---|---|---|
| Photon returns 0 results | `<LocationInput>` | Inline: *"No matches found for 'xyz'. Try a larger nearby city, enter coordinates, or use your current location."* |
| Photon returns multiple matches | `<DidYouMeanDropdown>` | Top 5 list with country flags, user must click one |
| Geocoder endpoint slow (>500ms) | `<SubmitButton>` | Spinner + `"LOOKING UP…"` label |
| Geocoder 502/503 | `<ErrorCard>` below controls | *"Couldn't reach the place lookup service. Try again, or enter coordinates directly."* + retry button |
| Geolocation permission denied | Inline near `<UseMyLocationButton>` | *"Location permission denied. Type a place name instead."* |
| Geolocation timeout (10s) | Inline | *"Couldn't get your location. Type a place name instead."* |
| `/sky` returns empty array | `<StarsPanel>` empty state | *"No stars above the horizon at this time and location."* with explanatory subtext |
| `/sky` errors | `<StarsPanel>` error state | Panel-scoped error card with retry button |
| `/planets` errors | `<PlanetsPanel>` error state | Panel-scoped error card with retry button |
| Backend unreachable | Top-level banner | *"Can't reach the SkyVault API. Is the server running?"* |

### 9.2 Backend error contract

See §7.1.

### 9.3 Date/time validation

- `<DateInput>` has `min="1900-01-01"` and `max="2100-12-31"` — browser enforces
- `<TimeInput>` is optional; empty means "now" (backend fills in)
- Timezone conversion happens client-side using `Intl.DateTimeFormat().resolvedOptions().timeZone` + manual offset math
- DST ambiguity: we accept browser's default resolution
- Historical dates far from 2026 may have minute-scale timezone errors — acceptable for a visualization tool

### 9.4 Intro / idle edge cases

| Scenario | Handling |
|---|---|
| Fresh new tab | sessionStorage flag not set → play intro → set flag |
| Same tab refresh | Flag set → skip intro |
| `?replay` URL param | Force intro, don't clear flag |
| Tab hidden during intro | `animation-play-state: paused` |
| Tab hidden during active use | Pause idle timer, record `hiddenAt` |
| Tab visible after >5s hidden | Snap to `glass` state, reset timer |
| Tab visible after <5s hidden | Resume from previous state |
| Form input focused | `document.activeElement` check — treat as active |
| `prefers-reduced-motion: reduce` | Skip intro entirely, instant transitions only |

### 9.5 Data edge cases

| Scenario | Handling |
|---|---|
| Geolocation returns elevation (mountain/basement) | Pass through to EarthLocation, Astropy handles it |
| Photon returns lat/lon outside valid ranges | Frontend filters, logs warning (defensive) |
| User's system clock is wrong | Out of scope — trust browser-reported time |
| User submits with no selected candidate | Submit button disabled until `observerStore.selected !== null` |
| User submits with empty date | Submit button disabled until `date !== ''` |

---

## 10. Testing strategy

### 10.1 Backend tests (pytest)

**New unit tests — `server/tests/test_geocoder.py`:**
- `test_geocoder_returns_correct_shape` — mocked httpx response with 2 features, verify GeocodeResponse matches
- `test_geocoder_empty_result` — mocked empty FeatureCollection, verify `count: 0` and `candidates: []`
- `test_geocoder_cache_hit` — call twice with same args, verify mock called only once
- `test_geocoder_cache_ttl_expiry` — simulate time advance past TTL, verify mock called again
- `test_geocoder_cache_eviction` — fill cache to 257 entries, verify oldest 32 removed

**New integration tests — `server/tests/test_geocode_endpoint.py`:**
- `test_geocode_q_too_short` — 422
- `test_geocode_q_too_long` — 422
- `test_geocode_valid_returns_200` — mocked service, verify response body
- `test_geocode_upstream_timeout_returns_503` — mocked service raises TimeoutException
- `test_geocode_upstream_error_returns_502` — mocked service raises HTTPStatusError

**New acceptance tests — `server/tests/test_geocoder_acceptance.py`** (marked `@pytest.mark.network`):
- `test_geocode_miami_florida` — real Photon, assert at least one result with country "United States"
- `test_geocode_charlotte_north_carolina` — real Photon, assert result with state "North Carolina"
- `test_geocode_portoviejo_ecuador` — real Photon, assert result with country "Ecuador"

Register `network` mark in `pytest.ini`:
```ini
[pytest]
markers =
    network: tests that hit real network services (run with `pytest -m network`)
```

Network tests are skipped in default CI runs. Run manually before merging to verify global coverage.

**Existing Phase 1 tests must continue passing** — no changes to `/sky`, `/planets`, or the underlying services.

### 10.2 Frontend tests (Vitest + React Testing Library)

**Store unit tests:**
- `observerStore.test.js` — all actions in isolation (setRawQuery, selectCandidate, submit computes datetimeUtc correctly, reset clears state)
- `uiStateStore.test.js` — intro state transitions, activity state machine, reduced-motion flag

**Hook unit tests (with fake timers):**
- `useIdle.test.js` — idle detection on mousemove, timer pauses on visibilitychange, focused input immunity
- `useIntroSequence.test.js` — mocked sessionStorage, mocked URL params, verify correct shouldPlay output

**Component integration tests (mocked fetch):**
- `LocationInput.test.jsx` — type → submit → dropdown renders → click candidate → store updated
- `ControlsStrip.test.jsx` — submit disabled until all required fields, error display on query failure
- `App.test.jsx` — smoke test, app mounts without throwing

### 10.3 What is explicitly not tested this session

- Visual regression (no screenshots to compare against yet)
- E2E browser tests (Playwright deferred to Phase 4)
- Real API calls from the frontend (mock the fetch layer)
- Accessibility audit beyond `prefers-reduced-motion` (full audit is Phase 4)
- Performance benchmarks

### 10.4 New dev dependencies (frontend)

Approved by Andrew on 2026-04-08. Standard Vite + React testing stack:

```
devDependencies:
  vitest
  @testing-library/react
  @testing-library/jest-dom
  jsdom
  eslint
  eslint-plugin-react
  eslint-plugin-react-hooks
  eslint-plugin-react-refresh
  prettier                              # optional — include unless Andrew opts out
```

Runtime dependencies (core stack per repo CLAUDE.md):
```
dependencies:
  react
  react-dom
  zustand
  @tanstack/react-query
```

Build/style dependencies:
```
devDependencies:
  vite
  @vitejs/plugin-react
  tailwindcss
  postcss
  autoprefixer
```

---

## 11. Acceptance criteria (deliverable)

The implementation plan is done when all 20 of these are checked off:

1. `cd client && npm run dev` boots the app on `http://localhost:5173`
2. On first load (fresh tab), ESO Milky Way fades in over ~2s, then content fades in as GLASS state
3. First mouse move or keypress → content snaps to NORMAL state
4. Type `"Portoviejo"` → Submit → "Did you mean..." dropdown shows at least one result with country `"Ecuador"`
5. Click a candidate → LunarPanel + PlanetsPanel + StarsPanel populate with real data
6. Every data row in every panel shows a source badge
7. Same flow works for `"Miami, FL"` and `"Charlotte, NC"`
8. "Use my location" button triggers browser geolocation, fills coordinates, fires the sky query
9. Header updates to show resolved location + date + time
10. `EXPLORE IN 3D →` button is visible in the hero region but disabled with "coming soon" badge
11. 15s of no mouse movement → content fades to GLASS state
12. Any user input → snaps back to NORMAL
13. Tab switch away and back → no intro replay, idle timer paused/resumed
14. Refresh page in same tab → no intro replay (sessionStorage gate)
15. Open `http://localhost:5173/?replay` → intro plays again
16. `prefers-reduced-motion: reduce` in browser → intro skipped, all transitions instant
17. Backend unreachable → top-level error banner appears
18. `pytest` (backend) passes all existing 31 Phase 1 tests + ~15 new geocoder tests
19. `pytest -m network` passes the 3 acceptance tests (Miami / Charlotte / Portoviejo) against real Photon
20. `npm test` (frontend) passes all new Vitest tests

---

## 12. Doc updates required during implementation

- `SKYVAULT_ROADMAP.md`:
  - Revise "Phase 2 — Star Map Rendering" section to reflect Canvas 2D approach
  - Rename to match Phase 2a / 2b split
  - Revise "Why Three.js over D3/Canvas2D?" decision: acknowledge reversal, explain pivot rationale
  - Add new decision entry for Canvas 2D choice and Three.js → Phase 4 move
- Repo-root `CLAUDE.md`:
  - Update "Phase Status" section to reflect new phase numbering
  - Update "Resume Here — Next Session" (currently says "Phase 1 kickoff" which has been superseded twice)
  - Add Canvas 2D rendering commitment to the coding conventions section

Both are small doc updates but they need to happen in the same commit as the Phase 2a implementation to keep the repo self-consistent.

---

## 13. Regression risks

- **Phase 1 backend tests must still pass** after adding the geocode router and CORS middleware — no changes to `/sky` or `/planets` endpoints
- **Existing API response shapes are frozen** — future components may depend on them
- **CORS middleware is dev-only `localhost:5173`** — must not affect direct server-to-server testing or break the existing test suite
- **New `httpx` dependency** — verify no conflicts with existing `astroquery` (which uses `requests` internally)
- **Milky Way image asset (~400KB)** — verify Vite's asset handling serves it correctly and it's not blocking first paint

---

## 14. Open questions

None at spec-lock time. All major decisions resolved during the 2026-04-08 brainstorming session.

---

## 15. Revision history

| Date | Author | Change |
|---|---|---|
| 2026-04-08 | Andrew + Claude brainstorm | Initial spec written after full 6-section design walkthrough |
