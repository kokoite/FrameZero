import { useEffect, useRef, type PointerEvent } from "react";
import { MotionRuntime } from "@framezero/runtime";
import type { MotionDocument, MotionNode } from "@framezero/schema";
import { MotionCanvasRenderer } from "@framezero/web-renderer";

export interface MotionPreviewProps {
  document: MotionDocument | null;
  canvasWidth: number;
  canvasHeight: number;
  onTap?: (nodeID: string) => void;
}

interface MotionPreviewDrag {
  nodeID: string;
  startX: number;
  startY: number;
  anchorX: number;
  anchorY: number;
  lastDeltaX: number;
  lastDeltaY: number;
}

interface MotionPreviewHitTestRuntime {
  valueFor(nodeID: string, property: string, fallback?: number): number;
}

export interface MotionPreviewRuntimeState {
  runtime: MotionRuntime | null;
  renderer: MotionCanvasRenderer | null;
  document: MotionDocument | null;
}

export interface MotionPreviewLoopState {
  runtimeRef: { current: Pick<MotionRuntime, "tick"> | null };
  rendererRef: { current: Pick<MotionCanvasRenderer, "render"> | null };
  rafRef: { current: number | null };
  lastRef: { current: number };
}

export function isMotionRendererEnabled(search: string, rendererEnv: string | undefined): boolean {
  return new URLSearchParams(search).get("renderer") === "motion" || rendererEnv === "motion";
}

export function startMotionPreviewLoop(state: MotionPreviewLoopState): () => void {
  function frame(now: number): void {
    const dt = Math.min((now - state.lastRef.current) / 1000, 0.032);
    state.lastRef.current = now;
    state.runtimeRef.current?.tick(dt);
    state.rendererRef.current?.render();
    state.rafRef.current = requestAnimationFrame(frame);
  }

  state.rafRef.current = requestAnimationFrame(frame);
  return () => {
    if (state.rafRef.current !== null) {
      cancelAnimationFrame(state.rafRef.current);
    }
  };
}

export function syncMotionPreviewRuntime(
  state: MotionPreviewRuntimeState,
  canvas: HTMLCanvasElement | null,
  document: MotionDocument | null,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (document === null || canvas === null) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }

  const viewport = {
    width: canvasWidth,
    height: canvasHeight,
    safeAreaTop: 0,
    safeAreaLeading: 0,
    safeAreaBottom: 0,
    safeAreaTrailing: 0
  };
  const runtime = new MotionRuntime(document, { viewport });
  const dpr = devicePixelRatio();
  const renderer = new MotionCanvasRenderer(runtime, document, ctx, {
    devicePixelRatio: dpr,
    logicalSize: { width: canvasWidth, height: canvasHeight }
  });

  renderer.setSize(canvasWidth, canvasHeight, dpr);
  state.runtime = runtime;
  state.renderer = renderer;
  state.document = document;
}

export function toCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX - canvasWidth / 2,
    y: (clientY - rect.top) * scaleY - canvasHeight / 2
  };
}

export function hitTest(doc: MotionDocument, runtime: MotionPreviewHitTestRuntime, x: number, y: number): MotionNode | undefined {
  for (let index = doc.nodes.length - 1; index >= 0; index -= 1) {
    const node = doc.nodes[index];
    if (node === undefined) continue;

    const width = numericLayoutValue(node.layout.width);
    const height = numericLayoutValue(node.layout.height);
    const cx = runtime.valueFor(node.id, "offset.x", 0);
    const cy = runtime.valueFor(node.id, "offset.y", 0);

    // Axis-aligned only for the Phase 8 cutover; rotation and scale are ignored.
    if (x >= cx - width / 2 && x <= cx + width / 2 && y >= cy - height / 2 && y <= cy + height / 2) {
      return node;
    }
  }

  return undefined;
}

export function MotionPreview({ document, canvasWidth, canvasHeight, onTap }: MotionPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<MotionRuntime | null>(null);
  const rendererRef = useRef<MotionCanvasRenderer | null>(null);
  const documentRef = useRef<MotionDocument | null>(null);
  const dragRef = useRef<MotionPreviewDrag | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(nowTimestamp());

  useEffect(() => {
    const state = {
      runtime: runtimeRef.current,
      renderer: rendererRef.current,
      document: documentRef.current
    };
    syncMotionPreviewRuntime(state, canvasRef.current, document, canvasWidth, canvasHeight);
    runtimeRef.current = state.runtime;
    rendererRef.current = state.renderer;
    documentRef.current = state.document;
  }, [document, canvasWidth, canvasHeight]);

  useEffect(() => {
    return startMotionPreviewLoop({ runtimeRef, rendererRef, rafRef, lastRef });
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>): void {
    const runtime = runtimeRef.current;
    const doc = documentRef.current;
    const canvas = canvasRef.current;
    if (runtime === null || doc === null || canvas === null) return;

    const point = toCanvasCoords(canvas, event.clientX, event.clientY, canvasWidth, canvasHeight);
    const node = hitTest(doc, runtime, point.x, point.y);
    if (node === undefined) return;

    if (runtime.hasDragBinding(node.id)) {
      dragRef.current = {
        nodeID: node.id,
        startX: point.x,
        startY: point.y,
        anchorX: point.x,
        anchorY: point.y,
        lastDeltaX: 0,
        lastDeltaY: 0
      };
    } else {
      runtime.handleTap(node.id);
      onTap?.(node.id);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (drag === null || runtime === null || canvas === null) return;

    const point = toCanvasCoords(canvas, event.clientX, event.clientY, canvasWidth, canvasHeight);
    const translationX = point.x - drag.startX;
    const translationY = point.y - drag.startY;
    const lastDeltaX = point.x - drag.anchorX;
    const lastDeltaY = point.y - drag.anchorY;

    runtime.handleDragChanged(drag.nodeID, {
      translationX,
      translationY,
      predictedTranslationX: translationX + lastDeltaX * 3, // TODO(framezero): replace with 3-5 sample velocity accumulator
      predictedTranslationY: translationY + lastDeltaY * 3 // TODO(framezero): replace with 3-5 sample velocity accumulator
    });

    dragRef.current = {
      ...drag,
      anchorX: point.x,
      anchorY: point.y,
      lastDeltaX,
      lastDeltaY
    };
  }

  function handlePointerEnd(event: PointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (drag === null || runtime === null || canvas === null) {
      dragRef.current = null;
      return;
    }

    const point = toCanvasCoords(canvas, event.clientX, event.clientY, canvasWidth, canvasHeight);
    const translationX = point.x - drag.startX;
    const translationY = point.y - drag.startY;

    runtime.handleDragEnded(drag.nodeID, {
      translationX,
      translationY,
      predictedTranslationX: translationX + drag.lastDeltaX * 3, // TODO(framezero): replace with 3-5 sample velocity accumulator
      predictedTranslationY: translationY + drag.lastDeltaY * 3 // TODO(framezero): replace with 3-5 sample velocity accumulator
    });
    dragRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="Motion preview"
      width={canvasWidth}
      height={canvasHeight}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ display: "block", width: canvasWidth, height: canvasHeight, touchAction: "none" }}
    />
  );
}

function numericLayoutValue(value: MotionNode["layout"][string] | undefined): number {
  return typeof value === "number" ? value : 0;
}

function nowTimestamp(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

function devicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio ?? 1;
}
