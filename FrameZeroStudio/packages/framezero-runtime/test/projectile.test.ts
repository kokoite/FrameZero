import { describe, expect, it } from "vitest";
import { parseMotionDocument } from "@framezero/schema";
import { MotionRuntime, type MotionDragSample, type MotionViewport } from "../src/runtime";

interface TestProjectile {
  nodeID: string;
  radius: number;
  mass: number;
  forceX: number;
  forceY: number;
  airResistance: number;
  restitution: number;
  friction: number;
  stopSpeed: number;
  collision: "none" | "screenBounds" | "safeAreaBounds";
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  accelerationX: number;
  accelerationY: number;
  collisionCount: number;
  restingFrames: number;
}

type RuntimeInternals = MotionRuntime & {
  activeProjectiles: Map<string, TestProjectile>;
};

const viewport: MotionViewport = {
  width: 500,
  height: 500,
  safeAreaTop: 0,
  safeAreaLeading: 0,
  safeAreaBottom: 0,
  safeAreaTrailing: 0
};

const sample = (
  translationX: number,
  translationY: number,
  predictedTranslationX = translationX,
  predictedTranslationY = translationY
): MotionDragSample => ({
  translationX,
  translationY,
  predictedTranslationX,
  predictedTranslationY
});

const projectileDocument = (overrides: Record<string, unknown> = {}): unknown => ({
  schemaVersion: 1,
  root: "screen",
  nodes: [
    {
      id: "screen",
      kind: "zstack",
      roles: ["screen"],
      layout: {},
      style: {},
      presentation: {},
      children: ["orb"]
    },
    {
      id: "orb",
      kind: "circle",
      roles: ["actor"],
      layout: { width: 40, height: 40 },
      style: {},
      presentation: { "offset.x": 0, "offset.y": 0, "scale.x": 1, "scale.y": 1, scale: 1 },
      children: []
    }
  ],
  machines: [
    {
      id: "main",
      initial: "idle",
      states: [
        {
          id: "idle",
          values: [
            { select: { id: "orb", properties: ["offset.x"] }, value: 0 },
            { select: { id: "orb", properties: ["offset.y"] }, value: 0 }
          ]
        }
      ],
      transitions: []
    }
  ],
  triggers: [],
  dragBindings: [
    {
      id: "orbSling",
      type: "slingshot",
      selector: { id: "orb" },
      maxPull: 200,
      minLaunchPull: 24,
      launchPower: 6,
      chargeScale: 1.2
    }
  ],
  bodies: [{ id: "orbBody", selector: { id: "orb" }, radius: 20, stopSpeed: 60 }],
  forces: [{ id: "gravity", type: "gravity", y: 980 }],
  ...overrides
});

function runtime(overrides: Record<string, unknown> = {}, customViewport = viewport): MotionRuntime {
  return new MotionRuntime(parseMotionDocument(projectileDocument(overrides)), { viewport: customViewport });
}

function projectiles(runtime: MotionRuntime): Map<string, TestProjectile> {
  return (runtime as unknown as RuntimeInternals).activeProjectiles;
}

function seedProjectile(runtime: MotionRuntime, partial: Partial<TestProjectile>): TestProjectile {
  const projectile: TestProjectile = {
    nodeID: "orb",
    radius: 20,
    mass: 1,
    forceX: 0,
    forceY: 0,
    airResistance: 0,
    restitution: 0,
    friction: 1,
    stopSpeed: 45,
    collision: "screenBounds",
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    accelerationX: 0,
    accelerationY: 0,
    collisionCount: 0,
    restingFrames: 0,
    ...partial
  };
  projectiles(runtime).set(projectile.nodeID, projectile);
  return projectile;
}

describe("MotionRuntime projectile flight physics", () => {
  it("launches from slingshot release, advances under gravity, and eventually settles", () => {
    const motionRuntime = runtime();
    motionRuntime.handleDragChanged("orb", sample(-150, -100));
    motionRuntime.handleDragEnded("orb", sample(-150, -100));

    expect(projectiles(motionRuntime).has("orb")).toBe(true);
    const startX = motionRuntime.valueFor("orb", "offset.x");
    const startY = motionRuntime.valueFor("orb", "offset.y");

    for (let i = 0; i < 60; i += 1) motionRuntime.tick(1 / 60);
    expect(motionRuntime.valueFor("orb", "offset.x")).toBeGreaterThan(startX);
    expect(motionRuntime.valueFor("orb", "offset.y")).toBeGreaterThan(startY);

    for (let i = 0; i < 3000 && projectiles(motionRuntime).has("orb"); i += 1) {
      motionRuntime.tick(1 / 60);
    }
    expect(projectiles(motionRuntime).has("orb")).toBe(false);
  });

  it("applies gravity-only acceleration to an upward launch", () => {
    const motionRuntime = runtime();
    seedProjectile(motionRuntime, {
      collision: "none",
      forceY: 980,
      velocityY: -200
    });

    for (let i = 0; i < 30; i += 1) motionRuntime.tick(1 / 60);
    expect(projectiles(motionRuntime).get("orb")?.velocityY).toBeCloseTo(-200 + 980 * 0.5, 1);
  });

  it("decays horizontal velocity with air resistance without crossing zero", () => {
    const motionRuntime = runtime({ forces: [] });
    seedProjectile(motionRuntime, {
      collision: "none",
      velocityX: 300,
      airResistance: 0.5
    });

    let previous = projectiles(motionRuntime).get("orb")!.velocityX;
    for (let i = 0; i < 20; i += 1) {
      motionRuntime.tick(1 / 60);
      const current = projectiles(motionRuntime).get("orb")!.velocityX;
      expect(current).toBeLessThan(previous);
      expect(current).toBeGreaterThan(0);
      previous = current;
    }
  });

  it("bounces from the floor with restitution applied to incoming speed", () => {
    const motionRuntime = runtime();
    seedProjectile(motionRuntime, {
      y: 239,
      velocityY: 300,
      restitution: 0.6,
      friction: 1
    });

    motionRuntime.tick(1 / 60);
    const projectile = projectiles(motionRuntime).get("orb")!;
    expect(projectile.y).toBeCloseTo(230, 5);
    expect(projectile.velocityY).toBeCloseTo(-180, 5);
    expect(projectile.collisionCount).toBe(1);
  });

  it("applies floor friction to horizontal slide and slows below stop speed", () => {
    const motionRuntime = runtime();
    seedProjectile(motionRuntime, {
      y: 230,
      forceY: 20,
      velocityX: 100,
      velocityY: 10,
      restitution: 0,
      friction: 0.92,
      stopSpeed: 5
    });

    motionRuntime.tick(1 / 60);
    expect(projectiles(motionRuntime).get("orb")?.velocityX).toBeCloseTo(92, 5);

    for (let i = 0; i < 80 && projectiles(motionRuntime).has("orb"); i += 1) {
      motionRuntime.tick(1 / 60);
    }
    const projectile = projectiles(motionRuntime).get("orb");
    expect(projectile === undefined || Math.hypot(projectile.velocityX, projectile.velocityY) < 5).toBe(true);
  });

  it("removes a resting projectile after four floor frames", () => {
    const motionRuntime = runtime();
    seedProjectile(motionRuntime, {
      y: 230,
      velocityY: 10,
      restitution: 0,
      stopSpeed: 45
    });

    expect(motionRuntime.tick(1 / 60)).toBe(true);
    expect(projectiles(motionRuntime).get("orb")?.restingFrames).toBe(1);
    expect(motionRuntime.tick(1 / 60)).toBe(true);
    expect(motionRuntime.tick(1 / 60)).toBe(true);
    expect(motionRuntime.tick(1 / 60)).toBe(false);
    expect(projectiles(motionRuntime).has("orb")).toBe(false);
  });

  it("springs stretched scale channels back to one on launch", () => {
    const motionRuntime = runtime();
    motionRuntime.handleDragChanged("orb", sample(-200, 0));
    expect(motionRuntime.valueFor("orb", "scale.x")).toBeCloseTo(1.16, 5);
    expect(motionRuntime.valueFor("orb", "scale.y")).toBeCloseTo(0.92, 5);

    motionRuntime.handleDragEnded("orb", sample(-200, 0));
    const scaleX = motionRuntime.__getChannel("orb", "scale.x");
    const scaleY = motionRuntime.__getChannel("orb", "scale.y");
    const uniformScale = motionRuntime.__getChannel("orb", "scale");

    expect(scaleX?.target).toBe(1);
    expect(scaleX?.motion).toMatchObject({ type: "spring", response: 0.2, dampingFraction: 0.62 });
    expect(scaleY?.target).toBe(1);
    expect(scaleY?.motion).toMatchObject({ type: "spring", response: 0.2, dampingFraction: 0.62 });
    expect(uniformScale?.target).toBe(1);
    expect(uniformScale?.motion).toMatchObject({ type: "spring", response: 0.22, dampingFraction: 0.66 });
  });

  it("preserves snap-back for pulls below minLaunchPull", () => {
    const motionRuntime = runtime();
    motionRuntime.handleDragChanged("orb", sample(10, 0));
    motionRuntime.handleDragEnded("orb", sample(10, 0));

    expect(projectiles(motionRuntime).has("orb")).toBe(false);
    for (let i = 0; i < 60; i += 1) motionRuntime.tick(1 / 60);
    expect(motionRuntime.valueFor("orb", "offset.x")).toBeCloseTo(0, 1);
    expect(motionRuntime.valueFor("orb", "scale.x")).toBeCloseTo(1, 1);
    expect(motionRuntime.valueFor("orb", "scale.y")).toBeCloseTo(1, 1);
  });

  it("matches the Swift projectile parity trace for the first ticks", () => {
    const motionRuntime = runtime({
      bodies: [{ id: "orbBody", selector: { id: "orb" }, radius: 20, collision: "none" }],
      forces: [{ id: "gravity", type: "gravity", y: 980 }]
    });
    motionRuntime.handleDragChanged("orb", sample(-100, -100));
    motionRuntime.handleDragEnded("orb", sample(-100, -100));

    const expected = [
      { x: -88.619121, y: -88.368747, vx: 711.304918, vy: 726.953339 },
      { x: -77.388372, y: -76.640551, vx: 701.921802, vy: 733.012219 },
      { x: -66.305773, y: -64.816692, vx: 692.662461, vy: 738.991173 },
      { x: -55.369369, y: -52.898432, vx: 683.525265, vy: 744.891256 },
      { x: -44.577231, y: -40.887016, vx: 674.508601, vy: 750.713509 }
    ];

    for (const frame of expected) {
      motionRuntime.tick(0.016);
      const projectile = projectiles(motionRuntime).get("orb")!;
      expect(projectile.x).toBeCloseTo(frame.x, 3);
      expect(projectile.y).toBeCloseTo(frame.y, 3);
      expect(projectile.velocityX).toBeCloseTo(frame.vx, 3);
      expect(projectile.velocityY).toBeCloseTo(frame.vy, 3);
    }
  });
});
