import type { MotionSpec } from "@framezero/schema";

export type TimedEasing = Extract<MotionSpec, { type: "timed" }>["easing"];

export function cubicBezierEval(p: number, x1: number, y1: number, x2: number, y2: number): number {
  if (p <= 0) {
    return 0;
  }
  if (p >= 1) {
    return 1;
  }

  const bx = (t: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
  };
  const by = (t: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  };
  const dx = (t: number): number => {
    const u = 1 - t;
    return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
  };

  let t = p;
  for (let i = 0; i < 8; i += 1) {
    const err = bx(t) - p;
    if (Math.abs(err) < 1e-6) {
      break;
    }
    const d = dx(t);
    if (Math.abs(d) < 1e-6) {
      break;
    }
    t -= err / d;
    if (t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }
  }

  return by(t);
}

export function evalEasing(easing: TimedEasing, p: number): number {
  const effective = easing ?? "easeInOut";

  if (effective === "linear") {
    return p;
  }
  if (effective === "easeIn") {
    return p * p;
  }
  if (effective === "easeOut") {
    return 1 - Math.pow(1 - p, 2);
  }
  if (effective === "easeInOut") {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }

  const [x1, y1, x2, y2] = effective.cubicBezier;
  return cubicBezierEval(p, x1, y1, x2, y2);
}
