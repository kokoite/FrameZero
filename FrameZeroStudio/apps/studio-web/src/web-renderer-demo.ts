import { parseMotionDocument } from "@framezero/schema";
import { MotionRuntime } from "@framezero/runtime";
import { MotionCanvasRenderer } from "@framezero/web-renderer";

const VIEWPORT = {
  width: 390,
  height: 600,
  safeAreaTop: 47,
  safeAreaLeading: 0,
  safeAreaBottom: 34,
  safeAreaTrailing: 0
};

async function bootPhase1Card(): Promise<void> {
  const canvas = document.getElementById("canvas-phase1card") as HTMLCanvasElement | null;
  const status = document.getElementById("status-phase1card");
  if (!canvas || !status) return;

  let doc;
  try {
    const res = await fetch("/Phase1Card.motion.json");
    const json = await res.json();
    doc = parseMotionDocument(json);
  } catch (err) {
    status.textContent = `Failed to load Phase1Card: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    status.textContent = "Canvas2D not available";
    return;
  }

  const runtime = new MotionRuntime(doc, { viewport: VIEWPORT });
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width = VIEWPORT.width * dpr;
  canvas.height = VIEWPORT.height * dpr;

  const renderer = new MotionCanvasRenderer(runtime, doc, ctx, {
    devicePixelRatio: dpr,
    logicalSize: { width: VIEWPORT.width, height: VIEWPORT.height }
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;
    runtime.tick(dt);
    renderer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // tap → fire tapSource trigger; the runtime walks parents from "screen" but the
  // selector matches role "source" — so we tap the source shape's known id.
  // We don't have hit testing yet (Phase 7b), so any click on the canvas dispatches
  // to "sourceShape" (the role-tagged node).
  canvas.addEventListener("click", () => {
    runtime.handleTap("sourceShape");
    status.textContent = `Tap dispatched. State: ${runtime.currentState("circleMachine") ?? "?"}`;
  });

  status.textContent = "Loaded. Tap to fire tapSource trigger.";
}

function buildGalleryDoc(): unknown {
  return {
    schemaVersion: 1,
    root: "screen",
    nodes: [
      {
        id: "screen",
        kind: "zstack",
        roles: ["screen"],
        layout: { width: 780, height: 280 },
        style: { backgroundColor: "#050a14" },
        presentation: {},
        children: ["polyCard", "starCard", "lineCard", "pathCard", "rectCard"]
      },
      {
        id: "polyCard",
        kind: "polygon",
        roles: [],
        layout: { width: 110, height: 110 },
        style: {},
        fills: [{ type: "solid", color: "#38BDF8", opacity: 1 }],
        presentation: { "offset.x": -260, "offset.y": 0 },
        polygon: { sides: 5, cornerRadius: 6 },
        stroke: { color: "#FFFFFF", width: 2, alignment: "center", dash: [6, 3], cap: "round", join: "round" },
        children: []
      },
      {
        id: "starCard",
        kind: "star",
        roles: [],
        layout: { width: 110, height: 110 },
        style: {},
        fills: [
          {
            type: "linearGradient",
            angle: 135,
            colors: [
              { color: "#FBBF24", position: 0 },
              { color: "#F472B6", position: 1 }
            ],
            opacity: 1
          }
        ],
        presentation: { "offset.x": -130, "offset.y": 0 },
        star: { points: 8, innerRadius: 0.5, cornerRadius: 4 },
        shadow: { x: 0, y: 0, blur: 18, opacity: 0.6, color: "#F472B6", inset: true },
        children: []
      },
      {
        id: "lineCard",
        kind: "line",
        roles: [],
        layout: { width: 110, height: 110 },
        style: {},
        presentation: { "offset.x": 0, "offset.y": 0 },
        line: { from: { x: 0, y: 55 }, to: { x: 110, y: 55 } },
        stroke: { color: "#10B981", width: 6, alignment: "center", dash: [12, 6], cap: "round" },
        children: []
      },
      {
        id: "pathCard",
        kind: "path",
        roles: [],
        layout: { width: 110, height: 110 },
        style: {
          pathData: "M 10 90 Q 30 10 55 60 Q 80 110 100 30 L 100 100 L 10 100 Z",
          viewBoxWidth: 110,
          viewBoxHeight: 110
        },
        fills: [
          {
            type: "radialGradient",
            centerX: 0.5,
            centerY: 0.5,
            radius: 0.7,
            colors: [
              { color: "#A78BFA", position: 0 },
              { color: "#1E1B4B", position: 1 }
            ],
            opacity: 1
          }
        ],
        presentation: { "offset.x": 130, "offset.y": 0 },
        children: []
      },
      {
        id: "rectCard",
        kind: "roundedRectangle",
        roles: [],
        layout: { width: 110, height: 110 },
        style: {},
        fills: [{ type: "solid", color: "#0EA5E9", opacity: 0.9 }],
        presentation: { "offset.x": 260, "offset.y": 0 },
        cornerRadii: { topLeft: 32, topRight: 8, bottomLeft: 8, bottomRight: 32 },
        shadow: { x: 0, y: 12, blur: 22, opacity: 0.7, color: "#0EA5E9" },
        stroke: { color: "#FFFFFF", width: 1.5, alignment: "outside" },
        children: []
      }
    ],
    machines: [
      { id: "main", initial: "idle", states: [{ id: "idle", values: [] }], transitions: [] }
    ],
    triggers: [],
    dragBindings: [],
    bodies: [],
    forces: []
  };
}

function bootGallery(): void {
  const canvas = document.getElementById("canvas-gallery") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const doc = parseMotionDocument(buildGalleryDoc());
  const runtime = new MotionRuntime(doc, {
    viewport: {
      width: 780,
      height: 280,
      safeAreaTop: 0,
      safeAreaLeading: 0,
      safeAreaBottom: 0,
      safeAreaTrailing: 0
    }
  });
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width = 780 * dpr;
  canvas.height = 280 * dpr;

  const renderer = new MotionCanvasRenderer(runtime, doc, ctx, {
    devicePixelRatio: dpr,
    logicalSize: { width: 780, height: 280 }
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;
    runtime.tick(dt);
    renderer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootPhase1Card().catch((err) => {
  console.error("Phase1Card boot failed:", err);
});
bootGallery();
