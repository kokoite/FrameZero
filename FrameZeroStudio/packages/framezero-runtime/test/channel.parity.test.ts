import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MotionSpec } from "@framezero/schema";
import { describe, expect, test } from "vitest";
import { MotionChannel } from "../src/channel";

type Trace = {
  name: string;
  initial: {
    current: number;
    velocity: number;
    target: number;
  };
  motion: MotionSpec;
  dt: number;
  retargetAt?: number;
  newTarget?: number;
  steps: Array<{
    current: number;
    velocity: number;
  }>;
};

const fixtureDirectory = fileURLToPath(
  new URL("../../../../MotionEngineKit/Tests/MotionEngineKitTests/Fixtures/", import.meta.url)
);

function loadTrace(name: string): Trace {
  return JSON.parse(readFileSync(`${fixtureDirectory}${name}-trace.json`, "utf8")) as Trace;
}

describe("MotionChannel Swift trace parity", () => {
  const cases = [
    { name: "spring", tolerance: 1e-4 },
    { name: "timed", tolerance: 1e-6 },
    { name: "immediate", tolerance: 1e-6 },
    { name: "spring-retarget", tolerance: 1e-4 }
  ];

  for (const parityCase of cases) {
    test(`${parityCase.name} matches Swift trace`, () => {
      const trace = loadTrace(parityCase.name);
      const channel = new MotionChannel({
        current: trace.initial.current,
        velocity: trace.initial.velocity,
        target: trace.initial.current,
        motion: { type: "immediate" },
        animationStart: trace.initial.current,
        animationElapsed: 0
      });
      channel.setTarget(trace.initial.target, trace.motion);

      expect(channel.current).toBeCloseTo(trace.steps[0]?.current ?? Number.NaN, 12);
      expect(channel.velocity).toBeCloseTo(trace.steps[0]?.velocity ?? Number.NaN, 12);

      for (let i = 1; i < trace.steps.length; i += 1) {
        const tickIndex = i - 1;
        if (trace.retargetAt === tickIndex) {
          channel.setTarget(trace.newTarget ?? channel.target, trace.motion);
        }
        channel.integrate(trace.dt);

        const expected = trace.steps[i];
        expect(channel.current).toBeCloseTo(expected.current, precisionFor(parityCase.tolerance));
        expect(channel.velocity).toBeCloseTo(expected.velocity, precisionFor(parityCase.tolerance));
        expect(Math.abs(channel.current - expected.current)).toBeLessThanOrEqual(parityCase.tolerance);
        expect(Math.abs(channel.velocity - expected.velocity)).toBeLessThanOrEqual(parityCase.tolerance);
      }
    });
  }
});

function precisionFor(tolerance: number): number {
  return Math.max(0, Math.floor(-Math.log10(tolerance)));
}
