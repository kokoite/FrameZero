import type { MotionLineSpec, MotionPolygonSpec, MotionStarSpec } from "@framezero/schema";

type Vertex = { x: number; y: number };

type PathContext = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "moveTo" | "lineTo" | "arcTo" | "closePath"
>;

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
