import type { StudioProject } from "../../framezero-compiler/src/index";

export const orbPlaygroundProject: StudioProject = {
  studioVersion: 1,
  id: "energy-sling-launch",
  name: "Energy Sling Launch",
  rootNodeId: "screen",
  nodes: {
    screen: {
      id: "screen",
      name: "Screen",
      kind: "zstack",
      parentId: null,
      childIds: ["orb"],
      roles: ["screen"],
      layout: {},
      style: { backgroundColor: "#0B1020" },
      presentation: {}
    },
    orb: {
      id: "orb",
      name: "Pulse Orb",
      kind: "circle",
      parentId: "screen",
      childIds: [],
      roles: ["actor"],
      layout: { width: 74, height: 74 },
      style: { backgroundColor: "#5ED8FF" },
      presentation: { "offset.x": 0, "offset.y": 0, rotation: 0, scale: 1, opacity: 1 }
    }
  },
  roles: {
    screen: { id: "screen", name: "screen" },
    actor: { id: "actor", name: "actor", description: "Default animated object" }
  },
  phases: {
    chargePull: {
      id: "chargePull",
      name: "Charge Pull",
      mode: "absolute",
      startDelay: 0,
      nextMode: "atTime",
      nextAt: 0.62,
      targets: [
        { select: { id: "orb", properties: ["offset.x"] }, value: -96 },
        { select: { id: "orb", properties: ["offset.y"] }, value: 82 },
        { select: { id: "orb", properties: ["rotation"] }, value: -18 },
        { select: { id: "orb", properties: ["scale"] }, value: 1.18 },
        { select: { id: "orb", properties: ["opacity"] }, value: 1 }
      ],
      rules: [
        {
          select: { id: "orb", properties: ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
          motion: { type: "spring", response: 0.72, dampingFraction: 0.68 }
        }
      ],
      arcs: [],
      jiggles: [],
      actions: [
        { type: "haptic", style: "light", intensity: 0.35 },
        {
          type: "emitParticles",
          id: "charge-dust",
          selector: { id: "orb" },
          count: 18,
          duration: 0.72,
          angle: { min: 205, max: 335 },
          distance: { min: 18, max: 82 },
          particle: {
            kind: "circle",
            layout: { width: 5, height: 5 },
            style: { backgroundColor: "#8EA7FF" },
            from: { scale: 0.7, opacity: 0.7 },
            to: { scale: 0.08, opacity: 0 },
            motion: { type: "timed", duration: 0.72, easing: "easeOut" },
            lifetime: 0.72
          }
        }
      ]
    },
    snapLaunch: {
      id: "snapLaunch",
      name: "Snap Launch",
      mode: "absolute",
      startDelay: 0,
      nextMode: "atTime",
      nextAt: 0.48,
      targets: [
        { select: { id: "orb", properties: ["offset.x"] }, value: 132 },
        { select: { id: "orb", properties: ["offset.y"] }, value: -112 },
        { select: { id: "orb", properties: ["rotation"] }, value: 132 },
        { select: { id: "orb", properties: ["scale"] }, value: 0.78 },
        { select: { id: "orb", properties: ["opacity"] }, value: 0.92 }
      ],
      rules: [
        {
          select: { id: "orb", properties: ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
          motion: { type: "timed", duration: 0.58, easing: "easeIn" }
        }
      ],
      arcs: [
        {
          select: { id: "orb" },
          x: "offset.x",
          y: "offset.y",
          direction: "clockwise",
          bend: 118,
          motion: { type: "timed", duration: 0.58, easing: "easeIn" }
        }
      ],
      jiggles: [],
      actions: [
        { type: "haptic", style: "rigid", intensity: 0.82 },
        { type: "screenShake", amplitude: 5, duration: 0.22, frequency: 34, decay: 2.2 },
        {
          type: "emitParticles",
          id: "speed-trail",
          selector: { id: "orb" },
          count: 32,
          duration: 0.56,
          angle: { min: 150, max: 250 },
          distance: { min: 40, max: 175 },
          particle: {
            kind: "roundedRectangle",
            layout: { width: 16, height: 4 },
            style: { backgroundColor: "#5ED8FF", cornerRadius: 3 },
            from: { scale: 1, opacity: 0.78 },
            to: { scale: 0.12, opacity: 0 },
            motion: { type: "timed", duration: 0.56, easing: "easeOut" },
            lifetime: 0.56
          }
        }
      ]
    },
    impactBloom: {
      id: "impactBloom",
      name: "Impact Bloom",
      mode: "absolute",
      startDelay: 0,
      nextMode: "atTime",
      nextAt: 0.7,
      targets: [
        { select: { id: "orb", properties: ["offset.x"] }, value: 112 },
        { select: { id: "orb", properties: ["offset.y"] }, value: -96 },
        { select: { id: "orb", properties: ["rotation"] }, value: 194 },
        { select: { id: "orb", properties: ["scale"] }, value: 1.34 },
        { select: { id: "orb", properties: ["opacity"] }, value: 1 }
      ],
      rules: [
        {
          select: { id: "orb", properties: ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
          motion: { type: "spring", response: 0.38, dampingFraction: 0.42 }
        }
      ],
      arcs: [],
      jiggles: [
        {
          select: { id: "orb", properties: ["rotation"] },
          amplitude: 18,
          duration: 0.5,
          cycles: 6,
          startDirection: "anticlockwise",
          decay: 0.82
        }
      ],
      actions: [
        { type: "haptic", style: "heavy", intensity: 0.9 },
        { type: "screenShake", amplitude: 9, duration: 0.34, frequency: 28, decay: 2.6 },
        {
          type: "spawnComponents",
          id: "impact-rings",
          selector: { id: "orb" },
          components: [
            {
              id: "ring-outer",
              kind: "circle",
              layout: { width: 58, height: 58 },
              style: { backgroundColor: "#B58CFF" },
              from: { scale: 0.4, opacity: 0.42 },
              to: { scale: 3.4, opacity: 0 },
              motion: { type: "timed", duration: 0.82, easing: "easeOut" },
              lifetime: 0.82
            },
            {
              id: "ring-mid",
              kind: "circle",
              layout: { width: 44, height: 44 },
              style: { backgroundColor: "#5ED8FF" },
              from: { scale: 0.6, opacity: 0.36 },
              to: { scale: 2.45, opacity: 0 },
              motion: { type: "timed", duration: 0.62, easing: "easeOut" },
              lifetime: 0.62
            },
            {
              id: "flash",
              kind: "circle",
              layout: { width: 92, height: 92 },
              style: { backgroundColor: "#E0F2FE" },
              from: { scale: 0.2, opacity: 0.5 },
              to: { scale: 1.1, opacity: 0 },
              motion: { type: "timed", duration: 0.28, easing: "easeOut" },
              lifetime: 0.28
            }
          ]
        }
      ]
    },
    gravityDip: {
      id: "gravityDip",
      name: "Gravity Dip",
      mode: "absolute",
      startDelay: 0,
      nextMode: "atTime",
      nextAt: 0.78,
      targets: [
        { select: { id: "orb", properties: ["offset.x"] }, value: 24 },
        { select: { id: "orb", properties: ["offset.y"] }, value: 78 },
        { select: { id: "orb", properties: ["rotation"] }, value: 286 },
        { select: { id: "orb", properties: ["scale"] }, value: 0.96 },
        { select: { id: "orb", properties: ["opacity"] }, value: 1 }
      ],
      rules: [
        {
          select: { id: "orb", properties: ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
          motion: { type: "spring", response: 0.84, dampingFraction: 0.62 }
        }
      ],
      arcs: [
        {
          select: { id: "orb" },
          x: "offset.x",
          y: "offset.y",
          direction: "anticlockwise",
          bend: 92,
          motion: { type: "spring", response: 0.84, dampingFraction: 0.62 }
        }
      ],
      jiggles: [],
      actions: [
        {
          type: "emitParticles",
          id: "falling-sparks",
          selector: { id: "orb" },
          count: 20,
          duration: 0.66,
          angle: { min: 25, max: 155 },
          distance: { min: 20, max: 96 },
          particle: {
            kind: "circle",
            layout: { width: 6, height: 6 },
            style: { backgroundColor: "#B58CFF" },
            from: { scale: 0.8, opacity: 0.7 },
            to: { scale: 0.05, opacity: 0 },
            motion: { type: "timed", duration: 0.66, easing: "easeOut" },
            lifetime: 0.66
          }
        }
      ]
    },
    heroSettle: {
      id: "heroSettle",
      name: "Hero Settle",
      mode: "absolute",
      startDelay: 0.04,
      nextMode: "afterPreviousSettles",
      nextAt: null,
      targets: [
        { select: { id: "orb", properties: ["offset.x"] }, value: 0 },
        { select: { id: "orb", properties: ["offset.y"] }, value: 0 },
        { select: { id: "orb", properties: ["rotation"] }, value: 360 },
        { select: { id: "orb", properties: ["scale"] }, value: 1 },
        { select: { id: "orb", properties: ["opacity"] }, value: 1 }
      ],
      rules: [
        {
          select: { id: "orb", properties: ["offset.x", "offset.y", "rotation", "scale", "opacity"] },
          motion: { type: "spring", response: 0.64, dampingFraction: 0.76 }
        }
      ],
      arcs: [],
      jiggles: [
        {
          select: { id: "orb", properties: ["rotation"] },
          amplitude: 7,
          duration: 0.32,
          cycles: 3,
          startDirection: "clockwise",
          decay: 0.72
        }
      ],
      actions: [
        { type: "haptic", style: "success", intensity: 0.72 },
        {
          type: "emitParticles",
          id: "settle-stars",
          selector: { id: "orb" },
          count: 28,
          duration: 0.74,
          angle: { min: 0, max: 360 },
          distance: { min: 28, max: 128 },
          particle: {
            kind: "circle",
            layout: { width: 4, height: 4 },
            style: { backgroundColor: "#E0F2FE" },
            from: { scale: 1, opacity: 0.82 },
            to: { scale: 0.06, opacity: 0 },
            motion: { type: "timed", duration: 0.74, easing: "easeOut" },
            lifetime: 0.74
          }
        }
      ]
    }
  },
  phaseOrder: ["chargePull", "snapLaunch", "impactBloom", "gravityDip", "heroSettle"],
  triggers: {},
  components: {
    neonOrb: {
      id: "neonOrb",
      name: "Neon Orb",
      kind: "circle",
      roles: ["actor"],
      layout: { width: 74, height: 74 },
      style: {
        backgroundColor: "#5ED8FF",
        gradientEndColor: "#B58CFF",
        gradientAngle: 135
      },
      fills: [
        {
          type: "radialGradient",
          colors: [
            { color: "#E0F2FE", position: 0 },
            { color: "#5ED8FF", position: 0.48 },
            { color: "#B58CFF", position: 1 }
          ],
          centerX: 0.35,
          centerY: 0.28,
          radius: 88,
          opacity: 1
        }
      ],
      presentation: { "offset.x": 0, "offset.y": 0, rotation: 0, scale: 1, opacity: 1 }
    },
    glassCard: {
      id: "glassCard",
      name: "Glass Card",
      kind: "roundedRectangle",
      roles: ["actor"],
      layout: { width: 150, height: 86 },
      style: {
        backgroundColor: "#25304A",
        gradientEndColor: "#5ED8FF",
        gradientAngle: 120,
        cornerRadius: 18
      },
      fills: [
        {
          type: "linearGradient",
          colors: [
            { color: "#25304A", position: 0 },
            { color: "#0EA5E9", position: 0.72 },
            { color: "#5ED8FF", position: 1 }
          ],
          angle: 120,
          opacity: 0.92
        }
      ],
      presentation: { "offset.x": 0, "offset.y": 0, rotation: 0, scale: 1, opacity: 1 }
    }
  },
  editor: {
    selection: ["orb"],
    viewportPreset: "iphone"
  }
};

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
