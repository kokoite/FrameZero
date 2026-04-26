# Motion JSON Contract

## Scope

This contract defines the current `schemaVersion: 1` runtime document consumed by `MotionEngineKit`.

The web Studio may lint this shape, but `MotionEngineKit` remains the final authority for decoding, validation, physics, transitions, actions, and rendering.

## Document Shape

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

Required top-level fields:

- `schemaVersion`: currently only `1`.
- `root`: root node id.
- `nodes`: renderable scene nodes.
- `machines`: visual state machines.
- `triggers`: named events used by transitions.

Supported top-level fields:

- `dragBindings`: slingshot-style continuous gestures.
- `bodies`: physics body metadata.
- `forces`: gravity, wind, or constant force definitions.

## Nodes

Supported node kinds:

- `zstack`
- `vstack`
- `hstack`
- `text`
- `circle`
- `roundedRectangle`

Node shape:

```json
{
  "id": "card",
  "kind": "roundedRectangle",
  "roles": ["tapTarget", "gesturePart"],
  "layout": {},
  "style": {},
  "presentation": {},
  "children": []
}
```

Supported layout keys:

- `width`
- `height`
- `padding`

Supported style keys:

- `backgroundColor`
- `foregroundColor`
- `cornerRadius`
- `text`
- `font`

Supported animated properties:

- `offset.x`
- `offset.y`
- `rotation`
- `scale`
- `scale.x`
- `scale.y`
- `opacity`

State assignments and animated channel targets must resolve to finite numeric values. String and boolean values are allowed in style/layout where supported, but they are not animated channels.

## Metrics

Metric values may be used where numeric values are accepted:

```json
{ "metric": "safeArea.centerX", "offset": 20 }
```

Supported metric families:

- `screen.*`
- `safeArea.*`

Expected members:

- `width`
- `height`
- `left`
- `right`
- `top`
- `bottom`
- `centerX`
- `centerY`

Metric values may include `multiplier` and `offset`.

## Selectors

Node selectors target nodes by exactly one of `id` or `role`:

```json
{ "id": "card" }
```

```json
{ "role": "gesturePart" }
```

Property selectors add a non-empty `properties` list:

```json
{
  "role": "gesturePart",
  "properties": ["offset.x", "scale"]
}
```

Rules:

- A selector must include exactly one of `id` or `role`.
- `id` resolves to one node.
- `role` resolves to every node carrying that role.
- Every selector must resolve to at least one node.
- Property selectors must include at least one property.

## States And Transitions

State shape:

```json
{
  "id": "active",
  "values": [
    {
      "select": { "id": "card", "properties": ["opacity"] },
      "value": 1
    }
  ]
}
```

Transition shape:

```json
{
  "id": "press",
  "from": "idle",
  "to": "active",
  "trigger": "tapCard",
  "rules": [
    {
      "select": { "role": "gesturePart", "properties": ["offset.x", "scale"] },
      "motion": { "type": "timed", "duration": 0.4, "easing": "linear" }
    }
  ],
  "arcs": [],
  "jiggles": [],
  "enter": [],
  "exit": [],
  "spawns": [],
  "actions": []
}
```

Supported motion types:

- `immediate`
- `timed`
- `spring`

Supported timed easing values:

- `linear`
- `easeIn`
- `easeOut`
- `easeInOut`

## Parallel Existing Components

Roles are the main mechanism for animating several existing UI nodes together.

If multiple nodes share a role, a state assignment or transition rule using that role expands into one channel per matching node and property. All resolved channels retarget during the same transition tick.

Same target for multiple nodes:

```json
{
  "select": {
    "role": "gesturePart",
    "properties": ["offset.x"]
  },
  "value": 64
}
```

Different targets in the same transition:

```json
[
  { "select": { "id": "card", "properties": ["offset.x"] }, "value": 64 },
  { "select": { "id": "icon", "properties": ["offset.y"] }, "value": -24 },
  { "select": { "id": "title", "properties": ["opacity"] }, "value": 1 }
]
```

`spawnComponents` is separate. It creates temporary overlay content. It is not the mechanism for animating existing app UI.

## Actions

Supported transition action types:

- `sequence`
- `parallel`
- `delay`
- `haptic`
- `screenShake`
- `emitParticles`
- `spawnComponents`

Action groups must contain at least one child action.

## Validation Requirements

The runtime must reject invalid documents before installation:

- `schemaVersion` must equal `1`.
- IDs must be unique in their scope.
- `root` must reference an existing node.
- The node graph must be reachable from the root.
- The node graph must have no cycles.
- Child references must resolve.
- Nodes cannot have duplicate parent ownership.
- Machine initial states must exist.
- Transitions must reference existing states and triggers.
- Selectors must be unambiguous and resolve.
- State assignments must resolve to numeric channels.
- Duplicate assignments to the same resolved `node.property` inside one state are invalid.
- Numeric values must be finite.
- Durations and lifetimes must be positive where required.
- Delays and counts must be non-negative where required.
- Supported color keys must use valid 6-digit hex strings.
- Particle and spawned component limits must be enforced.

Current action limits:

- `emitParticles.count <= 128`
- particle/component selector matches `<= 16`
- active particles `<= 512`
- `spawnComponents.components <= 32`
- active components `<= 256`

## Non-Goals

- Arbitrary SwiftUI view registration.
- Arbitrary CSS-like styling.
- Browser-only runtime behavior.
- Free-form scripting in JSON.
- Network-loaded assets.
- Persisting app UI through `spawnComponents`.
- Backward compatibility for undocumented keys.

