import { describe, expect, it } from "vitest";
import { parallelComponentsProject } from "../../framezero-fixtures/src/index";
import { compileStudioProject } from "../src/index";

describe("compileStudioProject", () => {
  it("compiles a Studio project to valid FrameZero motion JSON", () => {
    const result = compileStudioProject(parallelComponentsProject);

    expect(result.document.schemaVersion).toBe(1);
    expect(result.document.root).toBe("screen");
    expect(result.document.nodes.map((node) => node.id)).toEqual(["screen", "card", "icon", "title"]);
    expect(result.document.machines[0]?.states).toHaveLength(2);
    expect(result.json).toContain('"schemaVersion": 1');
  });

  it("preserves role-based parallel animation selectors", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const transition = result.document.machines[0]?.transitions[0];

    expect(transition?.rules[0]?.select).toEqual({
      role: "gesturePart",
      properties: ["offset.x", "scale"]
    });

    expect(result.document.machines[0]?.states[1]?.values).toContainEqual({
      select: { role: "gesturePart", properties: ["offset.x"] },
      value: 64
    });
  });

  it("produces deterministic JSON", () => {
    const first = compileStudioProject(parallelComponentsProject).json;
    const second = compileStudioProject(parallelComponentsProject).json;

    expect(first).toBe(second);
  });
});
