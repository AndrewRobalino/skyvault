/**
 * WebGL renderer for the projected Milky Way panorama.
 *
 * Shared by the live chart (MilkyWayBackdrop) and the saved-image snapshot,
 * so both go through the one shader pipeline that guardrail #23 verified
 * against Astropy. Throws if the shader fails to build; callers fall back to
 * a dark fill.
 */
import { createProgram } from "./webgl.js";
import { computeLST } from "./coordinateTransforms.js";
import { PASSTHROUGH_VERT } from "./glsl/passthrough.vert.js";
import { INVERSE_PROJECTION_FRAG } from "./glsl/inverseProjection.frag.js";
import { REFERENCE_ALT } from "./projection.js";

export const MILKY_WAY_ASSET = "/milky-way.jpg";
const DEG = Math.PI / 180;

export function createBackdropRenderer(gl) {
  const program = createProgram(gl, PASSTHROUGH_VERT, INVERSE_PROJECTION_FRAG);

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

  // 1x1 dark placeholder until the panorama arrives.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([5, 7, 13, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    uploadImage(img) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    },

    /** Draw into the full drawing buffer (widthPx × heightPx device pixels). */
    draw({ widthPx, heightPx, lat, lon, datetime }) {
      gl.useProgram(program);
      gl.viewport(0, 0, widthPx, heightPx);
      gl.clearColor(0.02, 0.027, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.uMilkyWayTex, 0);

      gl.uniform2f(uniforms.uResolution, widthPx, heightPx);
      gl.uniform1f(uniforms.uReferenceAlt, REFERENCE_ALT * DEG);
      gl.uniform1f(uniforms.uLST, computeLST(datetime, lon));
      gl.uniform1f(uniforms.uObserverLat, lat * DEG);
      gl.uniform1f(uniforms.uBelowHorizonDim, 0.25);
      gl.uniform1f(uniforms.uHorizonHazeStart, 30 * DEG);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
