import type { MotionLineSpec, MotionPolygonSpec, MotionStarSpec } from "@framezero/schema";

type Vertex = { x: number; y: number };

type PathContext = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "moveTo" | "lineTo" | "arcTo" | "closePath"
>;

type SvgPathContext = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "moveTo" | "lineTo" | "bezierCurveTo" | "quadraticCurveTo" | "closePath"
>;

export interface SvgPathOptions {
  data: string;
  width: number;
  height: number;
  viewBoxWidth?: number | undefined;
  viewBoxHeight?: number | undefined;
}

export function pathSvg(ctx: SvgPathContext, opts: SvgPathOptions): void {
  const tokens = tokenizeSvgPath(opts.data);
  const vbW = Math.max(opts.viewBoxWidth ?? opts.width, 0.0001);
  const vbH = Math.max(opts.viewBoxHeight ?? opts.height, 0.0001);
  const sx = opts.width / vbW;
  const sy = opts.height / vbH;

  const point = (x: number, y: number) => ({ x: x * sx, y: y * sy });

  let i = 0;
  let command: string | undefined;

  ctx.beginPath();

  const readNumber = (): number | undefined => {
    if (i >= tokens.length) return undefined;
    const v = Number(tokens[i]);
    if (Number.isNaN(v)) return undefined;
    i += 1;
    return v;
  };

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.length === 1 && /[A-Za-z]/.test(token)) {
      command = token;
      i += 1;
    }
    if (!command) break;

    switch (command) {
      case "M":
      case "m": {
        const x = readNumber();
        const y = readNumber();
        if (x === undefined || y === undefined) return;
        const p = point(x, y);
        ctx.moveTo(p.x, p.y);
        break;
      }
      case "L":
      case "l": {
        const x = readNumber();
        const y = readNumber();
        if (x === undefined || y === undefined) return;
        const p = point(x, y);
        ctx.lineTo(p.x, p.y);
        break;
      }
      case "C":
      case "c": {
        const x1 = readNumber();
        const y1 = readNumber();
        const x2 = readNumber();
        const y2 = readNumber();
        const x = readNumber();
        const y = readNumber();
        if (
          x1 === undefined || y1 === undefined ||
          x2 === undefined || y2 === undefined ||
          x === undefined || y === undefined
        ) return;
        const p1 = point(x1, y1);
        const p2 = point(x2, y2);
        const p = point(x, y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p.x, p.y);
        break;
      }
      case "Q":
      case "q": {
        const x1 = readNumber();
        const y1 = readNumber();
        const x = readNumber();
        const y = readNumber();
        if (x1 === undefined || y1 === undefined || x === undefined || y === undefined) return;
        const p1 = point(x1, y1);
        const p = point(x, y);
        ctx.quadraticCurveTo(p1.x, p1.y, p.x, p.y);
        break;
      }
      case "Z":
      case "z":
        ctx.closePath();
        break;
      default:
        // Unsupported command — skip token (advance pointer in caller via the outer loop)
        i += 1;
        break;
    }
  }
}

function tokenizeSvgPath(source: string): string[] {
  const tokens: string[] = [];
  let current = "";
  const flush = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = "";
    }
  };
  for (const ch of source) {
    if (/[A-Za-z]/.test(ch)) {
      flush();
      tokens.push(ch);
    } else if (ch === "," || /\s/.test(ch)) {
      flush();
    } else if (ch === "-" && current.length > 0 && current[current.length - 1] !== "e" && current[current.length - 1] !== "E") {
      flush();
      current += ch;
    } else {
      current += ch;
    }
  }
  flush();
  return tokens;
}

export function pathPolygon(
  ctx: PathContext,
  spec: MotionPolygonSpec,
  width: number,
  height: number
): void {
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) / 2;
  const verts: Vertex[] = [];
  for (let i = 0; i < spec.sides; i++) {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / spec.sides;
    verts.push({ x: cx + R * Math.cos(theta), y: cy + R * Math.sin(theta) });
  }
  polylinePath(ctx, verts, spec.cornerRadius ?? 0);
}

export function pathStar(
  ctx: PathContext,
  spec: MotionStarSpec,
  width: number,
  height: number
): void {
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) / 2;
  const r = R * spec.innerRadius;
  const n = spec.points * 2;
  const verts: Vertex[] = [];
  for (let i = 0; i < n; i++) {
    const theta = -Math.PI / 2 + (i * Math.PI) / spec.points;
    const radius = i % 2 === 0 ? R : r;
    verts.push({ x: cx + radius * Math.cos(theta), y: cy + radius * Math.sin(theta) });
  }
  polylinePath(ctx, verts, spec.cornerRadius ?? 0);
}

export function pathLine(ctx: PathContext, spec: MotionLineSpec): void {
  ctx.beginPath();
  ctx.moveTo(spec.from.x, spec.from.y);
  ctx.lineTo(spec.to.x, spec.to.y);
}

function polylinePath(ctx: PathContext, verts: Vertex[], cornerRadius: number): void {
  const n = verts.length;
  if (n < 2) {
    ctx.beginPath();
    return;
  }
  if (cornerRadius <= 0) {
    ctx.beginPath();
    ctx.moveTo(verts[0]!.x, verts[0]!.y);
    for (let i = 1; i < n; i++) {
      ctx.lineTo(verts[i]!.x, verts[i]!.y);
    }
    ctx.closePath();
    return;
  }
  const radii: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n]!;
    const curr = verts[i]!;
    const next = verts[(i + 1) % n]!;
    const r = Math.min(
      cornerRadius,
      0.5 * Math.min(edgeLen(prev, curr), edgeLen(curr, next))
    );
    radii.push(r);
  }
  const startMid = {
    x: (verts[n - 1]!.x + verts[0]!.x) / 2,
    y: (verts[n - 1]!.y + verts[0]!.y) / 2
  };
  ctx.beginPath();
  ctx.moveTo(startMid.x, startMid.y);
  for (let i = 0; i < n; i++) {
    const curr = verts[i]!;
    const next = verts[(i + 1) % n]!;
    ctx.arcTo(curr.x, curr.y, next.x, next.y, radii[i]!);
  }
  ctx.closePath();
}

function edgeLen(a: Vertex, b: Vertex): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
