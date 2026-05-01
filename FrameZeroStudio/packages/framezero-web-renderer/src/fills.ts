import type { MotionFill, MotionNode, MotionShadow } from "@framezero/schema";
import { canvasColor } from "./color";
import { applyDropShadow } from "./effects";

type LinearGradientFill = Extract<MotionFill, { type: "linearGradient" }>;
type RadialGradientFill = Extract<MotionFill, { type: "radialGradient" }>;
type FillPath = (ctx: CanvasRenderingContext2D) => void;

export function buildLinearGradient(
  ctx: Pick<CanvasRenderingContext2D, "createLinearGradient">,
  fill: LinearGradientFill,
  width: number,
  height: number
): CanvasGradient {
  const angle = fill.angle ?? 90;
  const radians = angle * Math.PI / 180;
  const dx = Math.cos(radians) * width / 2;
  const dy = Math.sin(radians) * height / 2;
  const cx = width / 2;
  const cy = height / 2;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  addColorStops(gradient, fill.colors);
  return gradient;
}

export function buildRadialGradient(
  ctx: Pick<CanvasRenderingContext2D, "createRadialGradient">,
  fill: RadialGradientFill,
  width: number,
  height: number
): CanvasGradient {
  const cx = width * (fill.centerX ?? 0.5);
  const cy = height * (fill.centerY ?? 0.5);
  const radius = (fill.radius ?? 0.5) * Math.max(width, height);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(radius, 0.0001));
  addColorStops(gradient, fill.colors);
  return gradient;
}

export function applyGradientTransform(
  ctx: Pick<CanvasRenderingContext2D, "transform">,
  transform: readonly number[] | undefined,
  width: number,
  height: number
): boolean {
  if (transform === undefined || transform.length !== 6) {
    return false;
  }

  const [a, b, c, d, tx, ty] = transform as [number, number, number, number, number, number];
  const isIdentity = a === 1 && d === 1 && b === 0 && c === 0 && tx === 0 && ty === 0;
  if (isIdentity) {
    return false;
  }

  if (Math.abs(a * d - b * c) < 0.0001) {
    return false;
  }

  if (transform.every((value) => Math.abs(value) <= 2)) {
    ctx.transform(a, b, c, d, tx * width, ty * height);
  } else {
    ctx.transform(a, b, c, d, tx, ty);
  }
  return true;
}

export function applyFills(
  ctx: CanvasRenderingContext2D,
  node: MotionNode,
  width: number,
  height: number,
  pathFn: FillPath,
  shadow?: MotionShadow
): void {
  if (node.fills.length === 0) {
    const fallback = styleString(node, "backgroundColor");
    const fill = canvasColor(fallback);
    if (fill === undefined) {
      return;
    }

    drawFillWithShadow(ctx, pathFn, fill, shadow);
    return;
  }

  for (const fill of node.fills) {
    ctx.save();
    ctx.globalAlpha *= fill.opacity ?? 1;
    applyGradientTransform(ctx, "gradientTransform" in fill ? fill.gradientTransform : undefined, width, height);
    drawFillWithShadow(ctx, pathFn, fillStyle(ctx, fill, width, height), shadow);
    ctx.restore();
  }
}

function drawFillWithShadow(
  ctx: CanvasRenderingContext2D,
  pathFn: FillPath,
  fillStyle: string | CanvasGradient,
  shadow: MotionShadow | undefined
): void {
  if (shadow !== undefined && shadow.inset !== true) {
    ctx.save();
    applyDropShadow(ctx, shadow);
    ctx.fillStyle = fillStyle;
    pathFn(ctx);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = fillStyle;
  pathFn(ctx);
  ctx.fill();
}

function addColorStops(
  gradient: Pick<CanvasGradient, "addColorStop">,
  stops: LinearGradientFill["colors"]
): void {
  for (const stop of stops) {
    gradient.addColorStop(stop.position, canvasColor(stop.color, stop.opacity ?? 1) ?? "transparent");
  }
}

function fillStyle(ctx: CanvasRenderingContext2D, fill: MotionFill, width: number, height: number): string | CanvasGradient {
  switch (fill.type) {
    case "solid":
      return canvasColor(fill.color, 1) ?? "transparent";
    case "linearGradient":
      return buildLinearGradient(ctx, fill, width, height);
    case "radialGradient":
      return buildRadialGradient(ctx, fill, width, height);
  }
}

function styleString(node: MotionNode, key: string): string | undefined {
  const value = node.style[key];
  return typeof value === "string" ? value : undefined;
}
