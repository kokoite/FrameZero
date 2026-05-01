import { describe, it, expect } from "vitest";
import { findComponentInstanceRoot, isDescendantOf } from "./componentSelection";
import type { StudioProject } from "@framezero/compiler";

type TestNode = {
  id: string;
  parentId: string | null;
  componentId?: string;
};

function projectWith(nodes: TestNode[]): StudioProject {
  return {
    rootNodeId: "root",
    nodes: Object.fromEntries(
      [
        { id: "root", parentId: null },
        ...nodes
      ].map((node) => [
        node.id,
        {
          id: node.id,
          name: node.id,
          kind: "rectangle",
          parentId: node.parentId,
          childIds: [],
          roles: [],
          layout: {},
          style: {},
          presentation: {},
          ...(node.componentId ? { componentId: node.componentId } : {})
        }
      ])
    )
  } as unknown as StudioProject;
}

describe("findComponentInstanceRoot", () => {
  it("returns null for non-instance nodes", () => {
    const project = projectWith([{ id: "layer", parentId: "root" }]);

    expect(findComponentInstanceRoot(project, "layer")).toBeNull();
  });

  it("returns the node itself when it is the instance root", () => {
    const project = projectWith([{ id: "instance", parentId: "root", componentId: "button" }]);

    expect(findComponentInstanceRoot(project, "instance")).toBe("instance");
  });

  it("walks up while parent shares componentId", () => {
    const project = projectWith([
      { id: "instance", parentId: "root", componentId: "button" },
      { id: "group", parentId: "instance", componentId: "button" },
      { id: "leaf", parentId: "group", componentId: "button" }
    ]);

    expect(findComponentInstanceRoot(project, "leaf")).toBe("instance");
  });

  it("stops at boundary when parent has different componentId", () => {
    const project = projectWith([
      { id: "outer", parentId: "root", componentId: "card" },
      { id: "inner", parentId: "outer", componentId: "button" },
      { id: "leaf", parentId: "inner", componentId: "button" }
    ]);

    expect(findComponentInstanceRoot(project, "leaf")).toBe("inner");
  });

  it("handles nested instances (returns nearest root)", () => {
    const project = projectWith([
      { id: "outer", parentId: "root", componentId: "card" },
      { id: "inner", parentId: "outer", componentId: "button" },
      { id: "inner-label", parentId: "inner", componentId: "button" }
    ]);

    expect(findComponentInstanceRoot(project, "inner-label")).toBe("inner");
  });

  it("returns the layer itself for detached single-node layers carrying componentId", () => {
    const project = projectWith([{ id: "detached", parentId: "root", componentId: "icon" }]);

    expect(findComponentInstanceRoot(project, "detached")).toBe("detached");
  });
});

describe("isDescendantOf", () => {
  it("returns true for direct child", () => {
    const project = projectWith([{ id: "child", parentId: "parent" }, { id: "parent", parentId: "root" }]);

    expect(isDescendantOf(project, "child", "parent")).toBe(true);
  });

  it("returns true for deep descendant", () => {
    const project = projectWith([
      { id: "ancestor", parentId: "root" },
      { id: "parent", parentId: "ancestor" },
      { id: "child", parentId: "parent" }
    ]);

    expect(isDescendantOf(project, "child", "ancestor")).toBe(true);
  });

  it("returns false for unrelated node", () => {
    const project = projectWith([
      { id: "ancestor", parentId: "root" },
      { id: "child", parentId: "root" }
    ]);

    expect(isDescendantOf(project, "child", "ancestor")).toBe(false);
  });

  it("returns false for self", () => {
    const project = projectWith([{ id: "node", parentId: "root" }]);

    expect(isDescendantOf(project, "node", "node")).toBe(false);
  });

  it("returns false when ancestor chain hits null parentId before target", () => {
    const project = projectWith([{ id: "orphan-root", parentId: null }, { id: "child", parentId: "orphan-root" }]);

    expect(isDescendantOf(project, "child", "missing")).toBe(false);
  });
});
