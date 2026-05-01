import type { StudioProject, StudioNode } from "@framezero/compiler";

export function findComponentInstanceRoot(project: StudioProject, nodeId: string): string | null {
  const node = project.nodes[nodeId];
  if (!node || !node.componentId) return null;
  let current: StudioNode = node;
  while (current.parentId) {
    const parent = project.nodes[current.parentId];
    if (!parent || parent.componentId !== current.componentId) break;
    current = parent;
  }
  return current.id;
}

export function isDescendantOf(project: StudioProject, nodeId: string, ancestorId: string): boolean {
  if (nodeId === ancestorId) return false;
  let current: StudioNode | undefined = project.nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = project.nodes[current.parentId];
  }
  return false;
}
