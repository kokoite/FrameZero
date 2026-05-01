import type { MotionDocument, MotionNode } from "@framezero/schema";
import { describe, expect, it, vi } from "vitest";
import { drawNodeShape } from "../src/draw";
import {
  applyLayerBlur,
  mapBlendMode,
  resolveBlendMode,
  resolveLayerBlur,
  resolveShadow
} from "../src/effects";
import { MotionCanvasRenderer, type MotionRuntime } from "../src/renderer";
import { createMockCtx } from "./_mockCtx";

describe("effects", () => {
  it("resolves typed shadow before legacy style shadow", () => {
    const subject = node({
      shadow: { x: 1, y: 2, blur: 3, opacity: 0.4, color: "#112233" },
      style: { shadowX: 10, shadowY: 20, shadowBlur: 30, shadowOpacity: 0.9, shadowColor: "#FFFFFF" }
    });

    expect(resolveShadow(subject)).toEqual({ x: 1, y: 2, blur: 3, opacity: 0.4, color: "#112233" });
  });

  it("resolves legacy shadow only when all style fields are present", () => {
    expect(resolveShadow(node({
      style: { shadowX: 4, shadowY: 8, shadowBlur: 12, shadowOpacity: 0.35, shadowColor: "#112233" }
    }))).toEqual({ x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" });

    expect(resolveShadow(node({ style: { shadowX: 4, shadowY: 8, shadowBlur: 12, shadowColor: "#112233" } }))).toBeUndefined();
  });

  it("applies drop shadow around the fill draw and restores it", () => {
    const mock = createMockCtx();
    drawNodeShape(mock.ctx, node({
      style: { backgroundColor: "#38BDF8" },
      shadow: { x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" }
    }), 100, 50);

    expect(mock.calls.slice(0, 6)).toEqual([
      ["save"],
      ["shadowColor", "rgba(17, 34, 51, 0.35)"],
      ["shadowBlur", 12],
      ["shadowOffsetX", 4],
      ["shadowOffsetY", 8],
      ["fillStyle", "rgba(56, 189, 248, 1)"]
    ]);
    expect(indexOf(mock.calls, "fill")).toBeLessThan(indexOf(mock.calls, "restore"));
  });

  it("does not write shadow state when no shadow is resolved", () => {
    const mock = createMockCtx();
    drawNodeShape(mock.ctx, node({ style: { backgroundColor: "#38BDF8" } }), 100, 50);

    expect(mock.calls.some(([name]) => String(name).startsWith("shadow"))).toBe(false);
  });

  it("applies inner shadow with clip, inverted offsets, and transparent stroke", () => {
    const mock = createMockCtx();
    drawNodeShape(mock.ctx, node({
      style: { backgroundColor: "#38BDF8" },
      shadow: { x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233", inset: true }
    }), 100, 50);

    expect(mock.calls).toContainEqual(["clip"]);
    expect(mock.calls).toContainEqual(["shadowColor", "rgba(17, 34, 51, 0.35)"]);
    expect(mock.calls).toContainEqual(["shadowOffsetX", -4]);
    expect(mock.calls).toContainEqual(["shadowOffsetY", -8]);
    expect(mock.calls).toContainEqual(["strokeStyle", "rgba(0,0,0,0)"]);
    expect(mock.calls).toContainEqual(["rect", -20, -20, 140, 90]);
    expect(mock.calls).not.toContainEqual(["shadowOffsetX", 4]);
  });

  it("places inner shadow after fill and before stroke", () => {
    const mock = createMockCtx();
    drawNodeShape(mock.ctx, node({
      style: { backgroundColor: "#38BDF8" },
      shadow: { x: 1, y: 2, blur: 3, opacity: 0.4, color: "#112233", inset: true },
      stroke: { color: "#FF0000", width: 2, alignment: "center", cap: "butt", join: "miter" }
    }), 100, 50);

    expect(indexOf(mock.calls, "fill")).toBeLessThan(indexOf(mock.calls, "clip"));
    expect(indexOf(mock.calls, "clip")).toBeLessThan(lastIndexOf(mock.calls, "strokeStyle"));
  });

  it("maps Canvas blend modes including plusLighter", () => {
    expect(mapBlendMode("multiply", "blend-multiply")).toBe("multiply");
    expect(mapBlendMode("plusLighter", "blend-plus-lighter")).toBe("lighter");
  });

  it("resolves typed blend mode before style blend mode", () => {
    expect(resolveBlendMode(node({ blendMode: "luminosity", style: { blendMode: "screen" } }))).toBe("luminosity");
  });

  it("resolves style blend mode and falls back invalid strings to normal", () => {
    expect(resolveBlendMode(node({ style: { blendMode: "screen" } }))).toBe("screen");
    expect(resolveBlendMode(node({ style: { blendMode: "frobnicate" } }))).toBe("normal");
  });

  it("warns once per node for plusDarker and maps it to multiply", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(mapBlendMode("plusDarker", "plus-darker-node")).toBe("multiply");
    expect(mapBlendMode("plusDarker", "plus-darker-node")).toBe("multiply");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("plusDarker has no Canvas2D primitive; using multiply approximation. Tracked for Phase 5b.");
    warn.mockRestore();
  });

  it("resolves typed layerBlur without halving", () => {
    expect(resolveLayerBlur(node({ layerBlur: 8, style: { blur: 20, figmaBlur: 40 } }))).toBe(8);
  });

  it("resolves style blur without halving", () => {
    expect(resolveLayerBlur(node({ style: { blur: 10, figmaBlur: 40 } }))).toBe(10);
  });

  it("resolves figmaBlur by halving only that legacy field", () => {
    expect(resolveLayerBlur(node({ style: { figmaBlur: 18 } }))).toBe(9);
  });

  it("applies positive layer blur and skips zero or negative values", () => {
    const positive = createMockCtx();
    applyLayerBlur(positive.ctx, 8);
    expect(positive.calls).toEqual([["filter", "blur(8px)"]]);

    const skipped = createMockCtx();
    applyLayerBlur(skipped.ctx, 0);
    applyLayerBlur(skipped.ctx, -1);
    expect(skipped.calls).toEqual([]);
  });

  it("restores shadow and filter state through the mock save stack", () => {
    const mock = createMockCtx();
    mock.ctx.save();
    mock.ctx.shadowColor = "rgba(1, 2, 3, 0.4)";
    mock.ctx.shadowBlur = 8;
    mock.ctx.shadowOffsetX = 2;
    mock.ctx.shadowOffsetY = 3;
    mock.ctx.filter = "blur(4px)";
    mock.ctx.restore();

    expect(mock.ctx.shadowColor).toBe("rgba(0, 0, 0, 0)");
    expect(mock.ctx.shadowBlur).toBe(0);
    expect(mock.ctx.shadowOffsetX).toBe(0);
    expect(mock.ctx.shadowOffsetY).toBe(0);
    expect(mock.ctx.filter).toBe("none");
  });

  it("orders blend mode, layer blur, and drop shadow within node rendering", () => {
    const mock = createMockCtx();
    const document = documentWith(node({
      id: "card",
      style: { backgroundColor: "#38BDF8" },
      shadow: { x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" },
      blendMode: "multiply",
      layerBlur: 6
    }));

    new MotionCanvasRenderer(runtimeFor(document), document, mock.ctx, { logicalSize: { width: 300, height: 200 } }).render();

    expect(indexOf(mock.calls, "globalCompositeOperation")).toBeLessThan(indexOf(mock.calls, "filter"));
    expect(indexOf(mock.calls, "filter")).toBeLessThan(indexOf(mock.calls, "shadowColor"));
    expect(indexOf(mock.calls, "shadowColor")).toBeLessThan(indexOf(mock.calls, "fill"));
    expect(mock.ctx.globalCompositeOperation).toBe("source-over");
    expect(mock.ctx.filter).toBe("none");
  });
});

function node(partial: Partial<MotionNode> = {}): MotionNode {
  return {
    id: "node",
    kind: "roundedRectangle",
    roles: [],
    layout: {},
    style: {},
    fills: [],
    presentation: {},
    children: [],
    ...partial
  };
}

function documentWith(child: MotionNode): MotionDocument {
  return {
    schemaVersion: 1,
    root: "root",
    nodes: [
      node({ id: "root", kind: "zstack", layout: { width: 300, height: 200 }, children: [child.id] }),
      child
    ],
    machines: [],
    triggers: [],
    dragBindings: [],
    bodies: [],
    forces: []
  };
}

function runtimeFor(document: MotionDocument): MotionRuntime {
  return {
    valueFor(nodeID: string, property: string, fallback = 0): number {
      const value = document.nodes.find((candidate) => candidate.id === nodeID)?.presentation[property];
      return typeof value === "number" ? value : fallback;
    }
  };
}

function indexOf(calls: Array<[string, ...unknown[]]>, name: string): number {
  return calls.findIndex(([callName]) => callName === name);
}

function lastIndexOf(calls: Array<[string, ...unknown[]]>, name: string): number {
  return calls.findLastIndex(([callName]) => callName === name);
}
