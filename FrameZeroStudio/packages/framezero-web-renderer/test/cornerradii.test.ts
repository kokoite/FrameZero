import { describe, expect, it } from "vitest";
import { pathAsymmetricRoundRect } from "../src/layout";
import { createMockCtx } from "./_mockCtx";

describe("pathAsymmetricRoundRect", () => {
  it("draws only lines when all corner radii are zero", () => {
    const mock = createMockCtx();
    pathAsymmetricRoundRect(mock.ctx, 0, 0, 100, 100, radii(0, 0, 0, 0));

    expect(mock.calls.filter(([name]) => name === "lineTo")).toHaveLength(4);
    expect(mock.calls.filter(([name]) => name === "arc")).toHaveLength(0);
  });

  it("draws four arcs with expected centers and angles", () => {
    const mock = createMockCtx();
    pathAsymmetricRoundRect(mock.ctx, 0, 0, 100, 100, radii(10, 10, 10, 10));

    expect(mock.calls.filter(([name]) => name === "arc")).toEqual([
      ["arc", 90, 10, 10, -Math.PI / 2, 0],
      ["arc", 90, 90, 10, 0, Math.PI / 2],
      ["arc", 10, 90, 10, Math.PI / 2, Math.PI],
      ["arc", 10, 10, 10, Math.PI, 3 * Math.PI / 2]
    ]);
  });

  it("draws one arc when only top-left radius is set", () => {
    const mock = createMockCtx();
    pathAsymmetricRoundRect(mock.ctx, 0, 0, 100, 100, radii(20, 0, 0, 0));

    expect(mock.calls.filter(([name]) => name === "arc")).toEqual([
      ["arc", 20, 20, 20, Math.PI, 3 * Math.PI / 2]
    ]);
  });

  it("clamps each radius to half the minimum side", () => {
    const mock = createMockCtx();
    pathAsymmetricRoundRect(mock.ctx, 0, 0, 40, 20, radii(99, 99, 99, 99));

    expect(mock.calls.filter(([name]) => name === "arc")).toEqual([
      ["arc", 30, 10, 10, -Math.PI / 2, 0],
      ["arc", 30, 10, 10, 0, Math.PI / 2],
      ["arc", 10, 10, 10, Math.PI / 2, Math.PI],
      ["arc", 10, 10, 10, Math.PI, 3 * Math.PI / 2]
    ]);
  });
});

function radii(topLeft: number, topRight: number, bottomRight: number, bottomLeft: number) {
  return { topLeft, topRight, bottomRight, bottomLeft };
}
