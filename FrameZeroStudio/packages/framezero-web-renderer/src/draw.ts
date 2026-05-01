import type { MotionNode } from "@framezero/schema";
import { canvasColor } from "./color";
import { mapFont, styleString } from "./layout";

const warnedUnsupportedNodes = new Set<string>();

export function drawNodeShape(ctx: CanvasRenderingContext2D, node: MotionNode, width: number, height: number): void {
  switch (node.kind) {
    case "zstack":
    case "vstack":
    case "hstack":
      drawContainerBackground(ctx, node, width, height);
      return;
    case "circle":
      fillCircle(ctx, node, width, height);
      return;
    case "roundedRectangle":
      fillRoundedRectangle(ctx, node, width, height);
      return;
    case "text":
      fillText(ctx, node);
      return;
    case "image":
    case "path":
    case "polygon":
    case "star":
    case "line":
      warnUnsupported(node);
      return;
  }
}

export function pathRoundRect(
  ctx: Pick<CanvasRenderingContext2D, "beginPath" | "moveTo" | "lineTo" | "quadraticCurveTo" | "closePath">,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(Math.max(radius, 0), width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawContainerBackground(ctx: CanvasRenderingContext2D, node: MotionNode, width: number, height: number): void {
  const fill = solidFillColor(node) ?? canvasColor(styleString(node, "backgroundColor"));
  if (fill === undefined) {
    return;
  }

  ctx.fillStyle = fill;
  pathRoundRect(ctx, 0, 0, width, height, node.cornerRadius ?? styleNumber(node, "cornerRadius") ?? 0);
  ctx.fill();
}

function fillCircle(ctx: CanvasRenderingContext2D, node: MotionNode, width: number, height: number): void {
  const fill = solidFillColor(node) ?? canvasColor(styleString(node, "backgroundColor")) ?? "transparent";
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
  ctx.fill();
}

function fillRoundedRectangle(ctx: CanvasRenderingContext2D, node: MotionNode, width: number, height: number): void {
  const fill = solidFillColor(node) ?? canvasColor(styleString(node, "backgroundColor")) ?? "transparent";
  ctx.fillStyle = fill;
  pathRoundRect(ctx, 0, 0, width, height, node.cornerRadius ?? styleNumber(node, "cornerRadius") ?? 0);
  ctx.fill();
}

function fillText(ctx: CanvasRenderingContext2D, node: MotionNode): void {
  ctx.font = mapFont(styleString(node, "font"));
  ctx.fillStyle = canvasColor(styleString(node, "foregroundColor")) ?? "transparent";
  ctx.textBaseline = "top";
  ctx.fillText(styleString(node, "text") ?? "", 0, 0);
}

function solidFillColor(node: MotionNode): string | undefined {
  const fill = node.fills[0];
  if (fill?.type !== "solid") {
    return undefined;
  }

  return canvasColor(fill.color, fill.opacity ?? 1);
}

function styleNumber(node: MotionNode, key: string): number | undefined {
  const value = node.style[key];
  return typeof value === "number" ? value : undefined;
}

function warnUnsupported(node: MotionNode): void {
  if (warnedUnsupportedNodes.has(node.id)) {
    return;
  }

  warnedUnsupportedNodes.add(node.id);
  console.warn(`[MotionCanvasRenderer] Unsupported node kind '${node.kind}' for node '${node.id}'`);
}
