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
    // jsdom normalizes #05070d → rgb(5, 7, 13). Accept either form.
    expect(fallback.style.background).toMatch(/(#05070d|rgb\(5,\s*7,\s*13\))/i);
  });

  it("renders a canvas when WebGL is available", () => {
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
