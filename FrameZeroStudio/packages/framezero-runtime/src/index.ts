export { MotionChannel, type MotionChannelTargetOptions } from "./channel";
export { cubicBezierEval, evalEasing, type TimedEasing } from "./easing";
export { MotionRuntime, type MotionRuntimeOptions, type MotionViewport } from "./runtime";
export { resolveNodeIDs, resolvePropertyKeys, type MotionResolvedPropertyKey } from "./selector";
export { resolveNumericValue } from "./value";
export type {
  MotionDocument,
  MotionPropertySelector,
  MotionReduceMotionPolicy,
  MotionSensitivityLevel,
  MotionSpec,
  MotionValue
} from "@framezero/schema";
