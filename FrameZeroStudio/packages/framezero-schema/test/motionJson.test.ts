import { describe, expect, it } from "vitest";
import { safeParseMotionDocument } from "../src/index";

describe("motionDocumentSchema", () => {
  it("accepts a role selector that targets multiple existing components", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card", "icon"] },
        { id: "card", kind: "roundedRectangle", roles: ["gesturePart"], layout: {}, style: {}, presentation: { "offset.x": 0 }, children: [] },
        { id: "icon", kind: "circle", roles: ["gesturePart"], layout: {}, style: {}, presentation: { "offset.x": 0 }, children: [] }
      ],
      machines: [
        {
          id: "main",
          initial: "idle",
          states: [
            { id: "idle", values: [{ select: { role: "gesturePart", properties: ["offset.x"] }, value: 0 }] },
            { id: "active", values: [{ select: { role: "gesturePart", properties: ["offset.x"] }, value: 64 }] }
          ],
          transitions: [
            {
              id: "moveBoth",
              from: "idle",
              to: "active",
              trigger: "after",
              rules: [
                {
                  select: { role: "gesturePart", properties: ["offset.x"] },
                  motion: { type: "timed", duration: 0.4, easing: "linear" }
                }
              ],
              arcs: [],
              jiggles: [],
              actions: []
            }
          ]
        }
      ],
      triggers: [{ id: "after", type: "after" }],
      dragBindings: [],
      bodies: [],
      forces: []
    });

    expect(result.success).toBe(true);
  });

  it("rejects ambiguous selectors", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: [] }
      ],
      machines: [],
      triggers: [
        {
          id: "badTap",
          type: "tap",
          selector: { id: "screen", role: "screen" }
        }
      ],
      dragBindings: [],
      bodies: [],
      forces: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate state assignments after role expansion", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card"] },
        { id: "card", kind: "roundedRectangle", roles: ["gesturePart"], layout: {}, style: {}, presentation: {}, children: [] }
      ],
      machines: [
        {
          id: "main",
          initial: "idle",
          states: [
            {
              id: "idle",
              values: [
                { select: { role: "gesturePart", properties: ["offset.x"] }, value: 0 },
                { select: { id: "card", properties: ["offset.x"] }, value: 12 }
              ]
            }
          ],
          transitions: []
        }
      ],
      triggers: [],
      dragBindings: [],
      bodies: [],
      forces: []
    });

    expect(result.success).toBe(false);
  });
});
