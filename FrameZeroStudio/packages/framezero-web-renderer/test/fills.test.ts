import type { MotionFill, MotionNode } from "@framezero/schema";
import { describe, expect, it } from "vitest";
import { applyFills, applyGradientTransform, buildLinearGradient, buildRadialGradient } from "../src/fills";
import { createMockCtx } from "./_mockCtx";

describe("fills", () => {
  it("builds linear gradient endpoints for Swift-compatible angles", () => {
    const angle0 = createMockCtx();
    buildLinearGradient(angle0.ctx, linearFill(0), 100, 80);
    expect(angle0.gradients[0]?.args).toEqual([0, 40, 100, 40]);

    const angle90 = createMockCtx();
    buildLinearGradient(angle90.ctx, linearFill(90), 100, 80);
    expectRounded(angle90.gradients[0]?.args, [50, 0, 50, 80]);

    const angle45 = createMockCtx();
    buildLinearGradient(angle45.ctx, linearFill(45), 100, 100);
    expectRounded(angle45.gradients[0]?.args, [
      50 - Math.sqrt(2) * 25,
      50 - Math.sqrt(2) * 25,
      50 + Math.sqrt(2) * 25,
      50 + Math.sqrt(2) * 25
    ]);
  });

  it("builds radial gradient center and radius from max dimension", () => {
    const mock = createMockCtx();
    buildRadialGradient(mock.ctx, radialFill({ centerX: 0.5, centerY: 0.5, radius: 0.5 }), 100, 100);
    expect(mock.gradients[0]?.args).toEqual([50, 50, 0, 50, 50, 50]);
  });

  it("rejects identity and singular gradient transforms", () => {
    const mock = createMockCtx();
    expect(applyGradientTransform(mock.ctx, [1, 0, 0, 1, 0, 0], 100, 200)).toBe(false);
    expect(applyGradientTransform(mock.ctx, [1, 2, 2, 4, 0.2, 0.3], 100, 200)).toBe(false);
    expect(mock.calls).toEqual([]);
  });

  it("scales normalized transform translation and leaves non-normalized translation raw", () => {
    const normalized = createMockCtx();
    expect(applyGradientTransform(normalized.ctx, [1, 0, 0, 1, 0.25, 0.5], 100, 200)).toBe(true);
    expect(normalized.calls).toEqual([["transform", 1, 0, 0, 1, 25, 100]]);

    const raw = createMockCtx();
    expect(applyGradientTransform(raw.ctx, [3, 0, 0, 3, 4, 5], 100, 200)).toBe(true);
    expect(raw.calls).toEqual([["transform", 3, 0, 0, 3, 4, 5]]);
  });

  it("bakes stop opacity into gradient color stops", () => {
    const mock = createMockCtx();
    buildLinearGradient(mock.ctx, linearFill(0), 100, 100);
    expect(mock.gradients[0]?.stops).toEqual([
      { offset: 0, color: "rgba(255, 0, 0, 0.25)" },
      { offset: 1, color: "rgba(0, 0, 255, 1)" }
    ]);
  });

  it("applies a solid fill through the supplied path", () => {
    const mock = createMockCtx();
    applyFills(mock.ctx, node([{ type: "solid", color: "#38BDF8", opacity: 0.5 }]), 100, 50, simplePath);
    expect(mock.calls).toEqual([
      ["save"],
      ["globalAlpha", 0.5],
      ["fillStyle", "rgba(56, 189, 248, 1)"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["fill"],
      ["restore"]
    ]);
  });

  it("falls back to style.backgroundColor when fills are empty", () => {
    const mock = createMockCtx();
    applyFills(mock.ctx, node([], { backgroundColor: "#111827" }), 100, 50, simplePath);
    expect(mock.calls).toEqual([
      ["fillStyle", "rgba(17, 24, 39, 1)"],
      ["beginPath"],
      ["moveTo", 0, 0],
      ["fill"]
    ]);
  });
});

function linearFill(angle: number): Extract<MotionFill, { type: "linearGradient" }> {
  return {
    type: "linearGradient",
    angle,
    colors: [
      { color: "#FF0000", position: 0, opacity: 0.25 },
      { color: "#0000FF", position: 1 }
    ]
  };
}

function radialFill(
  partial: Partial<Extract<MotionFill, { type: "radialGradient" }>>
): Extract<MotionFill, { type: "radialGradient" }> {
  return {
    type: "radialGradient",
    colors: [
      { color: "#FF0000", position: 0 },
      { color: "#0000FF", position: 1 }
    ],
    ...partial
  };
}

function node(fills: MotionFill[], style: MotionNode["style"] = {}): MotionNode {
  return {
    id: "node",
    kind: "roundedRectangle",
    roles: [],
    layout: {},
    style,
    fills,
    presentation: {},
    children: []
  };
}

function simplePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
}

function expectRounded(actual: number[] | undefined, expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual?.[index]).toBeCloseTo(value, 6);
  });
}
