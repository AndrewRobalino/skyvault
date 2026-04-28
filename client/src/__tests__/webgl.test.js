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
