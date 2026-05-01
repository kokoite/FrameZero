import { describe, expect, it } from "vitest";
import { pathLine, pathPolygon, pathStar } from "../src/shapes";

interface RecordedCtx {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void;
  closePath: () => void;
  calls: Array<[string, ...unknown[]]>;
}

function recordingCtx(): RecordedCtx {
  const calls: Array<[string, ...unknown[]]> = [];
  return {
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (x, y) => calls.push(["moveTo", round(x), round(y)]),
    lineTo: (x, y) => calls.push(["lineTo", round(x), round(y)]),
    arcTo: (x1, y1, x2, y2, r) =>
      calls.push(["arcTo", round(x1), round(y1), round(x2), round(y2), round(r)]),
    closePath: () => calls.push(["closePath"]),
    calls
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe("pathPolygon", () => {
  it("emits N vertices for a regular n-gon with cornerRadius=0", () => {
    const ctx = recordingCtx();
    pathPolygon(ctx, { sides: 6, cornerRadius: 0 }, 100, 100);
    const moves = ctx.calls.filter((c) => c[0] === "moveTo");
    const lines = ctx.calls.filter((c) => c[0] === "lineTo");
    const closes = ctx.calls.filter((c) => c[0] === "closePath");
    expect(moves).toHaveLength(1);
    expect(lines).toHaveLength(5); // 6 vertices total: 1 moveTo + 5 lineTo
    expect(closes).toHaveLength(1);
  });

  it("emits N arcTo commands for cornerRadius>0", () => {
    const ctx = recordingCtx();
    pathPolygon(ctx, { sides: 5, cornerRadius: 4 }, 100, 100);
    const arcs = ctx.calls.filter((c) => c[0] === "arcTo");
    expect(arcs).toHaveLength(5);
  });

  it("clamps corner radius to half the shorter adjacent edge", () => {
    const ctx = recordingCtx();
    pathPolygon(ctx, { sides: 4, cornerRadius: 1000 }, 100, 100);
    const arcs = ctx.calls.filter((c) => c[0] === "arcTo");
    for (const arc of arcs) {
      const r = arc[5] as number;
      expect(r).toBeLessThanOrEqual(50);
    }
  });

  it("first vertex starts at top of circle (-π/2 radians)", () => {
    const ctx = recordingCtx();
    pathPolygon(ctx, { sides: 4, cornerRadius: 0 }, 200, 200);
    // sides=4 → vertices at angles -π/2, 0, π/2, π → (cx, cy-R), (cx+R, cy), (cx, cy+R), (cx-R, cy)
    // R = min(200,200)/2 = 100, cx=cy=100
    expect(ctx.calls[1]).toEqual(["moveTo", 100, 0]); // top
  });
});

describe("pathStar", () => {
  it("emits 2N vertices for an N-pointed star with cornerRadius=0", () => {
    const ctx = recordingCtx();
    pathStar(ctx, { points: 5, innerRadius: 0.5, cornerRadius: 0 }, 100, 100);
    const moves = ctx.calls.filter((c) => c[0] === "moveTo");
    const lines = ctx.calls.filter((c) => c[0] === "lineTo");
    expect(moves).toHaveLength(1);
    expect(lines).toHaveLength(9); // 10 verts: 1 moveTo + 9 lineTo
  });

  it("alternates outer/inner radius vertices", () => {
    const ctx = recordingCtx();
    pathStar(ctx, { points: 3, innerRadius: 0.5, cornerRadius: 0 }, 100, 100);
    // Distance from center for vertices alternates R=50 and r=25
    const cx = 50;
    const cy = 50;
    const distances: number[] = [];
    for (const call of ctx.calls) {
      if (call[0] === "moveTo" || call[0] === "lineTo") {
        const x = call[1] as number;
        const y = call[2] as number;
        distances.push(Math.hypot(x - cx, y - cy));
      }
    }
    // 6 vertices total, alternating ~50 and ~25
    expect(distances).toHaveLength(6);
    // even indices ≈ 50 (outer), odd indices ≈ 25 (inner)
    expect(distances[0]).toBeCloseTo(50, 1);
    expect(distances[1]).toBeCloseTo(25, 1);
    expect(distances[2]).toBeCloseTo(50, 1);
    expect(distances[3]).toBeCloseTo(25, 1);
  });

  it("handles innerRadius=1 (degenerate) without crashing", () => {
    const ctx = recordingCtx();
    pathStar(ctx, { points: 4, innerRadius: 1, cornerRadius: 0 }, 80, 80);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });
});

describe("pathLine", () => {
  it("emits a single moveTo + lineTo for endpoints", () => {
    const ctx = recordingCtx();
    pathLine(ctx, { from: { x: 0, y: 10 }, to: { x: 100, y: 10 } });
    expect(ctx.calls).toEqual([
      ["beginPath"],
      ["moveTo", 0, 10],
      ["lineTo", 100, 10]
    ]);
  });

  it("preserves negative coordinates (lines may extend outside bounds)", () => {
    const ctx = recordingCtx();
    pathLine(ctx, { from: { x: -10, y: -10 }, to: { x: 50, y: 50 } });
    expect(ctx.calls).toEqual([
      ["beginPath"],
      ["moveTo", -10, -10],
      ["lineTo", 50, 50]
    ]);
  });

  it("does NOT call closePath (line is open)", () => {
    const ctx = recordingCtx();
    pathLine(ctx, { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } });
    expect(ctx.calls.find((c) => c[0] === "closePath")).toBeUndefined();
  });
});
