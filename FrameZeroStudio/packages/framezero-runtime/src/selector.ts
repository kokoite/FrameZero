import type { MotionDocument, MotionPropertySelector } from "@framezero/schema";

export interface MotionResolvedPropertyKey {
  nodeID: string;
  property: string;
}

export function resolveNodeIDs(selector: Pick<MotionPropertySelector, "id" | "role">, document: MotionDocument): string[] {
  const selectedModes = Number(selector.id !== undefined) + Number(selector.role !== undefined);
  if (selectedModes !== 1) {
    throw new Error("Selector must include exactly one of id or role");
  }

  if (selector.id !== undefined) {
    if (!document.nodes.some((node) => node.id === selector.id)) {
      throw new Error(`Selector references missing node '${selector.id}'`);
    }
    return [selector.id];
  }

  const nodeIDs = document.nodes
    .filter((node) => node.roles.includes(selector.role ?? ""))
    .map((node) => node.id)
    .sort();

  if (nodeIDs.length === 0) {
    throw new Error(`Selector role '${selector.role}' matched no nodes`);
  }

  return nodeIDs;
}

export function resolvePropertyKeys(selector: MotionPropertySelector, document: MotionDocument): MotionResolvedPropertyKey[] {
  if (selector.properties.length === 0) {
    throw new Error("Property selector must include at least one property");
  }

  return resolveNodeIDs(selector, document).flatMap((nodeID) =>
    selector.properties.map((property) => ({
      nodeID,
      property
    }))
  );
}
