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
