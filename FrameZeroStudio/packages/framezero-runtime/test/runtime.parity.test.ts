import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseMotionDocument } from "@framezero/schema";
import { describe, expect, test } from "vitest";
import { MotionRuntime, type MotionViewport } from "../src/runtime";

type RuntimeTrace = {
  fixture: string;
  viewport: MotionViewport;
  applyStateAt: number;
  applyState: {
    machineID: string;
    stateID: string;
    transitionID: string;
  };
  dt: number;
  channels: Array<{
    nodeID: string;
    property: string;
  }>;
  steps: Array<Array<{
    current: number;
    velocity: number;
  }>>;
};

const fixtureDirectory = fileURLToPath(
  new URL("../../../../MotionEngineKit/Tests/MotionEngineKitTests/Fixtures/", import.meta.url)
);
const phase1CardPath = fileURLToPath(new URL("../../../../Examples/Phase1Card.motion.json", import.meta.url));

function loadRuntimeTrace(): RuntimeTrace {
  return JSON.parse(readFileSync(`${fixtureDirectory}runtime-phase1card-trace.json`, "utf8")) as RuntimeTrace;
}

describe("MotionRuntime Swift trace parity", () => {
  test("Phase1Card document channels match Swift runtime trace", () => {
    const trace = loadRuntimeTrace();
    const document = parseMotionDocument(JSON.parse(readFileSync(phase1CardPath, "utf8")));
    const runtime = new MotionRuntime(document, { viewport: trace.viewport });

    expect(runtime.channelKeys()).toHaveLength(trace.channels.length);
    expect(runtime.channelKeys()).toEqual(trace.channels);

    for (let step = 0; step < trace.steps.length; step += 1) {
      if (step === trace.applyStateAt) {
        runtime.applyState(
          trace.applyState.machineID,
          trace.applyState.stateID,
          trace.applyState.transitionID
        );
      }

      runtime.tick(trace.dt);

      expect(runtime.channelKeys()).toEqual(trace.channels);
      const expectedStep = trace.steps[step];
      for (const [channelIndex, expected] of expectedStep.entries()) {
        const key = trace.channels[channelIndex];
        expect(key).toBeDefined();
        const channel = runtime.__getChannel(key.nodeID, key.property);
        expect(channel).toBeDefined();

        const tolerance = channel.motion.type === "spring" ? 1e-4 : 1e-6;
        expect(channel.current).toBeCloseTo(expected.current, precisionFor(tolerance));
        expect(channel.velocity).toBeCloseTo(expected.velocity, precisionFor(tolerance));
        expect(Math.abs(channel.current - expected.current)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(channel.velocity - expected.velocity)).toBeLessThanOrEqual(tolerance);
      }
    }
  });
});

function precisionFor(tolerance: number): number {
  return Math.max(0, Math.floor(-Math.log10(tolerance)));
}
