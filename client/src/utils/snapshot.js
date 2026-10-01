/**
 * "Save image": a clean, square snapshot of the current sky.
 *
 * Rendered offscreen at a fixed size (not copied from the screen), so a phone
 * and a laptop save the same 2000 x 2000 PNG. It reuses the chart's own
 * projection, drawing functions and Milky Way shader, so it looks like the
 * live chart minus the UI: no tooltip, selection ring or buttons.
 *
 * Text is deliberately minimal: a faint place/time caption (bottom-left) and
 * the credits the data licenses require (bottom-right). The ESO credit is
 * burned in whenever the panorama is in the image: CC BY 4.0 requires it.
 */
import { createBackdropRenderer, MILKY_WAY_ASSET } from "./backdropRenderer.js";
import {
  projectStars,
  projectPlanets,
  projectDsos,
  projectConstellations,
} from "./projection.js";
import { drawStar, drawPlanet, drawConstellationLines } from "./drawing.js";
import { drawDso } from "./dsoDrawing.js";
import { formatLatLon } from "./formatCoords.js";

const SIZE = 1000; // layout size in CSS px (chart styling reads 1:1 at this size)
const SCALE = 2; // device pixels per layout px
export const SNAPSHOT_PX = SIZE * SCALE;

const SERIF = '"Cormorant Garamond", Georgia, serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const MARGIN = 14;

export const CREDIT_MILKY_WAY = "Milky Way: ESO/S. Brunier · CC BY 4.0";
export const CREDIT_STARS = "Stars: ESA/Gaia/DPAC & ESA Hipparcos";
export const CREDIT_FIGURES = "Figures: Stellarium · CC BY-SA 4.0";

/** Short place name for the caption; coordinates for a GPS fix. */
export function placeLabel(selected) {
  if (!selected) return "";
  if (selected.displayName && selected.displayName !== "Current location") {
    return selected.displayName.split(",")[0].trim();
  }
  return formatLatLon(selected.lat, selected.lon);
}

// Wall-clock parts of an instant in the place's zone (browser zone if unknown).
function localParts(datetimeUtc, zone) {
  const opts = {
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: zone || undefined });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", opts); // unknown IANA name
  }
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(datetimeUtc))) p[type] = value;
  return {
    year: p.year,
    month: Number(p.month),
    day: Number(p.day),
    hh: p.hour,
    mm: p.minute,
    tz: p.timeZoneName,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tokyo · 8 Apr 2026, 22:00 GMT+9": the place's own local time. */
export function snapshotCaption({ place, datetimeUtc, zone }) {
  const t = localParts(datetimeUtc, zone);
  const when = `${t.day} ${MONTHS[t.month - 1]} ${t.year}, ${t.hh}:${t.mm} ${t.tz}`;
  return place ? `${place} · ${when}` : when;
}

/** "skyvault-tokyo-2026-04-08-2200.png", dated in the place's local time. */
export function snapshotFilename({ place, datetimeUtc, zone }) {
  const t = localParts(datetimeUtc, zone);
  const slug = (place ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  return `${["skyvault", slug, date, `${t.hh}${t.mm}`].filter(Boolean).join("-")}.png`;
}

function drawText(
  ctx,
  str,
  x,
  y,
  { font, color, alpha = 1, align = "left", baseline = "alphabetic", spacing = "0px", shadow }
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.letterSpacing = spacing;
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 4;
  }
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Project the panorama through the chart's own WebGL shader, then composite.
// Returns false (dark background, no ESO credit) if WebGL is unavailable.
function drawMilkyWay(ctx, { backdropImage, lat, lon, datetimeUtc }) {
  if (!backdropImage) return false;
  const glCanvas = document.createElement("canvas");
  glCanvas.width = SNAPSHOT_PX;
  glCanvas.height = SNAPSHOT_PX;
  const attrs = { preserveDrawingBuffer: true };
  const gl = glCanvas.getContext("webgl2", attrs) ?? glCanvas.getContext("webgl", attrs);
  if (!gl) return false;
  try {
    const renderer = createBackdropRenderer(gl);
    renderer.uploadImage(backdropImage);
    renderer.draw({ widthPx: SNAPSHOT_PX, heightPx: SNAPSHOT_PX, lat, lon, datetime: datetimeUtc });
  } catch {
    return false;
  }
  ctx.drawImage(glCanvas, 0, 0, SIZE, SIZE);
  return true;
}

/**
 * Render the snapshot to a new canvas. `stars`/`planets`/`dsos`/
 * `constellations` are the API payloads already on screen; pass an empty
 * `constellations` list when the overlay is off.
 */
export function renderSnapshot({
  stars,
  planets,
  dsos,
  constellations,
  lat,
  lon,
  datetimeUtc,
  caption,
  backdropImage,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = SNAPSHOT_PX;
  canvas.height = SNAPSHOT_PX;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const milkyWay = drawMilkyWay(ctx, { backdropImage, lat, lon, datetimeUtc });

  // Same layer order as the live chart: lines, DSOs, stars, planets.
  const figures = projectConstellations(constellations ?? [], SIZE, SIZE);
  drawConstellationLines(ctx, figures.lines, SCALE);
  for (const d of projectDsos(dsos ?? [], SIZE, SIZE)) drawDso(ctx, d);
  for (const s of projectStars(stars ?? [], SIZE, SIZE)) drawStar(ctx, s);
  const up = projectPlanets((planets ?? []).filter((p) => p.alt >= 0), SIZE, SIZE);
  for (const p of up) drawPlanet(ctx, p);

  // Labels, styled like the chart's DOM overlays.
  for (const p of up) {
    const flip = p.x > SIZE * 0.8;
    drawText(ctx, p.name, flip ? p.x - 10 : p.x + 10, p.y - 6, {
      font: `11px ${SERIF}`,
      color: "#ffffff",
      alpha: 0.75,
      align: flip ? "right" : "left",
      baseline: "top",
      spacing: "0.44px",
      shadow: "rgba(0, 0, 0, 0.8)",
    });
  }
  for (const l of figures.labels) {
    drawText(ctx, l.name.toUpperCase(), l.x, l.y, {
      font: `500 11px ${SERIF}`,
      color: "rgb(205, 222, 245)",
      alpha: 0.85,
      align: "center",
      baseline: "middle",
      spacing: "1.76px",
      shadow: "rgba(0, 0, 0, 0.95)",
    });
  }
  const cardinal = { font: `10px ${MONO}`, color: "rgb(106, 83, 41)", alpha: 0.8, spacing: "2.5px" };
  drawText(ctx, "N", SIZE / 2, 12, { ...cardinal, align: "center", baseline: "top" });
  drawText(ctx, "S", SIZE / 2, SIZE - 12, { ...cardinal, align: "center", baseline: "bottom" });
  drawText(ctx, "E", 12, SIZE / 2, { ...cardinal, align: "left", baseline: "middle" });
  drawText(ctx, "W", SIZE - 12, SIZE / 2, { ...cardinal, align: "right", baseline: "middle" });

  // Faint caption: there for context, never competing with the sky.
  if (caption) {
    drawText(ctx, caption, MARGIN, SIZE - MARGIN, {
      font: `11px ${MONO}`,
      color: "#dce1f0",
      alpha: 0.3,
      baseline: "bottom",
    });
  }

  // Credits, stacked up from the corner: only what's actually in the image.
  const credits = [
    milkyWay && CREDIT_MILKY_WAY,
    CREDIT_STARS,
    figures.lines.length > 0 && CREDIT_FIGURES,
  ].filter(Boolean);
  credits.forEach((line, i) => {
    drawText(ctx, line, SIZE - MARGIN, SIZE - MARGIN - i * 14, {
      font: `10px ${MONO}`,
      color: "#ffffff",
      alpha: 0.45,
      align: "right",
      baseline: "bottom",
    });
  });

  return canvas;
}

async function loadImage(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari needs the URL alive briefly after the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build the PNG for the current sky and download it. */
export async function saveSnapshot({ selected, datetimeUtc, stars, planets, dsos, constellations }) {
  const place = placeLabel(selected);
  const zone = selected?.timezone ?? undefined;

  // Canvas text silently falls back to a system font if the web font isn't loaded.
  await Promise.all(
    [`11px ${MONO}`, `11px ${SERIF}`, `500 11px ${SERIF}`].map((f) =>
      document.fonts?.load(f).catch(() => null)
    )
  );
  const backdropImage = await loadImage(MILKY_WAY_ASSET).catch(() => null);

  const canvas = renderSnapshot({
    stars,
    planets,
    dsos,
    constellations,
    lat: selected.lat,
    lon: selected.lon,
    datetimeUtc,
    caption: snapshotCaption({ place, datetimeUtc, zone }),
    backdropImage,
  });
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png")
  );
  downloadBlob(blob, snapshotFilename({ place, datetimeUtc, zone }));
}
