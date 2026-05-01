export type MockCall = [string, ...unknown[]];

export interface MockGradient {
  kind: "linear" | "radial";
  args: number[];
  stops: Array<{ offset: number; color: string }>;
  addColorStop(offset: number, color: string): void;
}

export interface MockCanvas {
  ctx: CanvasRenderingContext2D;
  calls: MockCall[];
  gradients: MockGradient[];
}

interface CanvasState {
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
}

export function createMockCtx(): MockCanvas {
  const calls: MockCall[] = [];
  const gradients: MockGradient[] = [];
  const state: CanvasState = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over"
  };
  const stack: CanvasState[] = [];

  const createGradient = (kind: MockGradient["kind"], args: number[]): MockGradient => {
    const gradient: MockGradient = {
      kind,
      args,
      stops: [],
      addColorStop(offset: number, color: string) {
        calls.push(["addColorStop", offset, color]);
        this.stops.push({ offset, color });
      }
    };
    gradients.push(gradient);
    return gradient;
  };

  const ctx = {
    save: () => {
      stack.push({ ...state });
      calls.push(["save"]);
    },
    restore: () => {
      const previous = stack.pop();
      if (previous !== undefined) {
        state.globalAlpha = previous.globalAlpha;
        state.globalCompositeOperation = previous.globalCompositeOperation;
      }
      calls.push(["restore"]);
    },
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (x: number, y: number) => calls.push(["moveTo", x, y]),
    lineTo: (x: number, y: number) => calls.push(["lineTo", x, y]),
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) =>
      calls.push(["quadraticCurveTo", cpx, cpy, x, y]),
    arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) =>
      calls.push(["arc", x, y, radius, startAngle, endAngle]),
    ellipse: (x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number) =>
      calls.push(["ellipse", x, y, radiusX, radiusY, rotation, startAngle, endAngle]),
    closePath: () => calls.push(["closePath"]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"]),
    clip: () => calls.push(["clip"]),
    setLineDash: (dash: number[]) => calls.push(["setLineDash", [...dash]]),
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) =>
      calls.push(["transform", a, b, c, d, e, f]),
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      calls.push(["createLinearGradient", x0, y0, x1, y1]);
      return createGradient("linear", [x0, y0, x1, y1]);
    },
    createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
      calls.push(["createRadialGradient", x0, y0, r0, x1, y1, r1]);
      return createGradient("radial", [x0, y0, r0, x1, y1, r1]);
    },
    fillText: (text: string, x: number, y: number) => calls.push(["fillText", text, x, y]),
    measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics,
    set fillStyle(value: string | CanvasGradient) {
      calls.push(["fillStyle", value]);
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value: number) {
      calls.push(["lineWidth", value]);
    },
    set lineCap(value: CanvasLineCap) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value: CanvasLineJoin) {
      calls.push(["lineJoin", value]);
    },
    set miterLimit(value: number) {
      calls.push(["miterLimit", value]);
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
      calls.push(["globalAlpha", value]);
    },
    get globalCompositeOperation() {
      return state.globalCompositeOperation;
    },
    set globalCompositeOperation(value: GlobalCompositeOperation) {
      state.globalCompositeOperation = value;
      calls.push(["globalCompositeOperation", value]);
    },
    set font(value: string) {
      calls.push(["font", value]);
    },
    set textBaseline(value: CanvasTextBaseline) {
      calls.push(["textBaseline", value]);
    }
  };

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, gradients };
}
