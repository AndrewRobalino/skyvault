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
      console.warn("[MilkyWayBackdrop] Mellinger image failed to load — keeping placeholder.");
    };
    img.src = MELLINGER_ASSET;

    return () => {
      glStateRef.current = null;
    };
  }, []);

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
