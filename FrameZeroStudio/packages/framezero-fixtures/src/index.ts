import type { StudioProject } from "../../framezero-compiler/src/index";

export const parallelComponentsProject: StudioProject = {
  studioVersion: 1,
  id: "parallel-components",
  name: "Parallel Components",
  rootNodeId: "screen",
  nodes: {
    screen: {
      id: "screen",
      name: "Screen",
      kind: "zstack",
      parentId: null,
      childIds: ["card", "icon", "title"],
      roles: ["screen"],
      layout: {},
      style: { backgroundColor: "#0B1020" },
      presentation: {}
    },
    card: {
      id: "card",
      name: "Card",
      kind: "roundedRectangle",
      parentId: "screen",
      childIds: [],
      roles: ["tapTarget", "gesturePart"],
      layout: { width: 170, height: 96 },
      style: { backgroundColor: "#0EA5E9", cornerRadius: 18 },
      presentation: { "offset.x": 0, "offset.y": 0, scale: 1, opacity: 1 }
    },
    icon: {
      id: "icon",
      name: "Icon",
      kind: "circle",
      parentId: "screen",
      childIds: [],
      roles: ["gesturePart"],
      layout: { width: 42, height: 42 },
      style: { backgroundColor: "#FFFFFF" },
      presentation: { "offset.x": 0, "offset.y": -18, scale: 1, opacity: 1 }
    },
    title: {
      id: "title",
      name: "Title",
      kind: "text",
      parentId: "screen",
      childIds: [],
      roles: ["gestureCopy"],
      layout: {},
      style: { text: "Drag ready", foregroundColor: "#FFFFFF" },
      presentation: { "offset.x": 0, "offset.y": 0, scale: 1, opacity: 0.35 }
    }
  },
  roles: {
    screen: { id: "screen", name: "screen" },
    tapTarget: { id: "tapTarget", name: "tapTarget" },
    gesturePart: { id: "gesturePart", name: "gesturePart" },
    gestureCopy: { id: "gestureCopy", name: "gestureCopy" }
  },
  phases: {
    communicatingGesture: {
      id: "communicatingGesture",
      name: "Communicating Gesture",
      mode: "absolute",
      startDelay: 0,
      nextMode: "afterPreviousSettles",
      nextAt: null,
      targets: [
        { select: { role: "gesturePart", properties: ["offset.x"] }, value: 64 },
        { select: { role: "gesturePart", properties: ["scale"] }, value: 1.2 },
        { select: { id: "title", properties: ["offset.y"] }, value: -24 },
        { select: { id: "title", properties: ["opacity"] }, value: 1 }
      ],
      rules: [
        {
          select: { role: "gesturePart", properties: ["offset.x", "scale"] },
          motion: { type: "spring", response: 0.35, dampingFraction: 0.78 }
        },
        {
          select: { id: "title", properties: ["offset.y", "opacity"] },
          motion: { type: "timed", duration: 0.25, easing: "easeOut" }
        }
      ],
      arcs: [],
      jiggles: [],
      actions: [{ type: "haptic", style: "medium", intensity: 0.7 }]
    }
  },
  phaseOrder: ["communicatingGesture"],
  triggers: {
    tapCard: { id: "tapCard", type: "tap", selector: { id: "card" } }
  },
  components: {},
  editor: {
    selection: ["card", "icon"],
    viewportPreset: "iphone"
  }
};
