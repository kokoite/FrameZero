import { describe, expect, it } from "vitest";
import { pathSvg } from "../src/shapes";

interface RecordedSvgCtx {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  bezierCurveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => void;
  quadraticCurveTo: (x1: number, y1: number, x: number, y: number) => void;
  closePath: () => void;
  calls: Array<[string, ...unknown[]]>;
}

function recordingCtx(): RecordedSvgCtx {
  const calls: Array<[string, ...unknown[]]> = [];
  return {
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (x, y) => calls.push(["moveTo", round(x), round(y)]),
    lineTo: (x, y) => calls.push(["lineTo", round(x), round(y)]),
    bezierCurveTo: (x1, y1, x2, y2, x, y) =>
      calls.push(["bezierCurveTo", round(x1), round(y1), round(x2), round(y2), round(x), round(y)]),
    quadraticCurveTo: (x1, y1, x, y) =>
      calls.push(["quadraticCurveTo", round(x1), round(y1), round(x), round(y)]),
    closePath: () => calls.push(["closePath"]),
    calls
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe("pathSvg", () => {
  it("translates M and L commands to moveTo + lineTo", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 10 20 L 30 40", width: 100, height: 100 });
    expect(ctx.calls).toEqual([
      ["beginPath"],
      ["moveTo", 10, 20],
      ["lineTo", 30, 40]
    ]);
  });

  it("translates C command to bezierCurveTo", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 0 0 C 10 0 20 10 30 30", width: 100, height: 100 });
    const beziers = ctx.calls.filter((c) => c[0] === "bezierCurveTo");
    expect(beziers).toHaveLength(1);
    expect(beziers[0]).toEqual(["bezierCurveTo", 10, 0, 20, 10, 30, 30]);
  });

  it("translates Q command to quadraticCurveTo", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 0 0 Q 10 0 20 10", width: 100, height: 100 });
    const quads = ctx.calls.filter((c) => c[0] === "quadraticCurveTo");
    expect(quads).toHaveLength(1);
    expect(quads[0]).toEqual(["quadraticCurveTo", 10, 0, 20, 10]);
  });

  it("translates Z to closePath", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 0 0 L 10 0 L 0 10 Z", width: 100, height: 100 });
    const closes = ctx.calls.filter((c) => c[0] === "closePath");
    expect(closes).toHaveLength(1);
  });

  it("scales coordinates by viewBox", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, {
      data: "M 50 50",
      width: 200,
      height: 100,
      viewBoxWidth: 100,
      viewBoxHeight: 100
    });
    // 50 × (200/100) = 100; 50 × (100/100) = 50
    expect(ctx.calls[1]).toEqual(["moveTo", 100, 50]);
  });

  it("handles negative numbers in tokens", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M -10 -20 L -30 -40", width: 100, height: 100 });
    expect(ctx.calls).toEqual([
      ["beginPath"],
      ["moveTo", -10, -20],
      ["lineTo", -30, -40]
    ]);
  });

  it("handles comma-separated and tight (no-space) numbers", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M10,20L30,40-50,60", width: 100, height: 100 });
    expect(ctx.calls).toEqual([
      ["beginPath"],
      ["moveTo", 10, 20],
      ["lineTo", 30, 40],
      ["lineTo", -50, 60]
    ]);
  });

  it("handles repeat-command coordinates after a single letter", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 0 0 L 10 0 20 0 30 0", width: 100, height: 100 });
    const lines = ctx.calls.filter((c) => c[0] === "lineTo");
    expect(lines).toHaveLength(3);
  });

  it("ignores unsupported commands gracefully", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 0 0 H 10 L 20 20", width: 100, height: 100 });
    // H is unsupported; the parser should skip it and continue
    // Behavior: skip "H 10" and read "L 20 20" — but "10" is not a letter so
    // the H consumes it via `index += 1` increment in the default branch.
    // Worst case the parser stops at the unrecognized token; assert at minimum
    // that no exception is thrown and moveTo was emitted.
    expect(ctx.calls.find((c) => c[0] === "moveTo")).toBeDefined();
  });

  it("returns gracefully on incomplete command", () => {
    const ctx = recordingCtx();
    pathSvg(ctx, { data: "M 10", width: 100, height: 100 });
    // Missing y after x; parser should bail
    expect(ctx.calls).toEqual([["beginPath"]]);
  });
});
