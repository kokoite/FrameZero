# FrameZero Studio

FrameZero Studio is the local-first authoring surface for FrameZero motion JSON.

The Studio edits an authoring project, compiles it to the current FrameZero `.motion.json` runtime shape, and later sends that JSON to an iOS simulator preview app. `MotionEngineKit` remains the source of truth for runtime behavior.

## Workspace

```text
apps/studio-web              local browser UI
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

`pnpm dev` starts the local web shell at:

```text
http://127.0.0.1:5173/
```

## Current Foundation

The first fixture demonstrates the important Phase 1 contract: multiple existing UI nodes can share a role and animate in parallel through one transition.

The web shell currently shows:

- scene layers;
- roles;
- an approximate local canvas;
- generated `.motion.json`;
- schema/compiler validation through tests.

The browser preview is not the runtime authority. The iOS simulator preview will be added in the next phase and will validate generated documents through `MotionEngineKit`.
