import type {
  MotionDocument,
  MotionReduceMotionPolicy,
  MotionRule,
  MotionSensitivityLevel,
  MotionSpec,
  MotionValue
} from "@framezero/schema";
import { MotionChannel, type MotionChannelTargetOptions } from "./channel";
import { resolvePropertyKeys, type MotionResolvedPropertyKey } from "./selector";
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

export class MotionRuntime {
  private readonly document: MotionDocument;
  private readonly channels = new Map<string, MotionChannel>();
  private readonly currentStates = new Map<string, string>();
  private readonly stateTargets = new Map<string, MotionValue>();
  private pendingTargets: PendingChannelTarget[] = [];
  private viewport: MotionViewport | undefined;
  private isMotionReduced: boolean;
  private readonly documentPolicy: MotionReduceMotionPolicy | undefined;

  constructor(doc: MotionDocument, opts: MotionRuntimeOptions = {}) {
    this.document = doc;
    this.viewport = opts.viewport;
    this.isMotionReduced = opts.isMotionReduced ?? false;
    this.documentPolicy = doc.reduceMotionPolicy;

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
