import type { MotionValue } from "@framezero/schema";
import type { MotionViewport } from "./runtime";

type MotionMetric = Extract<MotionValue, { metric: string }>["metric"];

export function resolveNumericValue(value: MotionValue, viewport?: MotionViewport): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return undefined;
  }

  const base = viewportValue(value.metric, viewport);
  return base * (value.multiplier ?? 1) + (value.offset ?? 0);
}

function viewportValue(metric: MotionMetric, viewport?: MotionViewport): number {
  if (viewport === undefined) {
    return 0;
  }

  const left = -viewport.width / 2;
  const right = viewport.width / 2;
  const top = -viewport.height / 2;
  const bottom = viewport.height / 2;
  const safeLeft = left + viewport.safeAreaLeading;
  const safeRight = right - viewport.safeAreaTrailing;
  const safeTop = top + viewport.safeAreaTop;
  const safeBottom = bottom - viewport.safeAreaBottom;

  switch (metric) {
    case "screen.width":
      return viewport.width;
    case "screen.height":
      return viewport.height;
    case "screen.left":
      return left;
    case "screen.right":
      return right;
    case "screen.top":
      return top;
    case "screen.bottom":
      return bottom;
    case "screen.centerX":
      return 0;
    case "screen.centerY":
      return 0;
    case "safeArea.width":
      return safeRight - safeLeft;
    case "safeArea.height":
      return safeBottom - safeTop;
    case "safeArea.left":
      return safeLeft;
    case "safeArea.right":
      return safeRight;
    case "safeArea.top":
      return safeTop;
    case "safeArea.bottom":
      return safeBottom;
    case "safeArea.centerX":
      return (safeLeft + safeRight) / 2;
    case "safeArea.centerY":
      return (safeTop + safeBottom) / 2;
  }
}
