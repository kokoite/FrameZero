import { describe, expect, it } from "vitest";
import { blendModeSchema, cornerRadiiSchema, documentUpdatePayloadSchema, linePointSchema, lineSpecSchema, makePreviewEnvelope, motionNodeSchema, parseMotionDocument, polygonSpecSchema, previewEnvelopeSchema, safeParseMotionDocument, shadowSpecSchema, starSpecSchema, strokeSpecSchema } from "../src/index";

describe("motionDocumentSchema", () => {
  it("accepts reduce motion policy and motion sensitivity fields without defaulting absent keys", () => {
    const document = minimalMotionDocument({
      reduceMotionPolicy: "respect",
      rule: { motionSensitivity: "essential" }
    });

    const parsed = parseMotionDocument(document);

    expect(parsed.reduceMotionPolicy).toBe("respect");
    expect(parsed.machines[0]?.transitions[0]?.rules[0]?.motionSensitivity).toBe("essential");
  });

  it("rejects invalid reduce motion policy values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      reduceMotionPolicy: "foo"
    }));

    expect(result.success).toBe(false);
  });

  it("keeps reduce motion keys absent when not authored", () => {
    const parsed = parseMotionDocument(minimalMotionDocument());
    const transition = parsed.machines[0]?.transitions[0];

    expect(Object.keys(parsed)).not.toContain("reduceMotionPolicy");
    expect(Object.keys(transition?.rules[0] ?? {})).not.toContain("motionSensitivity");
  });

  it("accepts rule stagger values without changing them", () => {
    const parsed = parseMotionDocument(minimalMotionDocument({
      rule: { stagger: 0.06 }
    }));

    expect(parsed.machines[0]?.transitions[0]?.rules[0]?.stagger).toBe(0.06);
  });

  it("rejects negative rule stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { stagger: -0.1 }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects string rule stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { stagger: "0.1" }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects NaN rule stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { stagger: Number.NaN }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects negative arc stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      arc: { stagger: -0.1 }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects string arc stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      arc: { stagger: "0.1" }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects NaN arc stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      arc: { stagger: Number.NaN }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects negative jiggle stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      jiggle: { stagger: -0.1 }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects string jiggle stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      jiggle: { stagger: "0.1" }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects NaN jiggle stagger values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      jiggle: { stagger: Number.NaN }
    }));

    expect(result.success).toBe(false);
  });

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

  it("accepts existing timed easing keywords", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: "easeOut" } }
    }));

    expect(result.success).toBe(true);
  });

  it("accepts cubic-bezier timed easing", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.25, 0.1, 0.25, 1] } } }
    }));

    expect(result.success).toBe(true);
  });

  it("rejects cubic-bezier easing when x1 is below zero", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [-0.1, 0, 0.5, 1] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier easing when x2 is above one", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 1.1, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier easing with three tuple elements", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier easing with five tuple elements", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5, 0.5, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier easing objects with extra keys", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5, 0.5], extra: 1 } } }
    }));

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

describe("strokeSpecSchema", () => {
  it("accepts full typed stroke", () => {
    const stroke = strokeSpecSchema.parse({
      color: "#FF0000",
      width: 2,
      alignment: "inside",
      dash: [4, 2],
      cap: "round",
      join: "round",
      miterLimit: 8
    });

    expect(stroke).toEqual({
      color: "#FF0000",
      width: 2,
      alignment: "inside",
      dash: [4, 2],
      cap: "round",
      join: "round",
      miterLimit: 8
    });
  });

  it("accepts required fields and applies defaults", () => {
    const stroke = strokeSpecSchema.parse({ color: "#FF0000", width: 2 });

    expect(stroke).toEqual({
      color: "#FF0000",
      width: 2,
      alignment: "center",
      cap: "butt",
      join: "miter"
    });
  });

  it("rejects negative width", () => {
    expect(strokeSpecSchema.safeParse({ color: "#FF0000", width: -1 }).success).toBe(false);
  });

  it("rejects empty dash", () => {
    expect(strokeSpecSchema.safeParse({ color: "#FF0000", width: 2, dash: [] }).success).toBe(false);
  });

  it("rejects all-zero dash", () => {
    expect(strokeSpecSchema.safeParse({ color: "#FF0000", width: 2, dash: [0, 0] }).success).toBe(false);
  });

  it("rejects unknown alignment", () => {
    expect(strokeSpecSchema.safeParse({ color: "#FF0000", width: 2, alignment: "outer" }).success).toBe(false);
  });

  it("rejects non-hex color", () => {
    expect(strokeSpecSchema.safeParse({ color: "red", width: 2 }).success).toBe(false);
  });

  it("accepts motion nodes with typed stroke embedded", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      stroke: { color: "#000000", width: 1 }
    });

    expect(node.stroke).toEqual({
      color: "#000000",
      width: 1,
      alignment: "center",
      cap: "butt",
      join: "miter"
    });
  });

  it("keeps untyped stroke style keys parseable", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      style: { strokeWidth: 2, strokeColor: "#FF0000" }
    });

    expect(node).not.toHaveProperty("stroke");
    expect(node.style.strokeWidth).toBe(2);
    expect(node.style.strokeColor).toBe("#FF0000");
  });
});

describe("cornerRadiiSchema", () => {
  it("accepts full corner radii", () => {
    const radii = cornerRadiiSchema.parse({
      topLeft: 12,
      topRight: 0,
      bottomLeft: 4,
      bottomRight: 24
    });

    expect(radii).toEqual({
      topLeft: 12,
      topRight: 0,
      bottomLeft: 4,
      bottomRight: 24
    });
  });

  it("rejects negative values on any corner", () => {
    for (const field of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      expect(cornerRadiiSchema.safeParse({
        topLeft: 12,
        topRight: 0,
        bottomLeft: 4,
        bottomRight: 24,
        [field]: -1
      }).success).toBe(false);
    }
  });

  it("rejects non-finite values", () => {
    expect(cornerRadiiSchema.safeParse({
      topLeft: Number.NaN,
      topRight: 0,
      bottomLeft: 4,
      bottomRight: 24
    }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(cornerRadiiSchema.safeParse({
      topLeft: 12,
      topRight: 0,
      bottomLeft: 4
    }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(cornerRadiiSchema.safeParse({
      topLeft: 12,
      topRight: 0,
      bottomLeft: 4,
      bottomRight: 24,
      extra: 8
    }).success).toBe(false);
  });

  it("accepts motion nodes with corner radii embedded", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      cornerRadii: { topLeft: 12, topRight: 0, bottomLeft: 4, bottomRight: 24 }
    });

    expect(node.cornerRadii).toEqual({ topLeft: 12, topRight: 0, bottomLeft: 4, bottomRight: 24 });
  });

  it("accepts motion nodes with typed corner radius", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      cornerRadius: 8
    });

    expect(node.cornerRadius).toBe(8);
  });

  it("rejects negative typed corner radius", () => {
    expect(motionNodeSchema.safeParse({
      id: "card",
      kind: "roundedRectangle",
      cornerRadius: -1
    }).success).toBe(false);
  });

  it("rejects non-finite typed corner radius", () => {
    expect(motionNodeSchema.safeParse({
      id: "card",
      kind: "roundedRectangle",
      cornerRadius: Number.NaN
    }).success).toBe(false);
  });

  it("keeps untyped corner radius style keys parseable", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      style: { cornerRadius: 8 }
    });

    expect(node).not.toHaveProperty("cornerRadius");
    expect(node).not.toHaveProperty("cornerRadii");
    expect(node.style.cornerRadius).toBe(8);
  });

  it("keeps style corner radius parseable without typed corner radius", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      style: { cornerRadius: 8 }
    });

    expect(node.cornerRadius).toBeUndefined();
    expect(node.style.cornerRadius).toBe(8);
  });
});

describe("shadowSpecSchema and layerBlur", () => {
  const shadow = { x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" };

  it("accepts full shadow", () => {
    expect(shadowSpecSchema.parse(shadow)).toEqual(shadow);
  });

  it("rejects negative blur", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, blur: -1 }).success).toBe(false);
  });

  it("rejects opacity greater than 1", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, opacity: 1.1 }).success).toBe(false);
  });

  it("rejects opacity less than 0", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, opacity: -0.1 }).success).toBe(false);
  });

  it("rejects non-hex color", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, color: "red" }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, spread: 2 }).success).toBe(false);
  });

  it("rejects non-finite x, y, and blur values", () => {
    expect(shadowSpecSchema.safeParse({ ...shadow, x: Number.NaN }).success).toBe(false);
    expect(shadowSpecSchema.safeParse({ ...shadow, y: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(shadowSpecSchema.safeParse({ ...shadow, blur: Number.POSITIVE_INFINITY }).success).toBe(false);
  });

  it("accepts layerBlur", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      layerBlur: 6
    });

    expect(node.layerBlur).toBe(6);
  });

  it("rejects negative layerBlur", () => {
    expect(motionNodeSchema.safeParse({
      id: "card",
      kind: "roundedRectangle",
      layerBlur: -1
    }).success).toBe(false);
  });

  it("accepts node with typed shadow and layerBlur", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      shadow,
      layerBlur: 6
    });

    expect(node.shadow).toEqual(shadow);
    expect(node.layerBlur).toBe(6);
  });

  it("keeps untyped shadow style keys parseable", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      style: {
        shadowX: 4,
        shadowY: 8,
        shadowBlur: 12,
        shadowOpacity: 0.35,
        shadowColor: "#112233"
      }
    });

    expect(node).not.toHaveProperty("shadow");
    expect(node.style.shadowX).toBe(4);
    expect(node.style.shadowY).toBe(8);
    expect(node.style.shadowBlur).toBe(12);
    expect(node.style.shadowOpacity).toBe(0.35);
    expect(node.style.shadowColor).toBe("#112233");
  });
});

describe("blendModeSchema", () => {
  const validBlendModes = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "colorDodge",
    "colorBurn",
    "softLight",
    "hardLight",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
    "plusLighter",
    "plusDarker"
  ] as const;

  it.each(validBlendModes)("accepts typed blend mode %s", (blendMode) => {
    expect(blendModeSchema.parse(blendMode)).toBe(blendMode);
  });

  it("rejects unknown blend mode values", () => {
    expect(blendModeSchema.safeParse("frobnicate").success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(blendModeSchema.safeParse("").success).toBe(false);
  });

  it("rejects numbers", () => {
    expect(blendModeSchema.safeParse(1).success).toBe(false);
  });

  it("keeps untyped style blendMode parseable", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      style: { blendMode: "screen" }
    });

    expect(node).not.toHaveProperty("blendMode");
    expect(node.style.blendMode).toBe("screen");
  });

  it("accepts typed blendMode on motion nodes", () => {
    const node = motionNodeSchema.parse({
      id: "card",
      kind: "roundedRectangle",
      blendMode: "luminosity"
    });

    expect(node.blendMode).toBe("luminosity");
  });
});

function minimalMotionDocument(options: {
  reduceMotionPolicy?: unknown;
  rule?: Record<string, unknown>;
  arc?: Record<string, unknown>;
  jiggle?: Record<string, unknown>;
} = {}) {
  return {
    schemaVersion: 1,
    ...(options.reduceMotionPolicy === undefined ? {} : { reduceMotionPolicy: options.reduceMotionPolicy }),
    root: "screen",
    nodes: [
      { id: "screen", kind: "zstack", roles: ["screen"], layout: {}, style: {}, presentation: {}, children: ["card"] },
      { id: "card", kind: "roundedRectangle", roles: [], layout: {}, style: {}, presentation: { "offset.x": 0 }, children: [] }
    ],
    machines: [
      {
        id: "main",
        initial: "idle",
        states: [
          { id: "idle", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 0 }] },
          { id: "moved", values: [{ select: { id: "card", properties: ["offset.x"] }, value: 100 }] }
        ],
        transitions: [
          {
            id: "move",
            from: "idle",
            to: "moved",
            trigger: "tapCard",
            rules: [
              {
                select: { id: "card", properties: ["offset.x"] },
                motion: { type: "spring", response: 0.4, dampingFraction: 0.8 },
                ...options.rule
              }
            ],
            arcs: options.arc === undefined ? [] : [
              {
                select: { id: "card" },
                x: "offset.x",
                y: "offset.y",
                direction: "clockwise",
                motion: { type: "timed", duration: 0.4 },
                ...options.arc
              }
            ],
            jiggles: options.jiggle === undefined ? [] : [
              {
                select: { id: "card", properties: ["offset.x"] },
                amplitude: 10,
                duration: 0.4,
                cycles: 2,
                startDirection: "positive",
                ...options.jiggle
              }
            ],
            actions: []
          }
        ]
      }
    ],
    triggers: [{ id: "tapCard", type: "tap", selector: { id: "card" } }],
    dragBindings: [],
    bodies: [],
    forces: []
  };
}

describe("timedEasingSchema (cubic-bezier)", () => {
  it("parses existing string easing values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: "easeOut" } }
    }));

    expect(result.success).toBe(true);
  });

  it("parses cubic-bezier easing values", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.25, 0.1, 0.25, 1] } } }
    }));

    expect(result.success).toBe(true);
  });

  it("rejects cubic-bezier x1 values below zero", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [-0.1, 0, 0.5, 1] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier x2 values above one", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 1.1, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier tuples with three elements", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier tuples with five elements", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5, 0.5, 0.5] } } }
    }));

    expect(result.success).toBe(false);
  });

  it("rejects cubic-bezier objects with extra keys", () => {
    const result = safeParseMotionDocument(minimalMotionDocument({
      rule: { motion: { type: "timed", duration: 0.4, easing: { cubicBezier: [0.5, 0.5, 0.5, 0.5], extra: 1 } } }
    }));

    expect(result.success).toBe(false);
  });
});

describe("polygonSpecSchema", () => {
  it("accepts a valid polygon spec", () => {
    expect(polygonSpecSchema.safeParse({ sides: 6, cornerRadius: 4 }).success).toBe(true);
  });

  it("accepts polygon spec without cornerRadius", () => {
    expect(polygonSpecSchema.safeParse({ sides: 8 }).success).toBe(true);
  });

  it("rejects sides less than 3", () => {
    expect(polygonSpecSchema.safeParse({ sides: 2 }).success).toBe(false);
  });

  it("rejects sides greater than 64", () => {
    expect(polygonSpecSchema.safeParse({ sides: 65 }).success).toBe(false);
  });

  it("rejects non-integer sides", () => {
    expect(polygonSpecSchema.safeParse({ sides: 3.5 }).success).toBe(false);
  });

  it("rejects negative cornerRadius", () => {
    expect(polygonSpecSchema.safeParse({ sides: 6, cornerRadius: -1 }).success).toBe(false);
  });

  it("rejects extra keys (.strict())", () => {
    expect(polygonSpecSchema.safeParse({ sides: 6, extra: 1 }).success).toBe(false);
  });
});

describe("starSpecSchema", () => {
  it("accepts a valid star spec", () => {
    expect(starSpecSchema.safeParse({ points: 5, innerRadius: 0.5 }).success).toBe(true);
  });

  it("accepts innerRadius=1.0 (degenerate boundary)", () => {
    expect(starSpecSchema.safeParse({ points: 5, innerRadius: 1.0 }).success).toBe(true);
  });

  it("accepts innerRadius=0", () => {
    expect(starSpecSchema.safeParse({ points: 5, innerRadius: 0 }).success).toBe(true);
  });

  it("rejects innerRadius greater than 1", () => {
    expect(starSpecSchema.safeParse({ points: 5, innerRadius: 1.01 }).success).toBe(false);
  });

  it("rejects negative innerRadius", () => {
    expect(starSpecSchema.safeParse({ points: 5, innerRadius: -0.01 }).success).toBe(false);
  });

  it("rejects points less than 3", () => {
    expect(starSpecSchema.safeParse({ points: 2, innerRadius: 0.5 }).success).toBe(false);
  });

  it("rejects points greater than 64", () => {
    expect(starSpecSchema.safeParse({ points: 65, innerRadius: 0.5 }).success).toBe(false);
  });

  it("rejects non-integer points", () => {
    expect(starSpecSchema.safeParse({ points: 5.5, innerRadius: 0.5 }).success).toBe(false);
  });
});

describe("lineSpecSchema", () => {
  const line = { from: { x: 0, y: 1 }, to: { x: 20, y: 30 } };
  const baseNode = (overrides: Record<string, unknown>) => ({
    id: "shape",
    kind: "line",
    roles: [],
    layout: {},
    style: {},
    presentation: {},
    children: [],
    ...overrides
  });

  it("accepts valid linePoint and lineSpec", () => {
    expect(linePointSchema.safeParse({ x: 0, y: -1 }).success).toBe(true);
    expect(lineSpecSchema.safeParse(line).success).toBe(true);
  });

  it("rejects NaN and Infinity in coordinates", () => {
    expect(lineSpecSchema.safeParse({ ...line, from: { x: Number.NaN, y: 0 } }).success).toBe(false);
    expect(lineSpecSchema.safeParse({ ...line, to: { x: 1, y: Number.POSITIVE_INFINITY } }).success).toBe(false);
  });

  it("rejects extra keys (.strict())", () => {
    expect(linePointSchema.safeParse({ x: 0, y: 1, z: 2 }).success).toBe(false);
    expect(lineSpecSchema.safeParse({ ...line, extra: 1 }).success).toBe(false);
  });

  it("accepts kind=line with line and typed stroke", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      line,
      stroke: { color: "#FF0000", width: 2 }
    })).success).toBe(true);
  });

  it("accepts kind=line with line and style stroke fallback", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      line,
      style: { strokeWidth: 2, strokeColor: "#FF0000" }
    })).success).toBe(true);
  });

  it("rejects kind=line without line field", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      stroke: { color: "#FF0000", width: 2 }
    })).success).toBe(false);
  });

  it("rejects kind=line with line but no stroke", () => {
    expect(motionNodeSchema.safeParse(baseNode({ line })).success).toBe(false);
  });

  it("rejects kind=circle with line", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      kind: "circle",
      line
    })).success).toBe(false);
  });

  it("rejects kind=line with polygon", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      line,
      polygon: { sides: 6 },
      stroke: { color: "#FF0000", width: 2 }
    })).success).toBe(false);
  });
});

describe("motionNodeSchema polygon/star cross-validation", () => {
  const baseNode = (overrides: Record<string, unknown>) => ({
    id: "shape",
    kind: "polygon",
    roles: [],
    layout: {},
    style: {},
    presentation: {},
    children: [],
    ...overrides
  });

  it("accepts kind=polygon with polygon field", () => {
    expect(motionNodeSchema.safeParse(baseNode({ polygon: { sides: 6 } })).success).toBe(true);
  });

  it("accepts kind=star with star field", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      kind: "star", star: { points: 5, innerRadius: 0.5 }
    })).success).toBe(true);
  });

  it("rejects kind=polygon without polygon field", () => {
    expect(motionNodeSchema.safeParse(baseNode({})).success).toBe(false);
  });

  it("rejects kind=circle with polygon field", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      kind: "circle", polygon: { sides: 6 }
    })).success).toBe(false);
  });

  it("rejects kind=polygon with both polygon AND star fields", () => {
    expect(motionNodeSchema.safeParse(baseNode({
      polygon: { sides: 6 }, star: { points: 5, innerRadius: 0.5 }
    })).success).toBe(false);
  });

  it("rejects kind=star without star field", () => {
    expect(motionNodeSchema.safeParse(baseNode({ kind: "star" })).success).toBe(false);
  });
});
