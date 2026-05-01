import { describe, expect, it } from "vitest";
import { parseMotionDocument } from "@framezero/schema";
import { MotionRuntime } from "../src/runtime";

const dragDocument = (): unknown => ({
  schemaVersion: 1,
  root: "screen",
  nodes: [
    {
      id: "screen",
      kind: "zstack",
      roles: ["screen"],
      layout: {},
      style: {},
      presentation: {},
      children: ["orb"]
    },
    {
      id: "orb",
      kind: "circle",
      roles: ["actor"],
      layout: { width: 120, height: 120 },
      style: {},
      presentation: { "offset.x": 0, "offset.y": 0, "scale.x": 1, "scale.y": 1, scale: 1 },
      children: []
    }
  ],
  machines: [
    {
      id: "main",
      initial: "idle",
      states: [
        {
          id: "idle",
          values: [
            { select: { id: "orb", properties: ["offset.x"] }, value: 0 },
            { select: { id: "orb", properties: ["offset.y"] }, value: 0 }
          ]
        }
      ],
      transitions: []
    }
  ],
  triggers: [],
  dragBindings: [
    {
      id: "orbSling",
      type: "slingshot",
      selector: { id: "orb" },
      maxPull: 200,
      minLaunchPull: 24,
      launchPower: 6,
      chargeScale: 1.2
    }
  ],
  bodies: [],
  forces: []
});

const sample = (translationX: number, translationY: number, predictedX = translationX, predictedY = translationY) => ({
  translationX,
  translationY,
  predictedTranslationX: predictedX,
  predictedTranslationY: predictedY
});

describe("MotionRuntime drag bindings", () => {
  it("hasDragBinding identifies bound nodes via parent walk", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    expect(runtime.hasDragBinding("orb")).toBe(true);
    expect(runtime.hasDragBinding("screen")).toBe(false);
  });

  it("handleDragChanged moves the offset channels by the translation", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    runtime.handleDragChanged("orb", sample(50, 30));
    expect(runtime.valueFor("orb", "offset.x")).toBeCloseTo(50, 5);
    expect(runtime.valueFor("orb", "offset.y")).toBeCloseTo(30, 5);
  });

  it("clamps drag distance to maxPull", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    // pull (300, 0) on maxPull=200 should clamp to (200, 0)
    runtime.handleDragChanged("orb", sample(300, 0));
    expect(runtime.valueFor("orb", "offset.x")).toBeCloseTo(200, 5);
    expect(runtime.valueFor("orb", "offset.y")).toBeCloseTo(0, 5);
  });

  it("applies chargeScale and stretch to scale channels", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    // Full pull: charge=1, scale = 1 + (1.2 - 1)*1 = 1.2
    runtime.handleDragChanged("orb", sample(200, 0));
    expect(runtime.valueFor("orb", "scale")).toBeCloseTo(1.2, 5);
    // stretchX default 0.16 → scale.x = 1 + 0.16*1 = 1.16
    expect(runtime.valueFor("orb", "scale.x")).toBeCloseTo(1.16, 5);
    // stretchY default -0.08 → scale.y = 1 + (-0.08)*1 = 0.92
    expect(runtime.valueFor("orb", "scale.y")).toBeCloseTo(0.92, 5);
  });

  it("handleDragEnded snaps back to anchor when pull is below minLaunchPull", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    runtime.handleDragChanged("orb", sample(10, 0));
    expect(runtime.valueFor("orb", "offset.x")).toBeCloseTo(10, 5);

    runtime.handleDragEnded("orb", sample(10, 0));
    // Snap-back uses a spring; advance a few ticks and verify approach to anchor (0, 0).
    for (let i = 0; i < 60; i++) runtime.tick(1 / 60);
    expect(runtime.valueFor("orb", "offset.x")).toBeCloseTo(0, 1);
    expect(runtime.valueFor("orb", "offset.y")).toBeCloseTo(0, 1);
    expect(runtime.valueFor("orb", "scale")).toBeCloseTo(1, 1);
    expect(runtime.valueFor("orb", "scale.x")).toBeCloseTo(1, 1);
    expect(runtime.valueFor("orb", "scale.y")).toBeCloseTo(1, 1);
  });

  it("handleDragChanged is a no-op for nodes without a binding", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    runtime.handleDragChanged("screen", sample(50, 50));
    // screen has no offset.x channel; valueFor falls through to fallback.
    expect(runtime.valueFor("screen", "offset.x", 999)).toBe(999);
  });

  it("re-uses original anchor across multiple handleDragChanged calls", () => {
    const doc = parseMotionDocument(dragDocument());
    const runtime = new MotionRuntime(doc);
    runtime.handleDragChanged("orb", sample(40, 0));
    runtime.handleDragChanged("orb", sample(80, 0));
    runtime.handleDragChanged("orb", sample(120, 0));
    // Final position should be 120 (anchor 0 + 120), not cumulative.
    expect(runtime.valueFor("orb", "offset.x")).toBeCloseTo(120, 5);
  });
});
