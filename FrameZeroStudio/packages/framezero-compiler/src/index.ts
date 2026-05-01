import {
  type MotionAction,
  type MotionAssignment,
  type MotionBody,
  type MotionDocument,
  type MotionDragBinding,
  type MotionFill,
  type MotionStroke,
  type MotionForce,
  type MotionNode,
  type MotionReduceMotionPolicy,
  type MotionRule,
  type MotionSensitivityLevel,
  type MotionSpec,
  type MotionValue,
  animatedProperties,
  parseMotionDocument
} from "@framezero/schema";

export type StudioProject = {
  studioVersion: 1;
  id: string;
  name: string;
  rootNodeId: string;
  reduceMotionPolicy?: MotionReduceMotionPolicy;
  nodes: Record<string, StudioNode>;
  roles: Record<string, StudioRole>;
  phases: Record<string, StudioPhase>;
  phaseOrder: string[];
  triggers: Record<string, StudioTrigger>;
  dragBindings?: MotionDragBinding[];
  bodies?: MotionBody[];
  forces?: MotionForce[];
  components: Record<string, StudioComponent>;
  editor?: StudioEditorState;
};

export type StudioNode = {
  id: string;
  name: string;
  kind: MotionNode["kind"];
  parentId: string | null;
  childIds: string[];
  roles: string[];
  layout: Record<string, MotionValue>;
  style: Record<string, MotionValue>;
  fills?: MotionFill[];
  stroke?: MotionStroke;
  presentation: Record<string, MotionValue>;
  componentId?: string;
  locked?: boolean;
  hiddenInEditor?: boolean;
};

export type StudioRole = {
  id: string;
  name: string;
  description?: string;
  color?: string;
};

export type StudioComponent = {
  id: string;
  name: string;
  rootNodeId?: string;
  nodeIds?: string[];
  nodes?: Record<string, StudioNode>;
  kind?: MotionNode["kind"];
  roles?: string[];
  layout?: Record<string, MotionValue>;
  style?: Record<string, MotionValue>;
  fills?: MotionFill[];
  presentation?: Record<string, MotionValue>;
};

export type StudioTrigger = {
  id: string;
  type: "tap" | "automatic" | "after";
  selector?: { id?: string; role?: string };
};

export type StudioPhase = {
  id: string;
  name: string;
  mode: "absolute" | "deltaFromPrevious";
  startDelay: number;
  nextMode: "afterPreviousSettles" | "atTime";
  nextAt: number | null;
  targets: MotionAssignment[];
  rules: MotionRule[];
  arcs: Array<{
    select: { id?: string; role?: string };
    x: (typeof animatedProperties)[number];
    y: (typeof animatedProperties)[number];
    direction: "clockwise" | "anticlockwise";
    bend?: number;
    motion: MotionSpec;
    stagger?: number;
    motionSensitivity?: MotionSensitivityLevel;
  }>;
  jiggles: Array<{
    select: MotionAssignment["select"];
    amplitude: MotionValue;
    duration: number;
    cycles: number;
    startDirection: "negative" | "positive" | "clockwise" | "anticlockwise";
    decay?: number;
    stagger?: number;
    motionSensitivity?: MotionSensitivityLevel;
  }>;
  actions: MotionAction[];
};

export type StudioEditorState = {
  selection: string[];
  viewportPreset: "iphone" | "ipad" | "custom";
};

export type CompileResult = {
  document: MotionDocument;
  json: string;
};

const settledTriggerId = "settled";
const timelineTriggerId = "timeline";

export function compileStudioProject(project: StudioProject): CompileResult {
  validateStudioProject(project);

  const nodes = compileNodes(project);
  const states = compileStates(project);
  const transitions = compileTransitions(project);

  const input: Record<string, unknown> = {
    schemaVersion: 1,
    root: project.rootNodeId,
    nodes,
    machines: [
      {
        id: "main",
        initial: "state0",
        states,
        transitions
      }
    ],
    triggers: compileTriggers(project),
    dragBindings: [...(project.dragBindings ?? [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    bodies: [...(project.bodies ?? [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    forces: [...(project.forces ?? [])].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  };
  if (project.reduceMotionPolicy !== undefined) {
    input.reduceMotionPolicy = project.reduceMotionPolicy;
  }

  const document = parseMotionDocument(input);

  return {
    document,
    json: stableStringify(document)
  };
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortForJson(value), null, 2)}\n`;
}

function compileNodes(project: StudioProject): MotionNode[] {
  return orderedNodeIds(project).map((nodeId) => {
    const node = requireNode(project, nodeId);
    const out: MotionNode = {
      id: node.id,
      kind: node.kind,
      roles: [...node.roles].sort(),
      layout: sortRecord(node.layout),
      style: sortRecord(node.style),
      fills: [...(node.fills ?? [])],
      presentation: sortRecord(node.presentation),
      children: [...node.childIds]
    };
    if (node.stroke !== undefined) out.stroke = node.stroke;
    return out;
  });
}

function compileStates(project: StudioProject): MotionDocument["machines"][number]["states"] {
  const states: MotionDocument["machines"][number]["states"] = [
    {
      id: "state0",
      values: initialAssignments(project)
    }
  ];

  let previousConcrete = concreteStateFromAssignments(project, states[0]?.values ?? []);

  project.phaseOrder.forEach((phaseId, index) => {
    const phase = requirePhase(project, phaseId);
    const values = phase.mode === "deltaFromPrevious"
      ? compileDeltaTargets(project, phase.targets, previousConcrete)
      : phase.targets.filter((target) => selectorMatchesLiveNodes(project, target.select));

    states.push({
      id: `state${index + 1}`,
      values
    });

    previousConcrete = {
      ...previousConcrete,
      ...concreteStateFromAssignments(project, values)
    };
  });

  return states;
}

function initialAssignments(project: StudioProject): MotionAssignment[] {
  return orderedNodeIds(project).flatMap((nodeId) => {
    const node = requireNode(project, nodeId);
    return Object.entries(node.presentation)
      .filter(([property]) => isAnimatedProperty(property))
      .map(([property, value]) => ({
        select: { id: node.id, properties: [property as (typeof animatedProperties)[number]] },
        value
      }));
  });
}

function compileDeltaTargets(
  project: StudioProject,
  targets: MotionAssignment[],
  previousConcrete: Record<string, MotionValue>
): MotionAssignment[] {
  return targets.filter((target) => selectorMatchesLiveNodes(project, target.select)).map((target) => {
    const keys = resolveAssignmentKeys(project, target);
    if (keys.length !== 1) {
      return target;
    }

    const key = keys[0];
    if (key === undefined) {
      return target;
    }

    const previousValue = previousConcrete[key];
    if (typeof previousValue !== "number" || typeof target.value !== "number") {
      return target;
    }

    return {
      ...target,
      value: previousValue + target.value
    };
  });
}

function compileTransitions(project: StudioProject): MotionDocument["machines"][number]["transitions"] {
  return project.phaseOrder.map((phaseId, index) => {
    const phase = requirePhase(project, phaseId);
    const previousPhase = index > 0 ? requirePhase(project, project.phaseOrder[index - 1] as string) : undefined;
    const trigger = previousPhase?.nextMode === "afterPreviousSettles" ? settledTriggerId : timelineTriggerId;
    const delay = index === 0
      ? phase.startDelay
      : (previousPhase?.nextMode === "atTime" ? previousPhase.nextAt ?? 0 : 0) + phase.startDelay;

    return {
      id: `transition${index}`,
      from: `state${index}`,
      to: `state${index + 1}`,
      trigger,
      delay,
      rules: phase.rules
        .filter((rule) => selectorMatchesLiveNodes(project, rule.select))
        .map((rule) => {
          const { motionSensitivity, stagger, ...rest } = rule;
          let out: typeof rest & { stagger?: number; motionSensitivity?: MotionSensitivityLevel } = rest;
          if (stagger !== undefined) out = { ...out, stagger };
          if (motionSensitivity !== undefined) out = { ...out, motionSensitivity };
          return out;
        }),
      arcs: phase.arcs
        .filter((arc) => selectorMatchesLiveNodes(project, arc.select))
        .map((arc) => {
          const { motionSensitivity, stagger, ...rest } = arc;
          let out: typeof rest & { stagger?: number; motionSensitivity?: MotionSensitivityLevel } = rest;
          if (stagger !== undefined) out = { ...out, stagger };
          if (motionSensitivity !== undefined) out = { ...out, motionSensitivity };
          return out;
        }),
      jiggles: phase.jiggles
        .filter((jiggle) => selectorMatchesLiveNodes(project, jiggle.select))
        .map((jiggle) => {
          const { motionSensitivity, stagger, ...rest } = jiggle;
          let out: typeof rest & { stagger?: number; motionSensitivity?: MotionSensitivityLevel } = rest;
          if (stagger !== undefined) out = { ...out, stagger };
          if (motionSensitivity !== undefined) out = { ...out, motionSensitivity };
          return out;
        }),
      enter: [],
      exit: [],
      spawns: [],
      actions: phase.actions
    };
  });
}

function compileTriggers(project: StudioProject): MotionDocument["triggers"] {
  const authorTriggers = Object.values(project.triggers).sort((a, b) => a.id.localeCompare(b.id));
  return [
    { id: timelineTriggerId, type: "after" },
    { id: settledTriggerId, type: "automatic" },
    ...authorTriggers
  ];
}

function validateStudioProject(project: StudioProject) {
  if (project.studioVersion !== 1) {
    throw new Error(`Unsupported Studio project version '${project.studioVersion}'`);
  }

  if (project.nodes[project.rootNodeId] === undefined) {
    throw new Error(`Root node '${project.rootNodeId}' does not exist`);
  }

  for (const phaseId of project.phaseOrder) {
    if (project.phases[phaseId] === undefined) {
      throw new Error(`Phase order references missing phase '${phaseId}'`);
    }
  }

  for (const node of Object.values(project.nodes)) {
    if (node.parentId !== null && project.nodes[node.parentId] === undefined) {
      throw new Error(`Node '${node.id}' references missing parent '${node.parentId}'`);
    }

    for (const childId of node.childIds) {
      const child = project.nodes[childId];
      if (child === undefined) {
        throw new Error(`Node '${node.id}' references missing child '${childId}'`);
      }

      if (child.parentId !== node.id) {
        throw new Error(`Node '${node.id}' child '${childId}' does not point back to parent`);
      }
    }
  }
}

function orderedNodeIds(project: StudioProject): string[] {
  const ordered: string[] = [];

  function visit(nodeId: string) {
    ordered.push(nodeId);
    for (const childId of requireNode(project, nodeId).childIds) {
      visit(childId);
    }
  }

  visit(project.rootNodeId);
  return ordered;
}

function requireNode(project: StudioProject, nodeId: string): StudioNode {
  const node = project.nodes[nodeId];
  if (node === undefined) {
    throw new Error(`Missing node '${nodeId}'`);
  }
  return node;
}

function requirePhase(project: StudioProject, phaseId: string): StudioPhase {
  const phase = project.phases[phaseId];
  if (phase === undefined) {
    throw new Error(`Missing phase '${phaseId}'`);
  }
  return phase;
}

function concreteStateFromAssignments(project: StudioProject, assignments: MotionAssignment[]) {
  const concrete: Record<string, MotionValue> = {};
  for (const assignment of assignments) {
    for (const key of resolveAssignmentKeys(project, assignment)) {
      concrete[key] = assignment.value;
    }
  }
  return concrete;
}

function resolveAssignmentKeys(project: StudioProject, assignment: MotionAssignment): string[] {
  const selector = assignment.select;
  const nodeIds = selector.id !== undefined
    ? [selector.id]
    : Object.values(project.nodes)
      .filter((node) => selector.role !== undefined && node.roles.includes(selector.role))
      .map((node) => node.id);

  return nodeIds.flatMap((nodeId: string) => selector.properties.map((property: string) => `${nodeId}.${property}`));
}

function selectorMatchesLiveNodes(project: StudioProject, selector: { id?: string | undefined; role?: string | undefined }) {
  if (selector.id !== undefined) {
    return project.nodes[selector.id] !== undefined;
  }

  if (selector.role !== undefined) {
    return Object.values(project.nodes).some((node) => node.roles.includes(selector.role as string));
  }

  return false;
}

function isAnimatedProperty(property: string): property is (typeof animatedProperties)[number] {
  return (animatedProperties as readonly string[]).includes(property);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function sortForJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForJson(entry)])
    );
  }

  return value;
}
