# Studio Project Contract

## Purpose

The Studio project format preserves authoring intent. It is editor-owned and richer than runtime JSON. It compiles into clean FrameZero `.motion.json`.

The Studio project is the source of truth for editing. The `.motion.json` output is generated.

## Proposed Local File Shape

```text
MyAnimation.framezero/
  project.json
  exports/
    Preview.motion.json
  assets/
```

Phase 1 may also store projects in IndexedDB, but import/export must use this folder shape so projects remain portable and versionable.

## Project State

```ts
type StudioProject = {
  studioVersion: 1
  id: string
  name: string
  rootNodeId: string
  nodes: Record<string, StudioNode>
  roles: Record<string, StudioRole>
  phases: Record<string, StudioPhase>
  phaseOrder: string[]
  triggers: Record<string, StudioTrigger>
  components: Record<string, StudioComponent>
  editor: StudioEditorState
}
```

IDs are stable opaque strings. Ordered relationships use ID arrays.

## Nodes

```ts
type StudioNode = {
  id: string
  name: string
  kind: "zstack" | "vstack" | "hstack" | "text" | "circle" | "roundedRectangle"
  parentId: string | null
  childIds: string[]
  roles: string[]
  layout: Record<string, StudioValue>
  style: Record<string, StudioValue>
  presentation: Record<string, StudioValue>
  locked?: boolean
  hiddenInEditor?: boolean
}
```

Rules:

- `parentId` and `childIds` must agree.
- The node graph must have exactly one root.
- The node graph must have no cycles.
- Roles are stored by name in exported `.motion.json`.
- Editor-only fields never compile into `.motion.json`.

## Roles

```ts
type StudioRole = {
  id: string
  name: string
  description?: string
  color?: string
}
```

Rules:

- Role names must be unique.
- Multiple nodes may share one role.
- Shared roles are intentional and required for parallel multi-component animation.

## Phases

```ts
type StudioPhase = {
  id: string
  name: string
  mode: "absolute" | "deltaFromPrevious"
  startDelay: number
  nextMode: "afterPreviousSettles" | "atTime"
  nextAt: number | null
  targets: StudioTargetAssignment[]
  rules: StudioMotionRule[]
  arcs: StudioArcRule[]
  jiggles: StudioJiggleRule[]
  actions: StudioAction[]
}
```

Phase compilation:

- `absolute` targets become exact state values.
- `deltaFromPrevious` targets are resolved from the previous phase endpoint.
- Each phase compiles into a runtime state.
- Each edge between phases compiles into a runtime transition.
- All target assignments in one phase retarget together.

## Components

In Studio, a component is a reusable authoring template, not the same as `spawnComponents`.

```ts
type StudioComponent = {
  id: string
  name: string
  rootNodeId: string
  nodeIds: string[]
}
```

Compilation expands component instances into normal runtime `nodes`.

## Compilation Contract

Studio compiles `StudioProject` to the existing runtime shape:

```json
{
  "schemaVersion": 1,
  "root": "screen",
  "nodes": [],
  "machines": [],
  "triggers": [],
  "dragBindings": [],
  "bodies": [],
  "forces": []
}
```

Compilation must:

- produce deterministic JSON for the same project state;
- exclude editor-only metadata;
- preserve node ids and role names;
- fail on validation errors instead of producing partial output;
- emit only supported `MotionEngineKit` schemaVersion 1 fields.

## Validation Layers

Editor validation:

- IDs are unique.
- References resolve.
- The node tree is valid.
- Role names are unique.
- Phase order is valid.
- Numeric values are finite.
- Colors are valid where used.

Generated JSON validation:

- Zod schema accepts the generated document.
- No editor-only fields are present.
- Unsupported node kinds, actions, metrics, easing values, and properties are rejected.

Runtime validation:

- Local bridge validates by asking `MotionEngineKit` to load the document.
- iOS preview result is final.

## Non-Goals

- Cloud sync.
- Multiplayer conflict resolution.
- Plugin model.
- Migration beyond `studioVersion: 1`.
- Replacing the runtime `.motion.json` schema.

