import { useEffect, useRef, useState } from "react";
import { createBackdropRenderer, MILKY_WAY_ASSET } from "../../utils/backdropRenderer.js";

/**
 * MilkyWayBackdrop — WebGL layer rendering an all-sky Milky Way panorama
 * projected through inverse stereographic AltAz onto the sky chart.
 *
 * Asset: ESO/S. Brunier GigaGalaxy Zoom panorama (eso0932a), galactic
 * equirectangular, CC BY 4.0. The fragment shader expects galactic coords
 * and applies the J2000 galactic→equatorial rotation internally — so any
 * open-licensed all-sky galactic equirectangular image is a drop-in.
 *
 * Attribution is rendered by the AttributionFooter sibling layer.
 * Source: https://www.eso.org/public/images/eso0932a/
 * License: https://creativecommons.org/licenses/by/4.0/
 */

// Probe at module/render time so the fallback decision is made before any
// effect runs — keeps us out of the setState-in-effect anti-pattern.
function detectNoWebGL() {
  if (typeof window === "undefined" || typeof document === "undefined") return true;
  try {
    const probe = document.createElement("canvas");
    return !(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return true;
  }
}

export default function MilkyWayBackdrop({ width, height, dpr, lat, lon, datetime }) {
  const canvasRef = useRef(null);
  const glStateRef = useRef(null);
  // Latest draw closure. The panorama usually finishes loading after the first
  // sky is drawn; its onload calls this so the texture actually appears.
  const drawRef = useRef(null);
  const [fallback] = useState(detectNoWebGL);

  useEffect(() => {
    if (fallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return;

    let renderer;
    try {
      renderer = createBackdropRenderer(gl);
    } catch (err) {
      // Shader compile failures are rare on real hardware; if it happens we
      // leave the canvas transparent and the parent's dark background shows.
      console.warn("[MilkyWayBackdrop] Shader setup failed:", err.message);
      return;
    }
    glStateRef.current = renderer;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!glStateRef.current) return;
      renderer.uploadImage(img);
      drawRef.current?.();
    };
    img.onerror = () => {
      console.warn("[MilkyWayBackdrop] Milky Way panorama failed to load — keeping placeholder.");
    };
    img.src = MILKY_WAY_ASSET;

    return () => {
      glStateRef.current = null;
      drawRef.current = null;
    };
  }, [fallback]);

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

    const draw = () =>
      state.draw({ widthPx: canvas.width, heightPx: canvas.height, lat, lon, datetime });
    drawRef.current = draw;
    draw();
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
