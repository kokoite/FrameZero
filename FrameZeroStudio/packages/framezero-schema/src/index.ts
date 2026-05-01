import { z } from "zod";

export const nodeKinds = [
  "zstack",
  "vstack",
  "hstack",
  "text",
  "image",
  "path",
  "circle",
  "roundedRectangle",
  "polygon",
  "star",
  "line"
] as const;

export const animatedProperties = [
  "offset.x",
  "offset.y",
  "rotation",
  "scale",
  "scale.x",
  "scale.y",
  "opacity"
] as const;

export const metrics = [
  "screen.width",
  "screen.height",
  "screen.left",
  "screen.right",
  "screen.top",
  "screen.bottom",
  "screen.centerX",
  "screen.centerY",
  "safeArea.width",
  "safeArea.height",
  "safeArea.left",
  "safeArea.right",
  "safeArea.top",
  "safeArea.bottom",
  "safeArea.centerX",
  "safeArea.centerY"
] as const;

export const nodeKindSchema = z.enum(nodeKinds);
export const animatedPropertySchema = z.enum(animatedProperties);
export const metricSchema = z.enum(metrics);
export const reduceMotionPolicySchema = z.enum(["respect", "ignore"]);
export const motionSensitivitySchema = z.enum(["essential", "decorative"]);
export const blendModeSchema = z.enum([
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "colorDodge", "colorBurn", "softLight", "hardLight",
  "difference", "exclusion",
  "hue", "saturation", "color", "luminosity",
  "plusLighter", "plusDarker"
]);

export const finiteNumberSchema = z.number().finite();
export const nonNegativeNumberSchema = finiteNumberSchema.min(0);
export const positiveNumberSchema = finiteNumberSchema.positive();
export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB");
export const fillColorStopSchema = z.object({
  color: hexColorSchema,
  position: finiteNumberSchema.min(0).max(1),
  opacity: finiteNumberSchema.min(0).max(1).optional()
});
export const gradientTransformSchema = z.tuple([
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema
]);
export const fillSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("solid"),
    color: hexColorSchema,
    opacity: finiteNumberSchema.min(0).max(1).optional()
  }),
  z.object({
    type: z.literal("linearGradient"),
    colors: z.array(fillColorStopSchema).min(2),
    angle: finiteNumberSchema.optional(),
    gradientTransform: gradientTransformSchema.optional(),
    opacity: finiteNumberSchema.min(0).max(1).optional()
  }),
  z.object({
    type: z.literal("radialGradient"),
    colors: z.array(fillColorStopSchema).min(2),
    centerX: finiteNumberSchema.min(0).max(1).optional(),
    centerY: finiteNumberSchema.min(0).max(1).optional(),
    radius: positiveNumberSchema.optional(),
    gradientTransform: gradientTransformSchema.optional(),
    opacity: finiteNumberSchema.min(0).max(1).optional()
  })
]);

export const strokeAlignmentSchema = z.enum(["inside", "outside", "center"]);
export const strokeCapSchema = z.enum(["butt", "round", "square"]);
export const strokeJoinSchema = z.enum(["miter", "round", "bevel"]);

export const strokeSpecSchema = z.object({
  color: hexColorSchema,
  width: nonNegativeNumberSchema,
  alignment: strokeAlignmentSchema.default("center"),
  dash: z.array(nonNegativeNumberSchema).min(1)
    .refine(d => d.some(v => v > 0), "dash must include at least one positive value")
    .optional(),
  cap: strokeCapSchema.default("butt"),
  join: strokeJoinSchema.default("miter"),
  miterLimit: positiveNumberSchema.optional()
});
export type MotionStroke = z.infer<typeof strokeSpecSchema>;

export const cornerRadiiSchema = z.object({
  topLeft: nonNegativeNumberSchema,
  topRight: nonNegativeNumberSchema,
  bottomLeft: nonNegativeNumberSchema,
  bottomRight: nonNegativeNumberSchema
}).strict();
export type MotionCornerRadii = z.infer<typeof cornerRadiiSchema>;

export const shadowSpecSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  blur: nonNegativeNumberSchema,
  opacity: finiteNumberSchema.min(0).max(1),
  color: hexColorSchema
}).strict();
export type MotionShadow = z.infer<typeof shadowSpecSchema>;

export const polygonSpecSchema = z.object({
  sides: z.number().int().min(3).max(64),
  cornerRadius: nonNegativeNumberSchema.optional()
}).strict();
export type MotionPolygonSpec = z.infer<typeof polygonSpecSchema>;

export const starSpecSchema = z.object({
  points: z.number().int().min(3).max(64),
  innerRadius: finiteNumberSchema.min(0).max(1),
  cornerRadius: nonNegativeNumberSchema.optional()
}).strict();
export type MotionStarSpec = z.infer<typeof starSpecSchema>;

export const linePointSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema
}).strict();

export const lineSpecSchema = z.object({
  from: linePointSchema,
  to: linePointSchema
}).strict();
export type MotionLineSpec = z.infer<typeof lineSpecSchema>;

export const metricValueSchema = z.object({
  metric: metricSchema,
  multiplier: finiteNumberSchema.optional(),
  offset: finiteNumberSchema.optional()
});

export const motionValueSchema = z.union([
  finiteNumberSchema,
  z.string(),
  z.boolean(),
  metricValueSchema
]);

export const motionValueRecordSchema = z.record(z.string(), motionValueSchema);

export const lockedAssetPolicy = "locked";

function requiresLockedAssetPolicy(
  kind: z.infer<typeof nodeKindSchema>,
  style: z.infer<typeof motionValueRecordSchema>,
  context: z.RefinementCtx
) {
  if (kind !== "image") return;

  if (style.assetPolicy !== lockedAssetPolicy) {
    context.addIssue({
      code: "custom",
      path: ["style", "assetPolicy"],
      message: "Image nodes are only allowed when style.assetPolicy is 'locked'"
    });
  }
}

function validateShapeFields(
  data: {
    kind: z.infer<typeof nodeKindSchema>;
    polygon?: z.infer<typeof polygonSpecSchema> | undefined;
    star?: z.infer<typeof starSpecSchema> | undefined;
    line?: z.infer<typeof lineSpecSchema> | undefined;
    stroke?: z.infer<typeof strokeSpecSchema> | undefined;
    style?: z.infer<typeof motionValueRecordSchema> | undefined;
  },
  context: z.RefinementCtx
) {
  if (data.kind === "polygon") {
    if (!data.polygon) context.addIssue({ code: "custom", path: ["polygon"], message: "kind=polygon requires polygon field" });
    if (data.star) context.addIssue({ code: "custom", path: ["star"], message: "kind=polygon must not include star field" });
    if (data.line) context.addIssue({ code: "custom", path: ["line"], message: "kind=polygon must not include line field" });
  } else if (data.kind === "star") {
    if (!data.star) context.addIssue({ code: "custom", path: ["star"], message: "kind=star requires star field" });
    if (data.polygon) context.addIssue({ code: "custom", path: ["polygon"], message: "kind=star must not include polygon field" });
    if (data.line) context.addIssue({ code: "custom", path: ["line"], message: "kind=star must not include line field" });
  } else if (data.kind === "line") {
    if (!data.line) context.addIssue({ code: "custom", path: ["line"], message: "kind=line requires line field" });
    if (data.polygon) context.addIssue({ code: "custom", path: ["polygon"], message: "kind=line must not include polygon field" });
    if (data.star) context.addIssue({ code: "custom", path: ["star"], message: "kind=line must not include star field" });
    if (data.stroke === undefined && (data.style?.strokeWidth === undefined || data.style?.strokeColor === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "kind=line requires stroke (typed or style.strokeWidth + style.strokeColor)"
      });
    }
  } else {
    if (data.polygon) context.addIssue({ code: "custom", path: ["polygon"], message: "polygon field only allowed when kind=polygon" });
    if (data.star) context.addIssue({ code: "custom", path: ["star"], message: "star field only allowed when kind=star" });
    if (data.line) context.addIssue({ code: "custom", path: ["line"], message: "line field only allowed when kind=line" });
  }
}

export const motionNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: nodeKindSchema,
    roles: z.array(z.string().min(1)).default([]),
    layout: motionValueRecordSchema.default({}),
    style: motionValueRecordSchema.default({}),
    fills: z.array(fillSchema).default([]),
    stroke: strokeSpecSchema.optional(),
    cornerRadii: cornerRadiiSchema.optional(),
    cornerRadius: nonNegativeNumberSchema.optional(),
    shadow: shadowSpecSchema.optional(),
    layerBlur: nonNegativeNumberSchema.optional(),
    blendMode: blendModeSchema.optional(),
    polygon: polygonSpecSchema.optional(),
    star: starSpecSchema.optional(),
    line: lineSpecSchema.optional(),
    presentation: motionValueRecordSchema.default({}),
    children: z.array(z.string().min(1)).default([]),
    presence: z
      .object({
        machine: z.string().min(1),
        states: z.array(z.string().min(1))
      })
      .optional()
  })
  .superRefine((node, context) => {
    requiresLockedAssetPolicy(node.kind, node.style, context);
    validateShapeFields(node, context);
  });

export const nodeSelectorSchema = z
  .object({
    id: z.string().min(1).optional(),
    role: z.string().min(1).optional()
  })
  .superRefine((selector, context) => {
    const count = Number(selector.id !== undefined) + Number(selector.role !== undefined);
    if (count !== 1) {
      context.addIssue({
        code: "custom",
        message: "Selector must include exactly one of id or role"
      });
    }
  });

export const propertySelectorSchema = nodeSelectorSchema.extend({
  properties: z.array(animatedPropertySchema).min(1)
});

export const motionAssignmentSchema = z.object({
  select: propertySelectorSchema,
  value: motionValueSchema
});

export const timedEasingSchema = z.union([
  z.enum(["linear", "easeIn", "easeOut", "easeInOut"]),
  z.object({
    cubicBezier: z.tuple([
      z.number().finite().min(0).max(1),
      z.number().finite(),
      z.number().finite().min(0).max(1),
      z.number().finite()
    ])
  }).strict()
]);

export const motionSpecSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("spring"),
    response: positiveNumberSchema,
    dampingFraction: nonNegativeNumberSchema
  }),
  z.object({
    type: z.literal("timed"),
    duration: positiveNumberSchema,
    easing: timedEasingSchema.optional()
  }),
  z.object({
    type: z.literal("immediate")
  })
]);

export const motionRuleSchema = z.object({
  select: propertySelectorSchema,
  motion: motionSpecSchema,
  delay: nonNegativeNumberSchema.optional(),
  stagger: nonNegativeNumberSchema.optional(),
  motionSensitivity: motionSensitivitySchema.optional()
});

export const arcRuleSchema = z.object({
  select: nodeSelectorSchema,
  x: animatedPropertySchema,
  y: animatedPropertySchema,
  direction: z.enum(["clockwise", "anticlockwise"]),
  bend: finiteNumberSchema.optional(),
  motion: motionSpecSchema,
  stagger: nonNegativeNumberSchema.optional(),
  motionSensitivity: motionSensitivitySchema.optional()
});

export const jiggleRuleSchema = z.object({
  select: propertySelectorSchema,
  amplitude: motionValueSchema,
  duration: positiveNumberSchema,
  cycles: positiveNumberSchema,
  startDirection: z.enum(["negative", "positive", "clockwise", "anticlockwise"]),
  decay: nonNegativeNumberSchema.optional(),
  stagger: nonNegativeNumberSchema.optional(),
  motionSensitivity: motionSensitivitySchema.optional()
});

const actionBaseSchema = z.object({
  type: z.string()
});

export type MotionAction = z.infer<typeof actionBaseSchema> & Record<string, unknown>;

const emittedVisualSpecBaseSchema = z.object({
  kind: nodeKindSchema,
  layout: motionValueRecordSchema.default({}),
  style: motionValueRecordSchema.default({}),
  fills: z.array(fillSchema).default([]),
  stroke: strokeSpecSchema.optional(),
  cornerRadii: cornerRadiiSchema.optional(),
  shadow: shadowSpecSchema.optional(),
  layerBlur: nonNegativeNumberSchema.optional(),
  blendMode: blendModeSchema.optional(),
  polygon: polygonSpecSchema.optional(),
  star: starSpecSchema.optional(),
  line: lineSpecSchema.optional(),
  from: motionValueRecordSchema.default({}),
  to: motionValueRecordSchema.default({}),
  motion: motionSpecSchema,
  motionSensitivity: motionSensitivitySchema.optional(),
  lifetime: positiveNumberSchema
});

const emittedVisualSpecSchema = emittedVisualSpecBaseSchema
  .superRefine((spec, context) => {
    requiresLockedAssetPolicy(spec.kind, spec.style, context);
    validateShapeFields(spec, context);
  });

const spawnedVisualSpecSchema = emittedVisualSpecBaseSchema
  .extend({
    id: z.string().min(1)
  })
  .superRefine((spec, context) => {
    requiresLockedAssetPolicy(spec.kind, spec.style, context);
    validateShapeFields(spec, context);
  });

export const motionActionSchema: z.ZodType<MotionAction> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("sequence"),
      actions: z.array(motionActionSchema).min(1)
    }),
    z.object({
      type: z.literal("parallel"),
      actions: z.array(motionActionSchema).min(1)
    }),
    z.object({
      type: z.literal("delay"),
      duration: nonNegativeNumberSchema
    }),
    z.object({
      type: z.literal("haptic"),
      style: z.enum(["light", "medium", "heavy", "rigid", "soft", "selection", "success", "warning", "error"]),
      intensity: nonNegativeNumberSchema.max(1).optional()
    }),
    z.object({
      type: z.literal("screenShake"),
      amplitude: nonNegativeNumberSchema,
      duration: positiveNumberSchema,
      frequency: nonNegativeNumberSchema.optional(),
      decay: nonNegativeNumberSchema.optional()
    }),
    z.object({
      type: z.literal("emitParticles"),
      id: z.string().min(1),
      selector: nodeSelectorSchema.optional(),
      count: z.number().int().positive().max(128),
      duration: nonNegativeNumberSchema.optional(),
      angle: z.object({ min: finiteNumberSchema, max: finiteNumberSchema }).optional(),
      distance: z.object({ min: finiteNumberSchema, max: finiteNumberSchema }).optional(),
      particle: emittedVisualSpecSchema
    }),
    z.object({
      type: z.literal("spawnComponents"),
      id: z.string().min(1),
      selector: nodeSelectorSchema.optional(),
      components: z
        .array(spawnedVisualSpecSchema)
        .min(1)
        .max(32)
    })
  ])
);

export const visualStateSchema = z.object({
  id: z.string().min(1),
  values: z.array(motionAssignmentSchema)
});

export const transitionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: z.string().min(1),
  delay: nonNegativeNumberSchema.optional(),
  rules: z.array(motionRuleSchema),
  arcs: z.array(arcRuleSchema).default([]),
  jiggles: z.array(jiggleRuleSchema).default([]),
  enter: z.array(z.unknown()).default([]),
  exit: z.array(z.unknown()).default([]),
  spawns: z.array(z.unknown()).default([]),
  actions: z.array(motionActionSchema).default([])
});

export const stateMachineSchema = z.object({
  id: z.string().min(1),
  initial: z.string().min(1),
  states: z.array(visualStateSchema).min(1),
  transitions: z.array(transitionSchema)
});

export const triggerSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["tap", "automatic", "after"]),
    selector: nodeSelectorSchema.optional()
  })
  .superRefine((trigger, context) => {
    if (trigger.type === "tap" && trigger.selector === undefined) {
      context.addIssue({ code: "custom", message: "Tap triggers must include a selector" });
    }

    if (trigger.type !== "tap" && trigger.selector !== undefined) {
      context.addIssue({ code: "custom", message: "Only tap triggers may include a selector" });
    }
  });

export const pointValueSchema = z.object({
  x: motionValueSchema,
  y: motionValueSchema
});

export const dragBindingSchema = z.object({
  id: z.string().min(1),
  type: z.literal("slingshot"),
  selector: nodeSelectorSchema,
  anchor: pointValueSchema.optional(),
  maxPull: positiveNumberSchema,
  minLaunchPull: nonNegativeNumberSchema.optional(),
  launchPower: finiteNumberSchema,
  throwPower: finiteNumberSchema.optional(),
  gravity: finiteNumberSchema.optional(),
  airResistance: nonNegativeNumberSchema.optional(),
  restitution: nonNegativeNumberSchema.optional(),
  friction: nonNegativeNumberSchema.optional(),
  stopSpeed: nonNegativeNumberSchema.optional(),
  throwThreshold: nonNegativeNumberSchema.optional(),
  radius: positiveNumberSchema.optional(),
  chargeScale: finiteNumberSchema.optional(),
  chargeFeedback: z.record(z.string(), motionValueSchema).optional(),
  trail: z.record(z.string(), motionValueSchema).optional(),
  trajectory: z.record(z.string(), motionValueSchema).optional()
});

export const bodySchema = z.object({
  id: z.string().min(1),
  selector: nodeSelectorSchema,
  radius: positiveNumberSchema.optional(),
  mass: positiveNumberSchema.optional(),
  airResistance: nonNegativeNumberSchema.optional(),
  restitution: nonNegativeNumberSchema.optional(),
  friction: nonNegativeNumberSchema.optional(),
  stopSpeed: nonNegativeNumberSchema.optional(),
  collision: z.enum(["none", "screenBounds", "safeAreaBounds"]).optional()
});

export const forceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["gravity", "wind", "constant"]),
  selector: nodeSelectorSchema.optional(),
  x: finiteNumberSchema.optional(),
  y: finiteNumberSchema.optional()
});

export const motionDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    reduceMotionPolicy: reduceMotionPolicySchema.optional(),
    root: z.string().min(1),
    nodes: z.array(motionNodeSchema).min(1),
    machines: z.array(stateMachineSchema),
    triggers: z.array(triggerSchema),
    dragBindings: z.array(dragBindingSchema).default([]),
    bodies: z.array(bodySchema).default([]),
    forces: z.array(forceSchema).default([])
  })
  .superRefine(validateDocumentReferences);

export type MotionDocument = z.infer<typeof motionDocumentSchema>;
export type MotionReduceMotionPolicy = z.infer<typeof reduceMotionPolicySchema>;
export type MotionSensitivityLevel = z.infer<typeof motionSensitivitySchema>;
export type MotionBlendMode = z.infer<typeof blendModeSchema>;
export type MotionNode = z.infer<typeof motionNodeSchema>;
export type MotionValue = z.infer<typeof motionValueSchema>;
export type MotionFill = z.infer<typeof fillSchema>;
export type MotionSpec = z.infer<typeof motionSpecSchema>;
export type MotionPropertySelector = z.infer<typeof propertySelectorSchema>;
export type MotionNodeSelector = z.infer<typeof nodeSelectorSchema>;
export type MotionAssignment = z.infer<typeof motionAssignmentSchema>;
export type MotionRule = z.infer<typeof motionRuleSchema>;
export type MotionDragBinding = z.infer<typeof dragBindingSchema>;
export type MotionBody = z.infer<typeof bodySchema>;
export type MotionForce = z.infer<typeof forceSchema>;
export type MotionPointValue = z.infer<typeof pointValueSchema>;

export const previewEnvelopeSchema = z.object({
  protocolVersion: z.literal(1),
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  type: z.enum([
    "hello",
    "hello.ack",
    "document.update",
    "document.result",
    "playback.command",
    "playback.result",
    "error"
  ]),
  sentAt: z.string().min(1),
  payload: z.unknown()
});

export const documentUpdatePayloadSchema = z.object({
  revision: z.number().int().nonnegative(),
  documentId: z.string().min(1),
  documentHash: z.string().min(1),
  reason: z.string().min(1),
  autoPlay: z.boolean().default(true),
  resetBeforePlay: z.boolean().default(true),
  json: motionDocumentSchema
});

export const documentResultPayloadSchema = z.discriminatedUnion("status", [
  z.object({
    revision: z.number().int().nonnegative(),
    documentHash: z.string().min(1),
    status: z.literal("applied"),
    runtime: z
      .object({
        root: z.string().min(1),
        nodeCount: z.number().int().nonnegative(),
        machineCount: z.number().int().nonnegative()
      })
      .optional()
  }),
  z.object({
    revision: z.number().int().nonnegative(),
    documentHash: z.string().min(1).optional(),
    status: z.literal("rejected"),
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1)
    }),
    keptRevision: z.number().int().nonnegative().optional()
  })
]);

export const helloPayloadSchema = z.object({
  client: z.enum(["studio-web", "ios-simulator"]),
  schemaVersions: z.array(z.literal(1)).min(1),
  appVersion: z.string().min(1).optional(),
  lastAppliedRevision: z.number().int().nonnegative().optional()
});

export const helloAckPayloadSchema = z.object({
  studioVersion: z.string().min(1),
  sessionName: z.string().min(1),
  schemaVersion: z.literal(1),
  schemaVersions: z.array(z.literal(1)).min(1),
  currentRevision: z.number().int().nonnegative(),
  heartbeatIntervalMs: z.number().positive()
});

export const errorPayloadSchema = z.object({
  code: z.enum(["schemaVersion.unsupported", "envelope.invalid", "payload.invalid"]),
  message: z.string().min(1),
  detail: z.unknown().optional()
});

export type PreviewEnvelope = z.infer<typeof previewEnvelopeSchema>;
export type DocumentUpdatePayload = z.infer<typeof documentUpdatePayloadSchema>;
export type DocumentResultPayload = z.infer<typeof documentResultPayloadSchema>;
export type HelloPayload = z.infer<typeof helloPayloadSchema>;
export type HelloAckPayload = z.infer<typeof helloAckPayloadSchema>;
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export function makePreviewEnvelope(
  type: PreviewEnvelope["type"],
  payload: unknown,
  options: { sessionId?: string; messageId?: string; sentAt?: string } = {}
): PreviewEnvelope {
  return {
    protocolVersion: 1,
    sessionId: options.sessionId ?? "local",
    messageId: options.messageId ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    type,
    sentAt: options.sentAt ?? new Date().toISOString(),
    payload
  };
}

export function parseMotionDocument(input: unknown): MotionDocument {
  return motionDocumentSchema.parse(input);
}

export function safeParseMotionDocument(input: unknown) {
  return motionDocumentSchema.safeParse(input);
}

function validateDocumentReferences(document: z.infer<typeof motionDocumentSchema>, context: z.RefinementCtx) {
  const nodeIds = new Set<string>();
  const triggerIds = new Set<string>();

  for (const node of document.nodes) {
    addUnique(nodeIds, node.id, "Duplicate node id", context);
  }

  if (!nodeIds.has(document.root)) {
    context.addIssue({ code: "custom", message: `Root node '${document.root}' does not exist` });
  }

  const parentByChild = new Map<string, string>();
  for (const node of document.nodes) {
    for (const childId of node.children) {
      if (!nodeIds.has(childId)) {
        context.addIssue({ code: "custom", message: `Node '${node.id}' references missing child '${childId}'` });
      }

      const existingParent = parentByChild.get(childId);
      if (existingParent !== undefined) {
        context.addIssue({
          code: "custom",
          message: `Node '${childId}' is owned by both '${existingParent}' and '${node.id}'`
        });
      }
      parentByChild.set(childId, node.id);
    }
  }

  validateReachability(document, nodeIds, context);

  for (const trigger of document.triggers) {
    addUnique(triggerIds, trigger.id, "Duplicate trigger id", context);
    if (trigger.selector !== undefined) {
      validateNodeSelector(trigger.selector, document.nodes, context);
    }
  }

  for (const machine of document.machines) {
    const stateIds = new Set<string>();
    const transitionIds = new Set<string>();
    const transitionKeys = new Set<string>();

    for (const state of machine.states) {
      addUnique(stateIds, state.id, `Duplicate state id in machine '${machine.id}'`, context);
    }

    if (!stateIds.has(machine.initial)) {
      context.addIssue({
        code: "custom",
        message: `Machine '${machine.id}' initial state '${machine.initial}' does not exist`
      });
    }

    for (const state of machine.states) {
      const assigned = new Set<string>();
      for (const assignment of state.values) {
        const keys = resolvePropertySelector(assignment.select, document.nodes, context);
        for (const key of keys) {
          addUnique(assigned, key, `Duplicate assignment in state '${state.id}'`, context);
        }
      }
    }

    for (const transition of machine.transitions) {
      addUnique(transitionIds, transition.id, `Duplicate transition id in machine '${machine.id}'`, context);

      if (!stateIds.has(transition.from)) {
        context.addIssue({ code: "custom", message: `Transition '${transition.id}' references missing from state '${transition.from}'` });
      }
      if (!stateIds.has(transition.to)) {
        context.addIssue({ code: "custom", message: `Transition '${transition.id}' references missing to state '${transition.to}'` });
      }
      if (!triggerIds.has(transition.trigger)) {
        context.addIssue({ code: "custom", message: `Transition '${transition.id}' references missing trigger '${transition.trigger}'` });
      }

      addUnique(transitionKeys, `${transition.from}:${transition.trigger}`, `Duplicate transition edge in machine '${machine.id}'`, context);

      for (const rule of transition.rules) {
        resolvePropertySelector(rule.select, document.nodes, context);
      }
      for (const arc of transition.arcs) {
        validateNodeSelector(arc.select, document.nodes, context);
      }
      for (const jiggle of transition.jiggles) {
        resolvePropertySelector(jiggle.select, document.nodes, context);
      }
    }
  }
}

function addUnique(values: Set<string>, value: string, message: string, context: z.RefinementCtx) {
  if (values.has(value)) {
    context.addIssue({ code: "custom", message: `${message}: '${value}'` });
    return;
  }
  values.add(value);
}

function validateReachability(document: Pick<MotionDocument, "root" | "nodes">, nodeIds: Set<string>, context: z.RefinementCtx) {
  const nodesById = new Map(document.nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string, path: string[]) {
    if (visiting.has(nodeId)) {
      context.addIssue({ code: "custom", message: `Node tree contains a cycle: ${[...path, nodeId].join(" -> ")}` });
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }

    const node = nodesById.get(nodeId);
    if (node === undefined) {
      return;
    }

    visiting.add(nodeId);
    for (const childId of node.children) {
      visit(childId, [...path, nodeId]);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  if (nodeIds.has(document.root)) {
    visit(document.root, []);
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      context.addIssue({ code: "custom", message: `Node '${nodeId}' is not reachable from root '${document.root}'` });
    }
  }
}

function validateNodeSelector(selector: MotionNodeSelector, nodes: MotionNode[], context: z.RefinementCtx): string[] {
  if (selector.id !== undefined) {
    const exists = nodes.some((node) => node.id === selector.id);
    if (!exists) {
      context.addIssue({ code: "custom", message: `Selector references missing node '${selector.id}'` });
      return [];
    }
    return [selector.id];
  }

  if (selector.role !== undefined) {
    const matches = nodes.filter((node) => node.roles.includes(selector.role as string)).map((node) => node.id);
    if (matches.length === 0) {
      context.addIssue({ code: "custom", message: `Selector role '${selector.role}' matched no nodes` });
    }
    return matches;
  }

  return [];
}

function resolvePropertySelector(selector: MotionPropertySelector, nodes: MotionNode[], context: z.RefinementCtx): string[] {
  const nodeIds = validateNodeSelector(selector, nodes, context);
  return nodeIds.flatMap((nodeId) => selector.properties.map((property) => `${nodeId}.${property}`));
}
