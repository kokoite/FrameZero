import type { MotionDocument } from "@framezero/schema";
import { describe, expect, it } from "vitest";
import { measureTree } from "../src/layout";

describe("measureTree", () => {
  it("measures stack and leaf intrinsic sizes deterministically", () => {
    const document: MotionDocument = {
      schemaVersion: 1,
      root: "root",
      nodes: [
        node("root", "zstack", ["column", "row", "loose"], { width: 300, height: 400 }),
        node("column", "vstack", ["rectA", "rectB"]),
        node("rectA", "roundedRectangle", [], { width: 60, height: 24 }),
        node("rectB", "roundedRectangle", [], { width: 60, height: 24 }),
        node("row", "hstack", ["circleA", "circleB", "circleC"]),
        node("circleA", "circle", [], { width: 20, height: 20 }),
        node("circleB", "circle", [], { width: 20, height: 20 }),
        node("circleC", "circle", [], { width: 20, height: 20 }),
        node("loose", "circle")
      ],
      machines: [],
      triggers: [],
      dragBindings: [],
      bodies: [],
      forces: []
    };

    const measured = measureTree(document);
    expect(measured.get("root")).toEqual({ width: 300, height: 400 });
    expect(measured.get("column")).toEqual({ width: 60, height: 48 });
    expect(measured.get("row")).toEqual({ width: 60, height: 20 });
    expect(measured.get("rectA")).toEqual({ width: 60, height: 24 });
    expect(measured.get("circleA")).toEqual({ width: 20, height: 20 });
    expect(measured.get("loose")).toEqual({ width: 0, height: 0 });
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
