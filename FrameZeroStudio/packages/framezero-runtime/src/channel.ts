import type { MotionReduceMotionPolicy, MotionSensitivityLevel, MotionSpec } from "@framezero/schema";
import { evalEasing } from "./easing";

export type MotionChannelTargetOptions = {
  sensitivity?: MotionSensitivityLevel;
  documentPolicy?: MotionReduceMotionPolicy;
  isMotionReduced?: boolean;
};

const reducedMotionSpec: MotionSpec = {
  type: "timed",
  duration: 0.15,
  easing: "easeOut"
};

export class MotionChannel {
  current = 0;
  velocity = 0;
  target = 0;
  motion: MotionSpec = { type: "immediate" };
  animationStart = 0;
  animationElapsed = 0;

  constructor(initial?: Partial<Pick<MotionChannel, "current" | "velocity" | "target" | "motion" | "animationStart" | "animationElapsed">>) {
    if (initial?.current !== undefined) {
      this.current = initial.current;
    }
    if (initial?.velocity !== undefined) {
      this.velocity = initial.velocity;
    }
    if (initial?.target !== undefined) {
      this.target = initial.target;
    }
    if (initial?.motion !== undefined) {
      this.motion = initial.motion;
    }
    if (initial?.animationStart !== undefined) {
      this.animationStart = initial.animationStart;
    }
    if (initial?.animationElapsed !== undefined) {
      this.animationElapsed = initial.animationElapsed;
    }
  }

  setTarget(target: number, motion: MotionSpec, opts?: MotionChannelTargetOptions): void {
    this.target = target;
    this.motion = this.effectiveMotion(motion, opts);
    this.animationStart = this.current;
    this.animationElapsed = 0;
  }

  integrate(dt: number): void {
    const clampedDt = Math.min(Math.max(dt, 0), 0.032);

    switch (this.motion.type) {
      case "immediate":
        this.current = this.target;
        this.velocity = 0;
        break;
      case "spring": {
        const response = Math.max(this.motion.response, 0.001);
        const damping = Math.max(this.motion.dampingFraction, 0);
        const omega = (2 * Math.PI) / response;
        const stiffness = omega * omega;
        const dampingCoefficient = 2 * damping * omega;
        const displacement = this.current - this.target;
        const acceleration = -stiffness * displacement - dampingCoefficient * this.velocity;

        this.velocity += acceleration * clampedDt;
        this.current += this.velocity * clampedDt;

        if (this.isSettled) {
          this.current = this.target;
          this.velocity = 0;
        }
        break;
      }
      case "timed": {
        const oldCurrent = this.current;
        this.animationElapsed += clampedDt;

        const duration = Math.max(this.motion.duration, 0.001);
        const progress = Math.min(Math.max(this.animationElapsed / duration, 0), 1);
        const easedProgress = evalEasing(this.motion.easing, progress);
        this.current = this.animationStart + (this.target - this.animationStart) * easedProgress;
        this.velocity = (this.current - oldCurrent) / Math.max(clampedDt, 0.001);

        if (progress >= 1) {
          this.current = this.target;
          this.velocity = 0;
        }
        break;
      }
    }
  }

  get isSettled(): boolean {
    return Math.abs(this.current - this.target) < 0.001 && Math.abs(this.velocity) < 0.001;
  }

  private effectiveMotion(motion: MotionSpec, opts?: MotionChannelTargetOptions): MotionSpec {
    if (opts?.documentPolicy === "ignore" || opts?.isMotionReduced !== true || opts?.sensitivity === "essential") {
      return motion;
    }

    switch (motion.type) {
      case "spring":
      case "timed":
        return reducedMotionSpec;
      case "immediate":
        return motion;
    }
  }
}
