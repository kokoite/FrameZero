# AnimationEngine Architecture

## Product Thesis

AnimationEngine is a SwiftUI-rendered SDUI runtime where motion is modeled as a continuously simulated physical world.

The author describes:

- stable element identity and structure
- named visual states
- directional transitions between states
- physics rules for properties
- triggers and gesture bindings
- transition-owned temporary elements

The runtime owns motion. SwiftUI renders current simulated values.

## Core Mental Model

The UI is not a sequence of frames. It is a world that is always being simulated. State changes move the targets the world is solving toward. Motion is what happens between the current values and the targets.

This gives the engine three hard rules:

1. State is the source of truth for rest configurations.
2. Animation is not started and stopped. Properties are continuously solved toward targets.
3. Interruption must preserve current value and velocity.

## Non-Goals For The First Runtime Spike

The first spike should prove the core engine, not the full creative surface.

Do not start with:

- arbitrary expression evaluation
- open-ended Swift callbacks from JSON
- a broad component registry
- a visual editor
- a full constraint solver
- collision physics
- remote streaming protocol
- automatic structural identity matching
- SwiftUI `.animation()` as the primary motion system

These can be added only after the runtime proves stable identity, bounded layout measurement, and velocity-preserving transitions.

## Runtime Layers

### 1. Schema Layer

The schema is declarative, versioned, and finite. It should be safe to decode and validate before execution.

Top-level concepts:

- `nodes`: SDUI element descriptions
- `machines`: state machines with visual states and directional transitions
- `triggers`: discrete events that request state changes
- `dragBindings`: continuous gesture mappings into simulation channels
- `bodies`: physical body definitions attached to nodes by selector
- `forces`: continuous accelerations or force-like influences applied globally or by selector

Important schema rule: author-friendly selectors compile into concrete `nodeID + property` channels before the simulation runs.

Node fields should keep layout, style, and presentation concerns separate:

- `layout`: participates in SwiftUI rest layout measurement
- `style`: stable rendering inputs that do not represent animated channel state
- `presentation`: initial/default channel values applied by the simulation layer

The skeleton layout must read `layout` and structural children only. It must not measure transformed `presentation` values.

### 2. Validation And Compilation Layer

Validation builds runtime indexes and rejects ambiguous documents before rendering.

Required validation:

- every node ID is unique
- every machine ID, state ID, transition ID, trigger ID, and drag binding ID is unique within its scope
- every child reference resolves
- the root node resolves
- every machine has a valid initial state
- every transition references valid `from` and `to` states
- every trigger references valid selectors and machines
- every selector resolves to at least one node
- selected properties are supported by the selected node kinds
- duplicate state assignments for the same channel are rejected
- transition rule conflicts are resolved by specificity or rejected
- numeric values are finite
- spring parameters are positive and finite
- opacity values are in `0...1`
- colors parse before rendering
- clamps have `min <= max`
- lifetimes are positive
- gesture sources are from a finite supported set
- role selectors are allowed to resolve to multiple nodes only for fields that explicitly accept multi-target selectors

The compiler produces resolved channels:

```swift
struct ResolvedPropertyKey: Hashable {
    let nodeID: NodeID
    let property: AnimatableProperty
}
```

### 3. Physics Layer

The physics layer is pure Swift and independent of SwiftUI.

Each animatable property owns:

```swift
struct PropertyState {
    var current: Double
    var velocity: Double
    var target: Double
    var rule: MotionRule
}
```

For vector-like values, use multiple scalar channels first:

- `offset.x`
- `offset.y`
- `scale.x`
- `scale.y`

The schema may also expose `scale` as a uniform-scale alias. The compiler expands it into `scale.x` and `scale.y` channels. Runtime channels stay scalar.

Initial primitives:

- `spring`: settle toward a target using stiffness, damping, and mass or response/dampingFraction
- `decay`: continue with velocity and exponential slowdown
- `tween`: non-physical interpolation for opacity-like values
- `immediate`: snap to target
- `passthrough`: direct gesture binding while input is active
- `body`: simulated object with mass, radius, drag, restitution, friction, stop speed, and collision bounds
- `force`: continuous gravity, wind, or constant vector influence applied to matching bodies

Later primitives:

- `constraint`: post-integration modifier that clamps or relates channels

Current body JSON shape:

```json
{
  "bodies": [
    {
      "id": "sourceOrbBody",
      "selector": { "role": "source" },
      "radius": 30,
      "mass": 1,
      "airResistance": 0.55,
      "restitution": 0.78,
      "friction": 0.86,
      "stopSpeed": 58,
      "collision": "screenBounds"
    }
  ],
  "forces": [
    {
      "id": "worldGravity",
      "type": "gravity",
      "y": 980
    }
  ]
}
```

Supported collision modes:

- `none`
- `screenBounds`
- `safeAreaBounds`

Supported force types:

- `gravity`: acceleration, not divided by mass
- `wind`: force-like vector divided by body mass
- `constant`: force-like vector divided by body mass

The first implementation wires bodies and forces into slingshot projectiles. The next step is making bodies independently active in states, then allowing transitions/effects to spawn temporary bodies.

Integration rules:

- clamp frame delta to approximately 32ms
- use semi-implicit Euler for the first spring implementation
- guard against `NaN` and infinite values
- expose deterministic stepping for tests
- never reset velocity on retarget unless the rule explicitly asks for it

### 4. Runtime State Layer

The runtime owns the live physical world.

It tracks:

- current state for each state machine
- active transition, if any
- resolved targets for every channel
- property state for every live channel
- entering nodes
- exiting nodes
- spawned transition-owned nodes
- active gesture overrides

Node lifecycle:

```swift
enum RuntimeNodePhase {
    case entering
    case stable
    case exiting
    case spawned
}
```

Matched nodes keep their property states. New nodes initialize from enter rules or defaults. Removed nodes move to the exiting layer and remain renderable until their exit rules settle or timeout.

Presence lifecycle contract:

- inactive nodes do not participate in skeleton layout
- inactive nodes do not render in the stable layer
- inactive nodes may be referenced by future-state targets and enter rules
- inactive nodes should not receive current-state assignments unless the assignment is explicitly marked as an enter or exit value
- entering nodes are inserted into the target skeleton for the destination state, initialized from transition `enter.from`, then simulated toward destination targets
- exiting nodes keep their last resolved content and measured frame, then simulate toward transition `exit.to` until despawn

### 5. SwiftUI Layout Bridge

SwiftUI should compute base/rest layout. The runtime should not mutate structural layout every frame.

The first bridge should use a two-layer model:

1. A layout skeleton renders the current target tree and measures rest frames.
2. The visible layer renders from simulated presentation values.

The measured rest frames become targets for layout-derived channels. Presentation transforms apply through plain SwiftUI modifiers such as:

- `.offset(x:y:)`
- `.scaleEffect(_:)`
- `.rotationEffect(_:)`
- `.opacity(_:)`

Do not wrap these modifiers in SwiftUI `.animation()`.

The renderer has two integration modes:

1. JSON-owned views: `MotionRuntimeView` renders nodes from the document.
2. Host-owned views: a normal SwiftUI view opts into runtime motion with:

```swift
Circle()
    .fill(.cyan)
    .frame(width: 60, height: 60)
    .motionDriven(
        by: engine,
        nodeID: "sourceShape",
        frame: frame,
        useJSONLayout: false
    )
```

For host-owned views, the JSON still defines the node ID, presentation channels, triggers, gestures, bodies, and forces. SwiftUI owns the visual content. The runtime owns transform, opacity, tap forwarding, drag forwarding, and physics state.

Host-owned screens that need trajectory dots, slingshot glow, particles, or future pseudo-elements should also render:

```swift
MotionEffectsOverlay(engine: engine, frame: frame)
```

This keeps effects shared between JSON-rendered and host-rendered content.

### 6. Display Driver

Use `CADisplayLink` for the runtime driver.

Reasons:

- explicit timestamps
- predictable pause/resume behavior
- velocity-preserving interruptions
- direct control over `dt` clamping
- easier instrumentation for dropped frames and per-stage timings

### 7. Input Bridge

Discrete triggers request state changes.

Trigger ownership rule:

- top-level `triggers` describe host events and where they originate
- transitions describe which event can move a machine from `from` to `to`
- when an event fires, the runtime selects exactly one transition whose `trigger` matches the event and whose `from` matches the machine's current state
- if zero transitions match, the event is ignored
- if multiple transitions match, validation fails
- triggers must not also contain independent `to` or `toggle` state changes in the first schema

Continuous gesture bindings temporarily override selected channels using `passthrough`. On gesture end, the runtime releases the override and transfers gesture velocity into the normal physics rule.

This is the core interaction invariant:

> A drag is not an animation. It is a temporary external constraint on channels. When released, the channels continue from the current value and velocity.

Drag binding updates need an explicit write mode:

- `absolute`: source value replaces the channel value
- `relativeToGestureStart`: source value is added to the channel value captured when the gesture began

Release velocity must also be explicit. The bridge can derive a finite `velocity.x` or `velocity.y` source from platform gesture data, but the schema must say which velocity source maps into which channel.

### 8. Pseudo-Elements

Pseudo-elements are runtime nodes owned by a transition, not a visual state.

They are used for:

- ripples
- particles
- ghost trails
- glows
- temporary overlays

They should enter the same simulation pipeline as normal nodes:

- stable synthetic identity
- initial property state
- physics rules
- lifecycle/despawn rule

Spawn identity rule:

- the author-provided spawn ID names the spawn definition, not the runtime instance
- each runtime instance receives a synthetic ID such as `transitionID.spawnID.sequence`
- repeated triggers can therefore create multiple simultaneous instances without ID collision

Spawn render contract:

- every spawn must define a layer, coordinate space, z-index, node kind, layout, and style
- `from` and `to` dictionaries compile into concrete presentation channels for the synthetic runtime node

## Schema Direction

The first schema should be boring and explicit. It should look more like editor output than hand-written shorthand.

Recommended first shape:

```json
{
  "schemaVersion": 1,
  "root": "screen",
  "nodes": [],
  "machines": [],
  "triggers": [],
  "dragBindings": []
}
```

The schema should prefer closed enums over arbitrary dictionaries:

- node kinds are finite
- properties are finite
- gesture sources are finite
- motion specs are finite
- selectors are finite

This keeps the first runtime testable and safe.

## First Demo

The first demo should be a transition laboratory, not a full app.

There are two fixtures:

1. `Examples/Phase1Card.motion.json`: the first implementation fixture. It exercises schema validation, scalar channels, a state machine, a tap trigger, and a spring transition.
2. `Examples/ReactiveCard.motion.json`: the end-to-end target fixture. It adds presence, drag velocity handoff, and a spawned pseudo-element.

The end-to-end fixture must include:

- one root screen
- one card-like element
- two visual states: `collapsed` and `expanded`
- a directional tap transition
- a drag binding that writes into the same channel as the tap transition
- one entering child
- one pseudo-element spawn
- spring motion with visible interruption behavior

The demo should prove:

- state changes retarget property channels
- current velocity survives retargeting
- drag release hands velocity into the spring
- entering nodes do not blink
- spawned nodes render and despawn
- SwiftUI layout measurement does not loop unboundedly

## Implementation Phases

### Phase 1: Pure Runtime

Build without SwiftUI first:

- schema models
- validation
- selector resolution
- scalar property channels
- spring stepping
- state-machine retargeting
- deterministic unit tests

Exit criteria:

- a JSON document decodes and validates
- `Examples/Phase1Card.motion.json` compiles into concrete channels
- a transition changes targets
- scalar channels settle deterministically
- interruption preserves velocity

### Phase 2: Minimal SwiftUI Renderer

Add a small renderer:

- `zstack`
- `vstack`
- `hstack`
- `text`
- `roundedRectangle`
- `button`
- `circle`

Exit criteria:

- demo JSON renders
- tap transition works
- runtime uses `CADisplayLink`
- no SwiftUI implicit animation is required

### Phase 3: Layout Measurement

Add rest-frame measurement and layout-derived targets.

Exit criteria:

- measured frames are diffed before applying
- geometry updates converge within a bounded number of passes
- presentation transforms do not cause structural layout churn

### Phase 4: Gesture And Pseudo-Elements

Add drag bindings and spawned nodes.

Exit criteria:

- dragging a live node directly controls channels
- gesture velocity is transferred on release
- pseudo-elements spawn, simulate, and despawn

### Phase 5: Live Editing

Add local document reload.

Exit criteria:

- changing the JSON updates targets and rules
- in-flight motion continues where possible
- invalid JSON fails safely with diagnostics

## Review Gates

Every implementation phase needs review before expanding surface area.

Review checklist:

- Does this preserve velocity on retarget?
- Does this avoid SwiftUI layout feedback loops?
- Are schema failures validated before rendering?
- Are runtime channels deterministic and testable?
- Does any per-frame path allocate unnecessarily?
- Does any JSON field create executable or unbounded behavior?
- Are entering, exiting, and spawned nodes handled by the same runtime model?

## Long-Term Direction

After the first runtime is proven, add expressiveness in this order:

1. richer selectors
2. more node kinds
3. force fields
4. basic constraints
5. overlay/lifted elements
6. transition inspector
7. local live editor
8. visual editor
9. safe expression language, only if concrete use cases demand it
