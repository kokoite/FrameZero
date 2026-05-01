import { afterEach, describe, expect, it, vi } from "vitest";
import type { MotionDocument, MotionNode } from "@framezero/schema";

const mocks = vi.hoisted(() => {
  const runtimes: MockRuntime[] = [];
  const renderers: MockRenderer[] = [];

  class MockRuntime {
    readonly values = new Map<string, number>();
    readonly tick = vi.fn();
    readonly handleTap = vi.fn();
    readonly handleDragChanged = vi.fn();
    readonly handleDragEnded = vi.fn();
    readonly hasDragBinding = vi.fn(() => false);

    constructor(readonly document: MotionDocument, readonly options: unknown) {
      runtimes.push(this);
    }

    valueFor(nodeID: string, property: string, fallback = 0): number {
      return this.values.get(`${nodeID}:${property}`) ?? fallback;
    }
  }

  class MockRenderer {
    readonly render = vi.fn();
    readonly setSize = vi.fn();

    constructor(
      readonly runtime: MockRuntime,
      readonly document: MotionDocument,
      readonly ctx: unknown,
      readonly options: unknown
    ) {
      renderers.push(this);
    }
  }

  return { MockRuntime, MockRenderer, runtimes, renderers };
});

vi.mock("@framezero/runtime", () => ({ MotionRuntime: mocks.MockRuntime }));
vi.mock("@framezero/web-renderer", () => ({ MotionCanvasRenderer: mocks.MockRenderer }));

import {
  hitTest,
  isMotionRendererEnabled,
  startMotionPreviewLoop,
  syncMotionPreviewRuntime,
  toCanvasCoords,
  type MotionPreviewRuntimeState
} from "./MotionPreview";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.runtimes.length = 0;
  mocks.renderers.length = 0;
});

describe("isMotionRendererEnabled", () => {
  it("parses query and env feature flags", () => {
    expect(isMotionRendererEnabled("", undefined)).toBe(false);
    expect(isMotionRendererEnabled("?renderer=motion", undefined)).toBe(true);
    expect(isMotionRendererEnabled("", "motion")).toBe(true);
  });
});

describe("MotionPreview runtime lifecycle", () => {
  it("constructs for valid documents, preserves the last runtime for null, and replaces for new documents", () => {
    const canvas = canvasWithContext();
    const state: MotionPreviewRuntimeState = { runtime: null, renderer: null, document: null };
    const firstDocument = documentWithNodes([node("root", 600, 400)]);
    const nextDocument = documentWithNodes([node("root", 600, 400), node("card", 100, 80)]);

    syncMotionPreviewRuntime(state, canvas, firstDocument, 600, 400);
    const firstRuntime = state.runtime;

    syncMotionPreviewRuntime(state, canvas, null, 600, 400);
    expect(state.runtime).toBe(firstRuntime);
    expect(mocks.runtimes).toHaveLength(1);

    syncMotionPreviewRuntime(state, canvas, nextDocument, 600, 400);
    expect(state.runtime).not.toBe(firstRuntime);
    expect(mocks.runtimes).toHaveLength(2);
    expect(mocks.renderers).toHaveLength(2);
    expect(mocks.renderers[1]?.setSize).toHaveBeenCalledWith(600, 400, 1);
  });
});

describe("startMotionPreviewLoop", () => {
  it("cancels the scheduled RAF on cleanup", () => {
    const requestAnimationFrameSpy = vi.fn(() => 42);
    const cancelAnimationFrameSpy = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameSpy);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameSpy);

    const cleanup = startMotionPreviewLoop({
      runtimeRef: { current: null },
      rendererRef: { current: null },
      rafRef: { current: null },
      lastRef: { current: 0 }
    });
    cleanup();

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
  });
});

describe("hitTest", () => {
  it("returns the topmost overlapping node and undefined on miss", () => {
    const doc = documentWithNodes([
      node("root", 600, 400),
      node("back", 120, 120),
      node("front", 120, 120)
    ]);
    const runtime = new mocks.MockRuntime(doc, {});

    expect(hitTest(doc, runtime, 0, 0)?.id).toBe("front");
    expect(hitTest(doc, runtime, 400, 300)).toBeUndefined();
  });
});

describe("toCanvasCoords", () => {
  it("maps client coordinates to center-origin canvas coordinates", () => {
    const canvas = {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 300, height: 200 })
    } as unknown as HTMLCanvasElement;

    expect(toCanvasCoords(canvas, 160, 120, 600, 400)).toEqual({ x: 0, y: 0 });
    expect(toCanvasCoords(canvas, 10, 20, 600, 400)).toEqual({ x: -300, y: -200 });
  });
});

function canvasWithContext(): HTMLCanvasElement {
  return {
    getContext: () => ({}),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 })
  } as unknown as HTMLCanvasElement;
}

function documentWithNodes(nodes: MotionNode[]): MotionDocument {
  return {
    schemaVersion: 1,
    root: nodes[0]?.id ?? "root",
    nodes,
    machines: [],
    triggers: [],
    dragBindings: [],
    bodies: [],
    forces: []
  };
}

function node(id: string, width: number, height: number): MotionNode {
  return {
    id,
    kind: "roundedRectangle",
    roles: [],
    layout: { width, height },
    style: {},
    fills: [],
    presentation: {},
    children: []
  };
}
