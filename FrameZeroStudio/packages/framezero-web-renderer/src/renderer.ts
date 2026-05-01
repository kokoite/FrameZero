import type { MotionDocument, MotionNode } from "@framezero/schema";
import { visibleOpacity } from "./color";
import { drawNodeShape } from "./draw";
import { applyLayerBlur, mapBlendMode, resolveBlendMode, resolveLayerBlur } from "./effects";
import { type LayoutMap, type Size, measureTree, nodeMap, styleString } from "./layout";

export interface MotionRuntime {
  valueFor(nodeID: string, property: string, fallback?: number): number;
}

export interface MotionCanvasRendererOptions {
  devicePixelRatio?: number;
  logicalSize?: { width: number; height: number };
}

export class MotionCanvasRenderer {
  private readonly runtime: MotionRuntime;
  private readonly document: MotionDocument;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly nodes: Map<string, MotionNode>;
  private logicalSize: Size;
  private dpr: number;

  constructor(
    runtime: MotionRuntime,
    document: MotionDocument,
    ctx: CanvasRenderingContext2D,
    opts: MotionCanvasRendererOptions = {}
  ) {
    this.runtime = runtime;
    this.document = document;
    this.ctx = ctx;
    this.nodes = nodeMap(document);
    this.logicalSize = opts.logicalSize ?? { width: 0, height: 0 };
    this.dpr = opts.devicePixelRatio ?? 1;
  }

  setSize(logicalWidth: number, logicalHeight: number, dpr = this.dpr): void {
    this.logicalSize = { width: logicalWidth, height: logicalHeight };
    this.dpr = dpr;

    const canvas = this.ctx.canvas;
    if (canvas !== undefined) {
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
    }
  }

  render(): void {
    const root = this.nodes.get(this.document.root);
    if (root === undefined) {
      return;
    }

    const sizes = measureTree(this.document, this.ctx);
    const rootSize = this.rootSize(sizes);

    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.translate(rootSize.width / 2, rootSize.height / 2);
    this.drawRoot(root, rootSize, sizes);
    this.ctx.restore();
  }

  private rootSize(sizes: LayoutMap): Size {
    const measuredRoot = sizes.get(this.document.root) ?? { width: 0, height: 0 };
    return {
      width: this.logicalSize.width > 0 ? this.logicalSize.width : measuredRoot.width,
      height: this.logicalSize.height > 0 ? this.logicalSize.height : measuredRoot.height
    };
  }

  private drawRoot(root: MotionNode, rootSize: Size, sizes: LayoutMap): void {
    if (styleString(root, "backgroundColor") !== undefined || root.fills.length > 0) {
      this.ctx.save();
      this.ctx.translate(-rootSize.width / 2, -rootSize.height / 2);
      this.ctx.globalAlpha *= visibleOpacity(this.runtime.valueFor(root.id, "opacity", 1));
      this.applyNodeEffects(root);
      drawNodeShape(this.ctx, root, rootSize.width, rootSize.height);
      this.ctx.restore();
    }

    for (const child of childSlots(root, sizes, this.nodes, rootSize)) {
      this.drawNode(
        child.node,
        {
          x: -rootSize.width / 2 + child.origin.x,
          y: -rootSize.height / 2 + child.origin.y
        },
        sizes
      );
    }
  }

  private drawNode(node: MotionNode, origin: Point, sizes: LayoutMap): void {
    const size = sizes.get(node.id) ?? { width: 0, height: 0 };

    this.ctx.save();
    this.ctx.translate(origin.x, origin.y);
    this.applyNodeTransform(node, size);
    this.ctx.globalAlpha *= visibleOpacity(this.runtime.valueFor(node.id, "opacity", 1));
    this.applyNodeEffects(node);

    drawNodeShape(this.ctx, node, size.width, size.height);

    for (const child of childSlots(node, sizes, this.nodes)) {
      this.drawNode(child.node, child.origin, sizes);
    }

    this.ctx.restore();
  }

  private applyNodeTransform(node: MotionNode, size: Size): void {
    const offsetX = this.runtime.valueFor(node.id, "offset.x", 0);
    const offsetY = this.runtime.valueFor(node.id, "offset.y", 0);
    const rotation = this.runtime.valueFor(node.id, "rotation", 0) * Math.PI / 180;
    const scale = this.runtime.valueFor(node.id, "scale", 1);
    const scaleX = scale * this.runtime.valueFor(node.id, "scale.x", 1);
    const scaleY = scale * this.runtime.valueFor(node.id, "scale.y", 1);

    this.ctx.translate(size.width / 2 + offsetX, size.height / 2 + offsetY);
    this.ctx.rotate(rotation);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.translate(-size.width / 2, -size.height / 2);
  }

  private applyNodeEffects(node: MotionNode): void {
    const blendMode = resolveBlendMode(node);
    if (blendMode !== "normal") {
      this.ctx.globalCompositeOperation = mapBlendMode(blendMode, node.id);
    }

    const layerBlur = resolveLayerBlur(node);
    if (layerBlur > 0) {
      // Canvas filter and shadow blur compound when both are present; Swift separates
      // them more cleanly, but Phase 5 accepts this Canvas2D approximation.
      applyLayerBlur(this.ctx, layerBlur);
    }
  }
}

interface Point {
  x: number;
  y: number;
}

interface ChildSlot {
  node: MotionNode;
  origin: Point;
}

function childSlots(node: MotionNode, sizes: LayoutMap, nodes: Map<string, MotionNode>, overrideParentSize?: Size): ChildSlot[] {
  const parentSize = overrideParentSize ?? sizes.get(node.id) ?? { width: 0, height: 0 };
  const children = node.children
    .map((childID) => nodes.get(childID))
    .filter((child): child is MotionNode => child !== undefined);

  switch (node.kind) {
    case "vstack": {
      let y = 0;
      return children.map((child) => {
        const size = sizes.get(child.id) ?? { width: 0, height: 0 };
        const slot = { node: child, origin: { x: (parentSize.width - size.width) / 2, y } };
        y += size.height;
        return slot;
      });
    }
    case "hstack": {
      let x = 0;
      return children.map((child) => {
        const size = sizes.get(child.id) ?? { width: 0, height: 0 };
        const slot = { node: child, origin: { x, y: (parentSize.height - size.height) / 2 } };
        x += size.width;
        return slot;
      });
    }
    default:
      return children.map((child) => ({ node: child, origin: { x: 0, y: 0 } }));
  }
}
