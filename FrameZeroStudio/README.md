# FrameZero Studio

FrameZero Studio is the local-first authoring surface for FrameZero motion JSON.

The Studio edits an authoring project, compiles it to the current FrameZero `.motion.json` runtime shape, and later sends that JSON to an iOS simulator preview app. `MotionEngineKit` remains the source of truth for runtime behavior.

## Workspace

```text
apps/studio-web              local browser UI
apps/studio-bridge           local HTTP/WebSocket bridge to iOS Simulator
packages/framezero-schema    TypeScript/Zod mirror of schemaVersion 1
packages/framezero-compiler  StudioProject -> .motion.json compiler
packages/framezero-fixtures  reusable authoring fixtures
```

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

`pnpm dev` starts both local services:

```text
Web Studio:      http://127.0.0.1:5173/
Preview bridge:  http://127.0.0.1:8787/health
Simulator WS:    ws://127.0.0.1:8787/framezero/preview?session=local&client=ios-simulator&protocol=1
```

You can also run them separately:

```bash
pnpm dev:web
pnpm dev:bridge
```

## Current Foundation

The Studio now supports the local authoring loop:

- add `circle`, `roundedRectangle`, and `text` components;
- edit component size, color, text, origin, and role;
- target either a selected component or every component sharing a role;
- edit phase targets for x, y, scale, rotation, opacity;
- choose spring, timed, or immediate motion behavior;
- add arc, jiggle, particles, spawned temporary components, screen shake, and haptics;
- persist the Studio project in local storage;
- export generated `.motion.json`;
- send the generated JSON to the iOS simulator through the local bridge.

The browser canvas is still advisory. The iOS simulator remains the runtime authority because it loads generated documents through `MotionEngineKit`.

## Preview Loop

1. Start the bridge and web app with `pnpm dev`.
2. Run the iOS sample app in the simulator.
3. Create or edit components and phases in the browser.
4. Press **Send to Simulator**.
5. The bridge validates the document, broadcasts it to the simulator, and shows whether the simulator accepted it.
