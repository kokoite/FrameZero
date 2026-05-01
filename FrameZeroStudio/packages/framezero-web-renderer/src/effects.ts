import type { MotionBlendMode, MotionNode, MotionShadow } from "@framezero/schema";
import { rgbaWithOpacity } from "./color";

type EffectPath = (ctx: CanvasRenderingContext2D) => void;

export interface EffectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BLEND_MODE_MAP: Record<MotionBlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  colorDodge: "color-dodge",
  colorBurn: "color-burn",
  softLight: "soft-light",
  hardLight: "hard-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
  plusLighter: "lighter",
  plusDarker: "multiply"
};

const warnedPlusDarkerNodes = new Set<string>();

export function resolveShadow(node: MotionNode): MotionShadow | undefined {
  if (node.shadow !== undefined) {
    return node.shadow;
  }

  const x = styleNumber(node, "shadowX");
  const y = styleNumber(node, "shadowY");
  const blur = styleNumber(node, "shadowBlur");
  const color = styleString(node, "shadowColor");
  const opacity = styleNumber(node, "shadowOpacity");

  if (x === undefined || y === undefined || blur === undefined || color === undefined || opacity === undefined) {
    return undefined;
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return undefined;
  }

  return {
    x,
    y,
    blur: Math.max(blur, 0),
    color,
    opacity: Math.min(Math.max(opacity, 0), 1)
  };
}

export function resolveBlendMode(node: MotionNode): MotionBlendMode {
  if (node.blendMode !== undefined) {
    return node.blendMode;
  }

  const value = styleString(node, "blendMode");
  return isBlendMode(value) ? value : "normal";
}

export function resolveLayerBlur(node: MotionNode): number {
  if (node.layerBlur !== undefined) {
    return node.layerBlur;
  }

  const blur = styleNumber(node, "blur");
  if (blur !== undefined) {
    return blur;
  }

  const figmaBlur = styleNumber(node, "figmaBlur");
  return figmaBlur !== undefined ? figmaBlur / 2 : 0;
}

export function mapBlendMode(mode: MotionBlendMode, nodeID?: string): GlobalCompositeOperation {
  if (mode === "plusDarker") {
    const key = nodeID ?? "__global__";
    if (!warnedPlusDarkerNodes.has(key)) {
      warnedPlusDarkerNodes.add(key);
      console.warn("plusDarker has no Canvas2D primitive; using multiply approximation. Tracked for Phase 5b.");
    }
  }

  return BLEND_MODE_MAP[mode];
}

export function applyDropShadow(ctx: CanvasRenderingContext2D, spec: MotionShadow): void {
  ctx.shadowColor = rgbaWithOpacity(spec.color, spec.opacity);
  ctx.shadowBlur = spec.blur;
  ctx.shadowOffsetX = spec.x;
  ctx.shadowOffsetY = spec.y;
}

export function applyInnerShadow(
  ctx: CanvasRenderingContext2D,
  pathFn: EffectPath,
  spec: MotionShadow,
  bounds: EffectBounds
): void {
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  ctx.shadowColor = rgbaWithOpacity(spec.color, spec.opacity);
  ctx.shadowBlur = spec.blur;
  ctx.shadowOffsetX = -spec.x;
  ctx.shadowOffsetY = -spec.y;

  const inflate = spec.blur + Math.max(Math.abs(spec.x), Math.abs(spec.y));
  ctx.strokeStyle = "rgba(0,0,0,0)";
  ctx.lineWidth = Math.max(spec.blur * 2, 1);
  ctx.beginPath();
  ctx.rect(bounds.x - inflate, bounds.y - inflate, bounds.w + inflate * 2, bounds.h + inflate * 2);
  ctx.stroke();
  ctx.restore();
}

export function applyLayerBlur(ctx: CanvasRenderingContext2D, blurPx: number): void {
  if (blurPx <= 0) {
    return;
  }

  ctx.filter = `blur(${blurPx}px)`;
}

function isBlendMode(value: string | undefined): value is MotionBlendMode {
  return value !== undefined && Object.hasOwn(BLEND_MODE_MAP, value);
}

function styleNumber(node: MotionNode, key: string): number | undefined {
  const value = node.style[key];
  return typeof value === "number" ? value : undefined;
}

function styleString(node: MotionNode, key: string): string | undefined {
  const value = node.style[key];
  return typeof value === "string" ? value : undefined;
}
