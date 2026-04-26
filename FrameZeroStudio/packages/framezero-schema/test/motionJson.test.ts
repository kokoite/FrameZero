import { describe, expect, it } from "vitest";
import { documentUpdatePayloadSchema, makePreviewEnvelope, previewEnvelopeSchema, safeParseMotionDocument } from "../src/index";

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

  it("accepts structured solid, linear, and radial fills", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        {
          id: "screen",
          kind: "zstack",
          roles: ["screen"],
          layout: {},
          style: {},
          fills: [{ type: "solid", color: "#0B1020", opacity: 1 }],
          presentation: {},
          children: ["card", "orb"]
        },
        {
          id: "card",
          kind: "roundedRectangle",
          roles: ["actor"],
          layout: {},
          style: {},
          fills: [{
            type: "linearGradient",
            colors: [
              { color: "#25304A", position: 0 },
              { color: "#5ED8FF", position: 1 }
            ],
            angle: 120,
            opacity: 0.92
          }],
          presentation: {},
          children: []
        },
        {
          id: "orb",
          kind: "circle",
          roles: ["actor"],
          layout: {},
          style: {},
          fills: [{
            type: "radialGradient",
            colors: [
              { color: "#E0F2FE", position: 0 },
              { color: "#5ED8FF", position: 0.48 },
              { color: "#B58CFF", position: 1 }
            ],
            centerX: 0.35,
            centerY: 0.28,
            radius: 88
          }],
          presentation: {},
          children: []
        }
      ],
      machines: [],
      triggers: [],
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

describe("preview protocol schemas", () => {
  it("wraps preview messages in a versioned envelope", () => {
    const envelope = makePreviewEnvelope("hello", { client: "ios-simulator" }, { sessionId: "local", messageId: "test-id" });

    expect(previewEnvelopeSchema.parse(envelope)).toMatchObject({
      protocolVersion: 1,
      sessionId: "local",
      messageId: "test-id",
      type: "hello"
    });
  });

  it("validates document update payloads with full motion JSON", () => {
    const payload = documentUpdatePayloadSchema.parse({
      revision: 1,
      documentId: "demo",
      documentHash: "sha256:test",
      reason: "test",
      autoPlay: true,
      resetBeforePlay: true,
      json: {
        schemaVersion: 1,
        root: "screen",
        nodes: [
          { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: [] }
        ],
        machines: [],
        triggers: [],
        dragBindings: [],
        bodies: [],
        forces: []
      }
    });

    expect(payload.json.root).toBe("screen");
  });
});
