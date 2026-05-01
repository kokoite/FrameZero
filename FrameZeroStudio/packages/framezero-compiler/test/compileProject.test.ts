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

  it("drops role-based motion selectors that no longer match live nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    for (const node of Object.values(project.nodes)) {
      node.roles = node.roles.filter((role) => role !== "gesturePart");
    }

    const result = compileStudioProject(project);
    const state = result.document.machines[0]?.states[1];
    const transition = result.document.machines[0]?.transitions[0];

    expect(state?.values).not.toContainEqual({
      select: { role: "gesturePart", properties: ["offset.x"] },
      value: 64
    });
    expect(transition?.rules).not.toContainEqual(expect.objectContaining({
      select: expect.objectContaining({ role: "gesturePart" })
    }));
  });

  it("preserves structured fills on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.fills = [{
      type: "linearGradient",
      colors: [
        { color: "#25304A", position: 0 },
        { color: "#5ED8FF", position: 1 }
      ],
      angle: 120,
      opacity: 0.92
    }];

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.fills).toEqual(project.nodes.card.fills);
  });

  it("forwards typed stroke on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.stroke = { color: "#000000", width: 1 };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.stroke).toMatchObject({ color: "#000000", width: 1 });
    expect(result.json).toContain('"stroke": {');
  });

  it("omits typed stroke when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("stroke");
    expect(result.json).not.toContain('"stroke"');
  });

  it("forwards typed corner radii on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.cornerRadii = { topLeft: 12, topRight: 0, bottomLeft: 4, bottomRight: 24 };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.cornerRadii).toEqual({ topLeft: 12, topRight: 0, bottomLeft: 4, bottomRight: 24 });
    expect(result.json).toContain('"cornerRadii": {');
  });

  it("omits typed corner radii when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("cornerRadii");
    expect(result.json).not.toContain('"cornerRadii"');
  });

  it("forwards typed corner radius on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.cornerRadius = 8;

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.cornerRadius).toBe(8);
    expect(result.json).toContain('"cornerRadius": 8');
  });

  it("omits typed corner radius when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("cornerRadius");
    expect(card?.style.cornerRadius).toBe(18);
  });

  it("forwards typed shadow on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.shadow = { x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.shadow).toEqual({ x: 4, y: 8, blur: 12, opacity: 0.35, color: "#112233" });
    expect(result.json).toContain('"shadow": {');
  });

  it("forwards layerBlur on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.layerBlur = 6;

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.layerBlur).toBe(6);
    expect(result.json).toContain('"layerBlur": 6');
  });

  it("omits typed shadow and layerBlur when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("shadow");
    expect(card).not.toHaveProperty("layerBlur");
    expect(result.json).not.toContain('"shadow"');
    expect(result.json).not.toContain('"layerBlur"');
  });

  it("forwards typed blendMode on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.blendMode = "luminosity";

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.blendMode).toBe("luminosity");
    expect(result.json).toContain('"blendMode": "luminosity"');
  });

  it("omits typed blendMode when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("blendMode");
  });

  it("forwards polygon spec on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.kind = "polygon";
    project.nodes.card.polygon = { sides: 6, cornerRadius: 4 };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.polygon).toEqual({ sides: 6, cornerRadius: 4 });
    expect(result.json).toContain('"polygon": {');
  });

  it("forwards star spec on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.kind = "star";
    project.nodes.card.star = { points: 5, innerRadius: 0.5 };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.star).toEqual({ points: 5, innerRadius: 0.5 });
    expect(result.json).toContain('"star": {');
  });

  it("forwards line spec on compiled nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.kind = "line";
    project.nodes.card.line = { from: { x: 0, y: 0 }, to: { x: 20, y: 30 } };
    project.nodes.card.stroke = { color: "#FF0000", width: 2 };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card?.line).toEqual({ from: { x: 0, y: 0 }, to: { x: 20, y: 30 } });
    expect(result.json).toContain('"line": {');
  });

  it("rejects kind=line without line spec", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.kind = "line";
    project.nodes.card.stroke = { color: "#FF0000", width: 2 };

    expect(() => compileStudioProject(project)).toThrow();
  });

  it("omits line when undefined", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.kind = "circle";

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("line");
    expect(result.json).not.toContain('"line"');
  });

  it("omits polygon and star when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).not.toHaveProperty("polygon");
    expect(card).not.toHaveProperty("star");
    expect(result.json).not.toContain('"polygon"');
    expect(result.json).not.toContain('"star"');
  });

  it("strips Studio-only component instance metadata from runtime nodes", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.card.componentId = "heroCard";

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");

    expect(card).toBeDefined();
    expect(JSON.stringify(card)).not.toContain("componentId");
  });

  it("omits reduce motion policy when it is not defined", () => {
    const result = compileStudioProject(parallelComponentsProject);

    expect(result.document).not.toHaveProperty("reduceMotionPolicy");
    expect(result.json).not.toContain("reduceMotionPolicy");
  });

  it("forwards reduce motion policy when it is defined", () => {
    const project = structuredClone(parallelComponentsProject);
    project.reduceMotionPolicy = "ignore";

    const result = compileStudioProject(project);

    expect(result.document.reduceMotionPolicy).toBe("ignore");
    expect(result.json).toContain('"reduceMotionPolicy": "ignore"');
  });

  it("forwards per-rule motion sensitivity only when defined", () => {
    const project = structuredClone(parallelComponentsProject);
    project.phases.communicatingGesture.rules[0]!.motionSensitivity = "essential";
    project.phases.communicatingGesture.arcs.push({
      select: { id: "card" },
      x: "offset.x",
      y: "offset.y",
      direction: "clockwise",
      motion: { type: "timed", duration: 0.3 },
      motionSensitivity: "decorative"
    });
    project.phases.communicatingGesture.jiggles.push({
      select: { id: "icon", properties: ["rotation"] },
      amplitude: 8,
      duration: 0.2,
      cycles: 2,
      startDirection: "clockwise"
    });

    const result = compileStudioProject(project);
    const transition = result.document.machines[0]?.transitions[0];

    expect(transition?.rules[0]?.motionSensitivity).toBe("essential");
    expect(transition?.arcs[0]?.motionSensitivity).toBe("decorative");
    expect(transition?.jiggles[0]).not.toHaveProperty("motionSensitivity");
  });

  it("forwards per-rule stagger when defined", () => {
    const project = structuredClone(parallelComponentsProject);
    project.phases.communicatingGesture.rules[0]!.stagger = 0.05;

    const result = compileStudioProject(project);
    const transition = result.document.machines[0]?.transitions[0];

    expect(transition?.rules[0]?.stagger).toBe(0.05);
    expect(result.json).toContain('"stagger": 0.05');
  });

  it("omits per-rule stagger when undefined", () => {
    const result = compileStudioProject(parallelComponentsProject);
    const transition = result.document.machines[0]?.transitions[0];

    expect(transition?.rules[0]).not.toHaveProperty("stagger");
  });

  it("preserves nested locked image component layers in runtime JSON", () => {
    const project = structuredClone(parallelComponentsProject);
    project.nodes.screen.childIds = ["card", "title"];
    project.nodes.card.kind = "zstack";
    project.nodes.card.layout = { width: 375, height: 248 };
    project.nodes.card.style = { clip: true };
    project.nodes.card.childIds = ["icon", "glow"];
    project.nodes.icon.parentId = "card";
    project.nodes.glow = {
      id: "glow",
      name: "Glow Asset",
      kind: "image",
      parentId: "card",
      childIds: [],
      roles: ["gesturePart"],
      layout: { width: 250, height: 240 },
      style: { assetPolicy: "locked", imageUrl: "/figma/voice/planet-3.svg", contentMode: "100% 100%", blendMode: "screen" },
      fills: [],
      presentation: { "offset.x": 0, "offset.y": 0, scale: 1, opacity: 0.8, rotation: 0 }
    };

    const result = compileStudioProject(project);
    const card = result.document.nodes.find((node) => node.id === "card");
    const glow = result.document.nodes.find((node) => node.id === "glow");

    expect(card?.children).toEqual(["icon", "glow"]);
    expect(card?.style.clip).toBe(true);
    expect(glow?.kind).toBe("image");
    expect(glow?.style).toMatchObject({
      assetPolicy: "locked",
      imageUrl: "/figma/voice/planet-3.svg",
      blendMode: "screen"
    });
    expect(glow).not.toHaveProperty("blendMode");
  });

  it("produces deterministic JSON", () => {
    const first = compileStudioProject(parallelComponentsProject).json;
    const second = compileStudioProject(parallelComponentsProject).json;

    expect(first).toBe(second);
  });
});
