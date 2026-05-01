import type {
  MotionDocument,
  MotionDragBinding,
  MotionReduceMotionPolicy,
  MotionRule,
  MotionSensitivityLevel,
  MotionSpec,
  MotionValue
} from "@framezero/schema";
import { MotionChannel, type MotionChannelTargetOptions } from "./channel";
import { resolveNodeIDs, resolvePropertyKeys, type MotionResolvedPropertyKey } from "./selector";
import { resolveNumericValue } from "./value";

export interface MotionViewport {
  width: number;
  height: number;
  safeAreaTop: number;
  safeAreaLeading: number;
  safeAreaBottom: number;
  safeAreaTrailing: number;
}

export interface MotionRuntimeOptions {
  viewport?: MotionViewport;
  isMotionReduced?: boolean;
}

type MotionMachine = MotionDocument["machines"][number];
type MotionState = MotionMachine["states"][number];
type MotionTransition = MotionMachine["transitions"][number];

interface PendingChannelTarget {
  key: MotionResolvedPropertyKey;
  target: number;
  motion: MotionSpec;
  sensitivity: MotionSensitivityLevel | undefined;
  remainingDelay: number;
  machineID: string;
}

const immediateMotion: MotionSpec = { type: "immediate" };

const DRAG_DEFAULTS = {
  minLaunchPull: 24,
  chargeStretchX: 0.16,
  chargeStretchY: -0.08,
  snapOffsetSpringResponse: 0.28,
  snapOffsetSpringDamping: 0.76,
  snapScaleSpringResponse: 0.24,
  snapScaleSpringDamping: 0.8
} as const;

export interface MotionDragSample {
  translationX: number;
  translationY: number;
  predictedTranslationX: number;
  predictedTranslationY: number;
}

interface ActiveSlingshotDrag {
  nodeID: string;
  binding: MotionDragBinding;
  anchorX: number;
  anchorY: number;
  currentX: number;
  currentY: number;
  charge: number;
}

export class MotionRuntime {
  private readonly document: MotionDocument;
  private readonly channels = new Map<string, MotionChannel>();
  private readonly currentStates = new Map<string, string>();
  private readonly stateTargets = new Map<string, MotionValue>();
  private pendingTargets: PendingChannelTarget[] = [];
  private viewport: MotionViewport | undefined;
  private isMotionReduced: boolean;
  private readonly documentPolicy: MotionReduceMotionPolicy | undefined;
  private readonly parentByID = new Map<string, string>();
  private readonly tapTriggerIDsByNodeID = new Map<string, string[]>();
  private readonly dragBindingByNodeID = new Map<string, MotionDragBinding>();
  private readonly activeSlingshotDrags = new Map<string, ActiveSlingshotDrag>();
  private readonly stateElapsedByMachine = new Map<string, number>();
  private idleElapsed = 0;

  constructor(doc: MotionDocument, opts: MotionRuntimeOptions = {}) {
    this.document = doc;
    this.viewport = opts.viewport;
    this.isMotionReduced = opts.isMotionReduced ?? false;
    this.documentPolicy = doc.reduceMotionPolicy;

    // Build parentByID by walking each node's children.
    for (const node of doc.nodes) {
      for (const childID of node.children) {
        this.parentByID.set(childID, node.id);
      }
    }

    // Build tapTriggerIDsByNodeID: every tap trigger's selector resolves to nodes.
    for (const trigger of doc.triggers) {
      if (trigger.type !== "tap") continue;
      if (!trigger.selector) continue;
      const nodeIDs = resolveNodeIDs(trigger.selector, doc);
      for (const nodeID of nodeIDs) {
        const existing = this.tapTriggerIDsByNodeID.get(nodeID) ?? [];
        existing.push(trigger.id);
        this.tapTriggerIDsByNodeID.set(nodeID, existing);
      }
    }

    // Build dragBindingByNodeID: every drag binding's selector resolves to nodes.
    for (const binding of doc.dragBindings ?? []) {
      const nodeIDs = resolveNodeIDs(binding.selector, doc);
      for (const nodeID of nodeIDs) {
        this.dragBindingByNodeID.set(nodeID, binding);
      }
    }

    for (const node of doc.nodes) {
      for (const property of Object.keys(node.presentation).sort()) {
        const value = node.presentation[property];
        if (value === undefined) {
          continue;
        }
        const resolved = resolveNumericValue(value, this.viewport);
        if (resolved === undefined) {
          continue;
        }
        this.channels.set(
          channelKey(node.id, property),
          new MotionChannel({
            current: resolved,
            velocity: 0,
            target: resolved,
            motion: immediateMotion,
            animationStart: resolved,
            animationElapsed: 0
          })
        );
      }
    }

    for (const machine of doc.machines) {
      this.applyState(machine.id, machine.initial, undefined, { snap: true });
    }
  }

  applyState(machineID: string, stateID: string, transitionID?: string, opts: { snap?: boolean } = {}): void {
    const machine = this.machine(machineID);
    const state = this.state(machine, stateID);
    const transition = transitionID === undefined ? undefined : this.transition(machine, transitionID);
    const snap = opts.snap ?? false;

    this.currentStates.set(machineID, stateID);
    this.stateElapsedByMachine.set(machineID, 0);
    this.idleElapsed = 0;
    this.pendingTargets = this.pendingTargets.filter((pending) => pending.machineID !== machineID);

    for (const assignment of state.values) {
      const keys = resolvePropertyKeys(assignment.select, this.document);
      const target = resolveNumericValue(assignment.value, this.viewport);
      if (target === undefined) {
        console.warn(`[MotionRuntime] Skipping non-numeric assignment in state '${stateID}'`);
        continue;
      }

      const keysByNodeID = new Map<string, MotionResolvedPropertyKey[]>();
      for (const key of keys) {
        const nodeKeys = keysByNodeID.get(key.nodeID) ?? [];
        nodeKeys.push(key);
        keysByNodeID.set(key.nodeID, nodeKeys);
      }

      const nodeIDs = [...keysByNodeID.keys()].sort();
      for (const [nodeGroupIndex, nodeID] of nodeIDs.entries()) {
        const nodeKeys = [...(keysByNodeID.get(nodeID) ?? [])].sort(comparePropertyKeys);

        for (const key of nodeKeys) {
          const rule = this.transitionRule(transition, key);
          const motion = rule?.motion ?? immediateMotion;
          const staggerIndex = rule !== undefined && (rule.stagger ?? 0) > 0
            ? this.staggerNodeIndex(rule, key.nodeID, nodeGroupIndex)
            : nodeGroupIndex;
          const totalDelay = (rule?.delay ?? 0) + (rule?.stagger ?? 0) * staggerIndex;
          const keyID = channelKey(key.nodeID, key.property);
          let channel = this.channels.get(keyID);
          if (channel === undefined) {
            channel = new MotionChannel({
              current: target,
              velocity: 0,
              target,
              motion,
              animationStart: target,
              animationElapsed: 0
            });
          }

          this.stateTargets.set(keyID, assignment.value);
          if (snap) {
            channel.current = target;
            channel.velocity = 0;
            this.setChannelTarget(channel, target, motion, rule?.motionSensitivity);
          } else if (totalDelay > 0) {
            channel.target = channel.current;
            channel.velocity = 0;
            channel.motion = immediateMotion;
            channel.animationStart = channel.current;
            channel.animationElapsed = 0;
            this.pendingTargets.push({
              key,
              target,
              motion,
              sensitivity: rule?.motionSensitivity,
              remainingDelay: totalDelay,
              machineID
            });
          } else {
            this.setChannelTarget(channel, target, motion, rule?.motionSensitivity);
          }
          this.channels.set(keyID, channel);
        }
      }
    }
  }

  currentState(machineID: string): string | undefined {
    return this.currentStates.get(machineID);
  }

  handleTap(nodeID: string): void {
    const triggers = this.tapTriggers(nodeID);
    for (const triggerID of triggers) {
      this.fireTrigger(triggerID);
    }
  }

  hasDragBinding(nodeID: string): boolean {
    return this.dragBindingFor(nodeID) !== undefined;
  }

  handleDragChanged(nodeID: string, sample: MotionDragSample): void {
    const binding = this.dragBindingFor(nodeID);
    if (binding === undefined || binding.type !== "slingshot") return;

    const existing = this.activeSlingshotDrags.get(nodeID);
    const anchor = existing
      ? { x: existing.anchorX, y: existing.anchorY }
      : this.resolveAnchor(nodeID);
    const maxPull = Math.max(binding.maxPull, 1);
    const dx = sample.translationX;
    const dy = sample.translationY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxPull ? maxPull / distance : 1;
    const currentX = anchor.x + dx * scale;
    const currentY = anchor.y + dy * scale;
    const charge = Math.min(distance / maxPull, 1);

    this.activeSlingshotDrags.set(nodeID, {
      nodeID,
      binding,
      anchorX: anchor.x,
      anchorY: anchor.y,
      currentX,
      currentY,
      charge
    });

    this.forceSnapChannel(nodeID, "offset.x", currentX);
    this.forceSnapChannel(nodeID, "offset.y", currentY);
    if (binding.chargeScale !== undefined) {
      this.forceSnapChannel(nodeID, "scale", 1 + (binding.chargeScale - 1) * charge);
    }
    const stretchX = readChargeFeedback(binding, "stretchX") ?? DRAG_DEFAULTS.chargeStretchX;
    const stretchY = readChargeFeedback(binding, "stretchY") ?? DRAG_DEFAULTS.chargeStretchY;
    this.forceSnapChannel(nodeID, "scale.x", 1 + stretchX * charge);
    this.forceSnapChannel(nodeID, "scale.y", 1 + stretchY * charge);
  }

  handleDragEnded(nodeID: string, _sample: MotionDragSample): void {
    const drag = this.activeSlingshotDrags.get(nodeID);
    if (drag === undefined) return;

    // Phase 7b ships SNAP-BACK ONLY. Projectile launch (when pull >= minLaunchPull)
    // is Phase 7c — needs ActiveProjectile state + tick-loop integration with
    // gravity / air resistance / collision / restitution / friction.
    // For Phase 7b we always snap back so the drag interaction is observable.
    this.snapNodeToAnchor(nodeID, drag.anchorX, drag.anchorY);
    this.activeSlingshotDrags.delete(nodeID);
  }

  tick(dt: number): boolean {
    const clampedDt = Math.min(Math.max(dt, 0), 0.032);
    let hasActiveChannels = false;

    for (let index = this.pendingTargets.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingTargets[index];
      if (pending === undefined) {
        continue;
      }

      pending.remainingDelay -= clampedDt;
      if (pending.remainingDelay <= 0) {
        const channel = this.channels.get(channelKey(pending.key.nodeID, pending.key.property));
        if (channel !== undefined) {
          this.setChannelTarget(channel, pending.target, pending.motion, pending.sensitivity);
        }
        this.pendingTargets.splice(index, 1);
      } else {
        hasActiveChannels = true;
      }
    }

    for (const key of [...this.channels.keys()].sort()) {
      const channel = this.channels.get(key);
      if (channel === undefined) {
        continue;
      }
      channel.integrate(clampedDt);
      if (!channel.isSettled) {
        hasActiveChannels = true;
      }
    }

    // Track per-machine state-elapsed + global idle-elapsed for future auto/
    // after trigger dispatch. NOT YET DISPATCHED — Phase 7c-triggers needs a
    // proper Researcher pre-pass: the naive `fire-when-elapsed >= delay`
    // implementation diverged from the recorded Swift trace empirically; the
    // exact gating semantics need to be re-confirmed against the live Swift
    // engine before TS can ship it. Counters are harmless to maintain meanwhile.
    for (const machine of this.document.machines) {
      const prev = this.stateElapsedByMachine.get(machine.id) ?? 0;
      this.stateElapsedByMachine.set(machine.id, prev + clampedDt);
    }
    if (hasActiveChannels) {
      this.idleElapsed = 0;
    } else {
      this.idleElapsed += clampedDt;
    }

    return hasActiveChannels || this.pendingTargets.length > 0;
  }

  valueFor(nodeID: string, property: string, fallback = 0): number {
    return this.channels.get(channelKey(nodeID, property))?.current ?? fallback;
  }

  hasChannel(nodeID: string, property: string): boolean {
    return this.channels.has(channelKey(nodeID, property));
  }

  channelKeys(): MotionResolvedPropertyKey[] {
    return [...this.channels.entries()]
      .map(([key]) => parseChannelKey(key))
      .sort(comparePropertyKeys);
  }

  setViewport(viewport: MotionViewport): void {
    this.viewport = viewport;
    this.refreshResolvedTargets();
  }

  setReduceMotion(reduced: boolean): void {
    this.isMotionReduced = reduced;
    this.refreshResolvedTargets();
  }

  __getChannel(nodeID: string, property: string): MotionChannel | undefined {
    return this.channels.get(channelKey(nodeID, property));
  }

  private dragBindingFor(nodeID: string): MotionDragBinding | undefined {
    let currentID: string | undefined = nodeID;
    while (currentID !== undefined) {
      const binding = this.dragBindingByNodeID.get(currentID);
      if (binding !== undefined) return binding;
      currentID = this.parentByID.get(currentID);
    }
    return undefined;
  }

  private resolveAnchor(nodeID: string): { x: number; y: number } {
    return {
      x: this.valueFor(nodeID, "offset.x", 0),
      y: this.valueFor(nodeID, "offset.y", 0)
    };
  }

  private forceSnapChannel(nodeID: string, property: string, value: number): void {
    const keyID = channelKey(nodeID, property);
    let channel = this.channels.get(keyID);
    if (channel === undefined) {
      channel = new MotionChannel({
        current: value,
        velocity: 0,
        target: value,
        motion: immediateMotion,
        animationStart: value,
        animationElapsed: 0
      });
      this.channels.set(keyID, channel);
      return;
    }
    channel.current = value;
    channel.velocity = 0;
    channel.target = value;
    channel.motion = immediateMotion;
    channel.animationStart = value;
    channel.animationElapsed = 0;
  }

  private snapNodeToAnchor(nodeID: string, anchorX: number, anchorY: number): void {
    const offsetSpring: MotionSpec = {
      type: "spring",
      response: DRAG_DEFAULTS.snapOffsetSpringResponse,
      dampingFraction: DRAG_DEFAULTS.snapOffsetSpringDamping
    };
    const scaleSpring: MotionSpec = {
      type: "spring",
      response: DRAG_DEFAULTS.snapScaleSpringResponse,
      dampingFraction: DRAG_DEFAULTS.snapScaleSpringDamping
    };
    this.setChannelTargetForDrag(nodeID, "offset.x", anchorX, offsetSpring);
    this.setChannelTargetForDrag(nodeID, "offset.y", anchorY, offsetSpring);
    this.setChannelTargetForDrag(nodeID, "scale", 1, scaleSpring);
    this.setChannelTargetForDrag(nodeID, "scale.x", 1, scaleSpring);
    this.setChannelTargetForDrag(nodeID, "scale.y", 1, scaleSpring);
  }

  private setChannelTargetForDrag(nodeID: string, property: string, target: number, motion: MotionSpec): void {
    const keyID = channelKey(nodeID, property);
    const channel = this.channels.get(keyID);
    if (channel === undefined) return;
    const opts: MotionChannelTargetOptions = {
      isMotionReduced: this.isMotionReduced
    };
    if (this.documentPolicy !== undefined) opts.documentPolicy = this.documentPolicy;
    channel.setTarget(target, motion, opts);
  }

  private tapTriggers(nodeID: string): string[] {
    let currentID: string | undefined = nodeID;
    while (currentID !== undefined) {
      const triggerIDs = this.tapTriggerIDsByNodeID.get(currentID);
      if (triggerIDs !== undefined && triggerIDs.length > 0) {
        return triggerIDs;
      }
      currentID = this.parentByID.get(currentID);
    }
    return [];
  }

  private fireTrigger(triggerID: string): void {
    for (const machine of this.document.machines) {
      const currentState = this.currentStates.get(machine.id);
      if (currentState === undefined) continue;
      const matches = machine.transitions.filter(
        (transition) => transition.from === currentState && transition.trigger === triggerID
      );
      if (matches.length === 0) continue;
      if (matches.length > 1) {
        console.warn(`[MotionRuntime] Multiple transitions matched trigger '${triggerID}' from state '${currentState}'; skipping.`);
        continue;
      }
      const transition = matches[0]!;
      this.applyState(machine.id, transition.to, transition.id);
    }
  }

  private machine(machineID: string): MotionMachine {
    const machine = this.document.machines.find((candidate) => candidate.id === machineID);
    if (machine === undefined) {
      throw new Error(`Machine '${machineID}' does not exist`);
    }
    return machine;
  }

  private state(machine: MotionMachine, stateID: string): MotionState {
    const state = machine.states.find((candidate) => candidate.id === stateID);
    if (state === undefined) {
      throw new Error(`State '${stateID}' does not exist`);
    }
    return state;
  }

  private transition(machine: MotionMachine, transitionID: string): MotionTransition {
    const transition = machine.transitions.find((candidate) => candidate.id === transitionID);
    if (transition === undefined) {
      throw new Error(`Transition '${transitionID}' does not exist`);
    }
    return transition;
  }

  private transitionRule(transition: MotionTransition | undefined, key: MotionResolvedPropertyKey): MotionRule | undefined {
    if (transition === undefined) {
      return undefined;
    }

    for (let index = transition.rules.length - 1; index >= 0; index -= 1) {
      const rule = transition.rules[index];
      if (rule === undefined) {
        continue;
      }
      try {
        if (resolvePropertyKeys(rule.select, this.document).some((candidate) => sameKey(candidate, key))) {
          return rule;
        }
      } catch {
        continue;
      }
    }

    return undefined;
  }

  private staggerNodeIndex(rule: MotionRule, nodeID: string, fallbackIndex: number): number {
    const nodeIDs = [...new Set(resolvePropertyKeys(rule.select, this.document).map((key) => key.nodeID))].sort();
    return nodeIDs.indexOf(nodeID) === -1 ? fallbackIndex : nodeIDs.indexOf(nodeID);
  }

  private refreshResolvedTargets(): void {
    for (const [keyID, value] of this.stateTargets.entries()) {
      const target = resolveNumericValue(value, this.viewport);
      const channel = this.channels.get(keyID);
      if (target === undefined || channel === undefined) {
        continue;
      }
      this.setChannelTarget(channel, target, channel.motion, undefined);
    }
  }

  private setChannelTarget(
    channel: MotionChannel,
    target: number,
    motion: MotionSpec,
    sensitivity: MotionSensitivityLevel | undefined
  ): void {
    const options: MotionChannelTargetOptions = {};
    if (sensitivity !== undefined) {
      options.sensitivity = sensitivity;
    }
    if (this.documentPolicy !== undefined) {
      options.documentPolicy = this.documentPolicy;
    }
    options.isMotionReduced = this.isMotionReduced;
    channel.setTarget(target, motion, options);
  }
}

function channelKey(nodeID: string, property: string): string {
  return `${nodeID}\u0000${property}`;
}

function parseChannelKey(key: string): MotionResolvedPropertyKey {
  const [nodeID, property] = key.split("\u0000");
  if (nodeID === undefined || property === undefined) {
    throw new Error(`Invalid channel key '${key}'`);
  }
  return { nodeID, property };
}

function sameKey(lhs: MotionResolvedPropertyKey, rhs: MotionResolvedPropertyKey): boolean {
  return lhs.nodeID === rhs.nodeID && lhs.property === rhs.property;
}

function comparePropertyKeys(lhs: MotionResolvedPropertyKey, rhs: MotionResolvedPropertyKey): number {
  return lhs.nodeID.localeCompare(rhs.nodeID) || lhs.property.localeCompare(rhs.property);
}

function readChargeFeedback(binding: MotionDragBinding, key: string): number | undefined {
  const feedback = binding.chargeFeedback;
  if (feedback === undefined) return undefined;
  const value = feedback[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}
