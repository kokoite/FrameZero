import type { MotionDocument } from "@framezero/schema";
import { describe, expect, it } from "vitest";
import { MotionCanvasRenderer, type MotionRuntime } from "../src/renderer";

type Call = [string, ...number[]] | [string, string];

describe("MotionCanvasRenderer transforms", () => {
  it("applies one root center translate and child center-origin transforms", () => {
    const calls: Call[] = [];
    const ctx = mockCanvas(calls);
    const document: MotionDocument = {
      schemaVersion: 1,
      root: "root",
      nodes: [
        node("root", "zstack", ["card"], { width: 300, height: 400 }),
        {
          ...node("card", "roundedRectangle", [], { width: 100, height: 50 }),
          style: { backgroundColor: "#38BDF8" },
          presentation: {
            "offset.x": 10,
            "offset.y": 20,
            rotation: 45,
            scale: 2,
            opacity: 1
          }
        }
      ],
      machines: [],
      triggers: [],
      dragBindings: [],
      bodies: [],
      forces: []
    };
    const runtime = {
      valueFor(nodeID: string, property: string, fallback = 0): number {
        const node = document.nodes.find((candidate) => candidate.id === nodeID);
        const value = node?.presentation[property];
        return typeof value === "number" ? value : fallback;
      }
    } as MotionRuntime;

    new MotionCanvasRenderer(runtime, document, ctx, { logicalSize: { width: 300, height: 400 } }).render();

    const relevant = calls.filter(([name]) => [
      "save",
      "setTransform",
      "translate",
      "rotate",
      "scale",
      "globalAlpha",
      "fillStyle",
      "fill",
      "restore"
    ].includes(name));

    expect(relevant[0]).toEqual(["save"]);
    expect(relevant[1]).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
    expect(relevant[2]).toEqual(["translate", 150, 200]);
    expect(relevant[3]).toEqual(["save"]);
    expect(relevant[4]).toEqual(["translate", -150, -200]);
    expect(relevant[5]).toEqual(["translate", 60, 45]);
    expectNumberCall(relevant[6], "rotate", Math.PI / 4);
    expect(relevant[7]).toEqual(["scale", 2, 2]);
    expect(relevant[8]).toEqual(["translate", -50, -25]);
    expect(relevant[9]).toEqual(["globalAlpha", 1]);
    expect(relevant[10]).toEqual(["fillStyle", "rgba(56, 189, 248, 1)"]);
    expect(relevant).toContainEqual(["fill"]);
    expect(relevant.at(-1)).toEqual(["restore"]);
  });
});

function node(
  id: string,
  kind: MotionDocument["nodes"][number]["kind"],
  children: string[] = [],
  layout: Record<string, number> = {}
): MotionDocument["nodes"][number] {
  return {
    id,
    kind,
    roles: [],
    layout,
    style: {},
    fills: [],
    presentation: {},
    children
  };
}

function expectNumberCall(call: Call | undefined, name: string, value: number): void {
  expect(call?.[0]).toBe(name);
  expect(call?.[1]).toBeCloseTo(value, 6);
}

function mockCanvas(calls: Call[]): CanvasRenderingContext2D {
  let alpha = 1;
  const ctx = {
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) =>
      calls.push(["setTransform", a, b, c, d, e, f]),
    translate: (x: number, y: number) => calls.push(["translate", x, y]),
    rotate: (radians: number) => calls.push(["rotate", radians]),
    scale: (x: number, y: number) => calls.push(["scale", x, y]),
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    closePath: () => undefined,
    ellipse: () => undefined,
    fill: () => calls.push(["fill"]),
    fillText: () => undefined,
    measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics,
    set fillStyle(value: string) {
      calls.push(["fillStyle", value]);
    },
    set font(_value: string) {},
    set textBaseline(_value: CanvasTextBaseline) {},
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value: number) {
      alpha = value;
      calls.push(["globalAlpha", value]);
    }
  };
  return ctx as unknown as CanvasRenderingContext2D;
}
