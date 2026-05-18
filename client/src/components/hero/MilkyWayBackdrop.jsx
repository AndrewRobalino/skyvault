import { useEffect, useRef, useState } from "react";
import { createProgram } from "../../utils/webgl.js";
import { computeLST } from "../../utils/coordinateTransforms.js";
import { PASSTHROUGH_VERT } from "../../utils/glsl/passthrough.vert.js";
import { INVERSE_PROJECTION_FRAG } from "../../utils/glsl/inverseProjection.frag.js";
import { REFERENCE_ALT } from "../../utils/projection.js";

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

const MILKY_WAY_ASSET = "/milky-way.jpg";
const DEG = Math.PI / 180;

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
  const [fallback] = useState(detectNoWebGL);

  useEffect(() => {
    if (fallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return;

    let program;
    try {
      program = createProgram(gl, PASSTHROUGH_VERT, INVERSE_PROJECTION_FRAG);
    } catch (err) {
      // Shader compile failures are rare on real hardware; if it happens we
      // leave the canvas transparent and the parent's dark background shows.
      console.warn("[MilkyWayBackdrop] Shader setup failed:", err.message);
      return;
    }

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
      uMilkyWayTex: gl.getUniformLocation(program, "uMilkyWayTex"),
      uBelowHorizonDim: gl.getUniformLocation(program, "uBelowHorizonDim"),
      uHorizonHazeStart: gl.getUniformLocation(program, "uHorizonHazeStart"),
    };

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([5, 7, 13, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    glStateRef.current = { gl, program, uniforms, texture };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!glStateRef.current) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.onerror = () => {
      console.warn("[MilkyWayBackdrop] Milky Way panorama failed to load — keeping placeholder.");
    };
    img.src = MILKY_WAY_ASSET;

    return () => {
      glStateRef.current = null;
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

    const { gl, program, uniforms, texture } = state;
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.027, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uMilkyWayTex, 0);

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
