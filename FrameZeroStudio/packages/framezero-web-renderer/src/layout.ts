import type { MotionDocument, MotionNode, MotionValue } from "@framezero/schema";

export interface Size {
  width: number;
  height: number;
}

export type LayoutMap = Map<string, Size>;

function numericValue(value: MotionValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function layoutNumber(node: MotionNode, key: string): number | undefined {
  return numericValue(node.layout[key]);
}

export function styleNumber(node: MotionNode, key: string): number | undefined {
  return numericValue(node.style[key]);
}

export function styleString(node: MotionNode, key: string): string | undefined {
  const value = node.style[key];
  return typeof value === "string" ? value : undefined;
}

export function nodeMap(document: MotionDocument): Map<string, MotionNode> {
  return new Map(document.nodes.map((node) => [node.id, node]));
}

export function measureTree(
  document: MotionDocument,
  ctx?: Pick<CanvasRenderingContext2D, "font" | "measureText">
): LayoutMap {
  const nodes = nodeMap(document);
  const sizes: LayoutMap = new Map();

  function measure(nodeID: string): Size {
    const cached = sizes.get(nodeID);
    if (cached !== undefined) {
      return cached;
    }

    const node = nodes.get(nodeID);
    if (node === undefined) {
      const missing = { width: 0, height: 0 };
      sizes.set(nodeID, missing);
      return missing;
    }

    const explicitWidth = layoutNumber(node, "width");
    const explicitHeight = layoutNumber(node, "height");
    const childSizes = node.children.map(measure);
    const intrinsic = intrinsicSize(node, childSizes, ctx);
    const size = {
      width: explicitWidth ?? intrinsic.width,
      height: explicitHeight ?? intrinsic.height
    };
    sizes.set(nodeID, size);
    return size;
  }

  measure(document.root);
  return sizes;
}

function intrinsicSize(
  node: MotionNode,
  childSizes: Size[],
  ctx: Pick<CanvasRenderingContext2D, "font" | "measureText"> | undefined
): Size {
  switch (node.kind) {
    case "zstack":
      return {
        width: Math.max(0, ...childSizes.map((size) => size.width)),
        height: Math.max(0, ...childSizes.map((size) => size.height))
      };
    case "vstack":
      return {
        width: Math.max(0, ...childSizes.map((size) => size.width)),
        height: childSizes.reduce((sum, size) => sum + size.height, 0)
      };
    case "hstack":
      return {
        width: childSizes.reduce((sum, size) => sum + size.width, 0),
        height: Math.max(0, ...childSizes.map((size) => size.height))
      };
    case "text":
      return measureTextNode(node, ctx);
    case "circle":
    case "roundedRectangle":
    case "image":
    case "path":
    case "polygon":
    case "star":
    case "line":
      return { width: 0, height: 0 };
  }
}

function measureTextNode(
  node: MotionNode,
  ctx: Pick<CanvasRenderingContext2D, "font" | "measureText"> | undefined
): Size {
  const fontSize = fontSizeFor(styleString(node, "font"));
  if (ctx === undefined) {
    return { width: 0, height: fontSize * 1.2 };
  }

  ctx.font = mapFont(styleString(node, "font"));
  return {
    width: ctx.measureText(styleString(node, "text") ?? "").width,
    height: fontSize * 1.2
  };
}

export function mapFont(font: string | undefined): string {
  return font === "title" ? "bold 28px system-ui" : "17px system-ui";
}

function fontSizeFor(font: string | undefined): number {
  return font === "title" ? 28 : 17;
}
