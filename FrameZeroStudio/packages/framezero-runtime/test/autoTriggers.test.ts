import { describe, expect, it } from "vitest";
import { parseMotionDocument } from "@framezero/schema";
import { MotionRuntime } from "../src/runtime";

const docWithAfter = (delay: number): unknown => ({
  schemaVersion: 1,
  root: "screen",
  nodes: [
    { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card"] },
    {
      id: "card",
      kind: "roundedRectangle",
      roles: [],
      layout: { width: 100, height: 100 },
      style: {},
      presentation: { "offset.x": 0 },
      children: []
    }
  ],
  machines: [
    {
      id: "main",
      initial: "idle",
      states: [
        { id: "idle", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 0 }] },
        { id: "shifted", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 100 }] }
      ],
      transitions: [
        {
          id: "scheduled",
          from: "idle",
          to: "shifted",
          trigger: "afterIdle",
          delay,
          rules: [],
          arcs: [],
          jiggles: [],
          actions: []
        }
      ]
    }
  ],
  triggers: [{ id: "afterIdle", type: "after" }],
  dragBindings: [],
  bodies: [],
  forces: []
});

const docWithAutomatic = (delay = 0): unknown => ({
  schemaVersion: 1,
  root: "screen",
  nodes: [
    { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card"] },
    {
      id: "card",
      kind: "roundedRectangle",
      roles: [],
      layout: { width: 100, height: 100 },
      style: {},
      presentation: { "offset.x": 0 },
      children: []
    }
  ],
  machines: [
    {
      id: "main",
      initial: "idle",
      states: [
        { id: "idle", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 0 }] },
        { id: "shifted", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 100 }] }
      ],
      transitions: [
        {
          id: "auto",
          from: "idle",
          to: "shifted",
          trigger: "tick",
          delay,
          rules: [],
          arcs: [],
          jiggles: [],
          actions: []
        }
      ]
    }
  ],
  triggers: [{ id: "tick", type: "automatic" }],
  dragBindings: [],
  bodies: [],
  forces: []
});

describe("MotionRuntime auto/after trigger dispatch (Phase 7c-triggers)", () => {
  it("after-trigger fires when stateElapsed >= delay", () => {
    const doc = parseMotionDocument(docWithAfter(0.5));
    const runtime = new MotionRuntime(doc);
    expect(runtime.currentState("main")).toBe("idle");
    for (let i = 0; i < 24; i++) runtime.tick(1 / 60); // 0.4s — not yet
    expect(runtime.currentState("main")).toBe("idle");
    for (let i = 0; i < 12; i++) runtime.tick(1 / 60); // total 0.6s — should have fired by now
    expect(runtime.currentState("main")).toBe("shifted");
  });

  it("after-trigger with delay=0 fires on the first tick", () => {
    const doc = parseMotionDocument(docWithAfter(0));
    const runtime = new MotionRuntime(doc);
    runtime.tick(1 / 60);
    expect(runtime.currentState("main")).toBe("shifted");
  });

  it("automatic trigger fires when channels settled and idleElapsed >= delay", () => {
    const doc = parseMotionDocument(docWithAutomatic(0));
    const runtime = new MotionRuntime(doc);
    runtime.tick(1 / 60);
    expect(runtime.currentState("main")).toBe("shifted");
  });

  it("applyState does NOT mutate currentStates (Researcher's fix locked)", () => {
    const doc = parseMotionDocument(docWithAfter(0.5));
    const runtime = new MotionRuntime(doc);
    expect(runtime.currentState("main")).toBe("idle");
    // applyState directly — bypass the trigger machinery, just like Swift's
    // applyStateForTesting. Should NOT change currentState.
    runtime.applyState("main", "shifted");
    expect(runtime.currentState("main")).toBe("idle");
  });

  it("dispatchTrigger via handleTap mutates currentStates", () => {
    // Use a tap-trigger fixture so handleTap → dispatchTrigger fires the transition.
    const doc = parseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card"] },
        {
          id: "card",
          kind: "roundedRectangle",
          roles: [],
          layout: { width: 100, height: 100 },
          style: {},
          presentation: { "offset.x": 0 },
          children: []
        }
      ],
      machines: [
        {
          id: "main",
          initial: "idle",
          states: [
            { id: "idle", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 0 }] },
            { id: "active", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 100 }] }
          ],
          transitions: [
            {
              id: "press",
              from: "idle",
              to: "active",
              trigger: "tapCard",
              rules: [],
              arcs: [],
              jiggles: [],
              actions: []
            }
          ]
        }
      ],
      triggers: [{ id: "tapCard", type: "tap", selector: { id: "card" } }],
      dragBindings: [],
      bodies: [],
      forces: []
    });
    const runtime = new MotionRuntime(doc);
    expect(runtime.currentState("main")).toBe("idle");
    runtime.handleTap("card");
    expect(runtime.currentState("main")).toBe("active");
  });
});
