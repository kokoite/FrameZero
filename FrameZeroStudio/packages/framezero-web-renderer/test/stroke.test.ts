import type { MotionStroke } from "@framezero/schema";
import { describe, expect, it } from "vitest";
import { applyStroke } from "../src/stroke";
import { createMockCtx } from "./_mockCtx";

describe("applyStroke", () => {
  it("uses center alignment width and strokes once", () => {
    const mock = createMockCtx();
    applyStroke(mock.ctx, simplePath, stroke({ alignment: "center", width: 4 }));

    expect(mock.calls).toContainEqual(["lineWidth", 4]);
    expect(mock.calls.filter(([name]) => name === "stroke")).toHaveLength(1);
    expect(mock.calls.filter(([name]) => name === "clip")).toHaveLength(0);
    expect(mock.calls.filter(([name]) => name === "beginPath")).toHaveLength(1);
  });

  it("clips and re-paths before inside stroke", () => {
    const mock = createMockCtx();
    applyStroke(mock.ctx, simplePath, stroke({ alignment: "inside", width: 4, dash: [2, 3] }));

    expect(mock.calls).toEqual([
      ["save"],
      ["lineWidth", 8],
      ["lineCap", "butt"],
      ["lineJoin", "miter"],
      ["miterLimit", 10],
      ["setLineDash", [2, 3]],
      ["strokeStyle", "rgba(255, 0, 0, 1)"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["clip"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["stroke"],
      ["restore"]
    ]);
  });

  it("strokes then erases the interior for outside stroke", () => {
    const mock = createMockCtx();
    applyStroke(mock.ctx, simplePath, stroke({ alignment: "outside", width: 4, cap: "round", join: "bevel", miterLimit: 6 }));

    expect(mock.calls).toEqual([
      ["save"],
      ["lineWidth", 8],
      ["lineCap", "round"],
      ["lineJoin", "bevel"],
      ["miterLimit", 6],
      ["setLineDash", []],
      ["strokeStyle", "rgba(255, 0, 0, 1)"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["stroke"],
      ["globalCompositeOperation", "destination-out"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["fill"],
      ["restore"]
    ]);
  });
});

function stroke(overrides: Partial<MotionStroke> = {}): MotionStroke {
  return {
    color: "#FF0000",
    width: 2,
    alignment: "center",
    cap: "butt",
    join: "miter",
    ...overrides
  };
}

function simplePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
}
