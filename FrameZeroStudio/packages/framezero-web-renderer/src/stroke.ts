import type { MotionStroke } from "@framezero/schema";
import { canvasColor } from "./color";

type StrokePath = (ctx: CanvasRenderingContext2D) => void;

export function applyStroke(ctx: CanvasRenderingContext2D, pathFn: StrokePath, spec: MotionStroke | undefined): void {
  if (spec === undefined) {
    return;
  }

  ctx.save();
  ctx.lineWidth = spec.alignment === "center" ? spec.width : spec.width * 2;
  ctx.lineCap = spec.cap ?? "butt";
  ctx.lineJoin = spec.join ?? "miter";
  ctx.miterLimit = spec.miterLimit ?? 10;
  ctx.setLineDash(spec.dash ?? []);
  ctx.strokeStyle = canvasColor(spec.color, 1) ?? "transparent";

  pathFn(ctx);
  if (spec.alignment === "inside") {
    ctx.clip();
    pathFn(ctx);
    ctx.stroke();
  } else if (spec.alignment === "outside") {
    ctx.stroke();
    ctx.globalCompositeOperation = "destination-out";
    pathFn(ctx);
    ctx.fill();
  } else {
    ctx.stroke();
  }

  ctx.restore();
}
