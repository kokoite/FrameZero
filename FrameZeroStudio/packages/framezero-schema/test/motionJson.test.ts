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
            gradientTransform: [0, 308.67, -591.426, -2.6306, 245.55, -13.9789],
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

  it("rejects image nodes unless they are explicit locked assets", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "frame",
      nodes: [
        {
          id: "frame",
          kind: "zstack",
          roles: [],
          layout: {},
          style: {},
          presentation: {},
          children: ["glow"]
        },
        {
          id: "glow",
          kind: "image",
          roles: [],
          layout: { width: 250, height: 240 },
          style: { imageUrl: "/figma/voice/planet-3.svg", contentMode: "100% 100%" },
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

    expect(result.success).toBe(false);
  });

  it("accepts layered locked image nodes with clip and blend metadata", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "frame",
      nodes: [
        {
          id: "frame",
          kind: "zstack",
          roles: ["voiceGradient"],
          layout: { width: 375, height: 248 },
          style: { clip: true },
          presentation: { "offset.x": 0, "offset.y": 0, opacity: 1, scale: 1, rotation: 0 },
          children: ["glow"]
        },
        {
          id: "glow",
          kind: "image",
          roles: ["voiceGradient"],
          layout: { width: 250, height: 240 },
          style: { assetPolicy: "locked", imageUrl: "/figma/voice/planet-3.svg", contentMode: "100% 100%", blendMode: "screen" },
          presentation: { "offset.x": -0.5, "offset.y": 28, opacity: 0.8, scale: 1, "scale.y": -1, rotation: 0 },
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

  it("rejects image particles unless they are explicit locked assets", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "screen",
      nodes: [
        { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: [] }
      ],
      machines: [
        {
          id: "main",
          initial: "idle",
          states: [{ id: "idle", values: [] }, { id: "active", values: [] }],
          transitions: [
            {
              id: "burst",
              from: "idle",
              to: "active",
              trigger: "after",
              rules: [],
              arcs: [],
              jiggles: [],
              actions: [
                {
                  type: "emitParticles",
                  id: "imageBurst",
                  count: 1,
                  particle: {
                    kind: "image",
                    layout: { width: 20, height: 20 },
                    style: { imageUrl: "/asset.png" },
                    from: { opacity: 1 },
                    to: { opacity: 0 },
                    motion: { type: "timed", duration: 0.2 },
                    lifetime: 0.3
                  }
                }
              ]
            }
          ]
        }
      ],
      triggers: [{ id: "after", type: "after" }],
      dragBindings: [],
      bodies: [],
      forces: []
    });

    expect(result.success).toBe(false);
  });

  it("accepts vector path nodes with viewbox and effects metadata", () => {
    const result = safeParseMotionDocument({
      schemaVersion: 1,
      root: "blob",
      nodes: [
        {
          id: "blob",
          kind: "path",
          roles: ["voiceGradient"],
          layout: { width: 94.147, height: 120.008 },
          style: {
            backgroundColor: "#8320DA",
            pathData: "M 94.1469 34.4752 C 94.1469 53.5153 51.0265 120.0085 25.0298 120.0085 Z",
            viewBoxWidth: 94.147,
            viewBoxHeight: 120.008,
            blur: 50,
            blendMode: "plusLighter"
          },
          fills: [{ type: "solid", color: "#8320DA", opacity: 1 }],
          presentation: { "offset.x": -150.36, "offset.y": 7.06, opacity: 0.35, scale: 1, "scale.y": -1, rotation: -75 },
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
