# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ Operating model — read this BEFORE any action

**This repo follows the locked Bipartite Orchestration Contract.**

**Mandatory reads at session start (in this order):**
1. [`Documentation/Contracts/ORCHESTRATION.md`](Documentation/Contracts/ORCHESTRATION.md) — bipartite parity rule, locked global rules, harness constraints, failure modes, agent graph.
2. [`Documentation/Contracts/roles/`](Documentation/Contracts/roles/) — one file per role. Read the role file for any agent before spawning or instructing it.

**Non-negotiable rules** (full detail in the contract):
- **Bipartite parity**: every parent–child agent edge crosses parity (Claude ↔ Codex). Anchors: top-level Orchestrator = Claude; Coder = Codex.
- **Whipper rule**: Code Lead pings the team every 1/2/5 min by scope. Silence > 4 min always escalates to PM.
- **Pool ceiling**: max 5 PMs + 5 Leads in flight; queue above.
- **PM/Lead per stream; Teammate + Coder per commit (fresh).**
- **Codex never runs git** (sandbox blocks `.git/`). Orchestrator handles branch + commit.
- **Codex never runs `pnpm test`** raw (chains a localhost gate). Use explicit `vitest run`.
- **Orchestrator's only goal: answer the user at any time, instantly.** Never tool-stuck.

**If you (the AI agent reading this) cannot follow the contract**, stop and tell the user. Do not silently drift. Do not improvise an alternative. The contract exists because drift is what produced past failure modes (Codex silent runs of 20+ min, missed post-impl reviews, idle agents).

---

## Repository Shape

This repo is two products that share one motion contract:

1. **`MotionEngineKit`** (Swift Package, `MotionEngineKit/`) — the iOS/macOS runtime that decodes, validates, and simulates `schemaVersion: 1` `.motion.json` documents. SwiftUI renders simulated values; the runtime owns motion.
2. **`AnimationEngine.xcodeproj`** + **`AnimationEngine/`** — the sample iOS app and authoring playground that consumes `MotionEngineKit` and is also the iOS preview target for FrameZero Studio.
3. **`FrameZeroStudio/`** — a local-first pnpm workspace (TypeScript/React) that authors a `StudioProject`, compiles it to `.motion.json` matching the runtime schema, and streams it to the iOS simulator over a local bridge.

The non-negotiable rule: `MotionEngineKit` is the source of truth for runtime semantics. The Studio's TypeScript schema and compiler must mirror it; the iOS simulator is the authority for preview correctness. There is no second animation runtime in the browser — the canvas is advisory.

## Common Commands

### Swift runtime (`MotionEngineKit/`)
```bash
cd MotionEngineKit
swift build
swift test                                              # all tests
swift test --filter MotionRenderPolicyTests             # single test class
swift test --filter MotionRenderPolicyTests/testName    # single test
```
Open `AnimationEngine.xcodeproj` in Xcode to run the sample app on a simulator. `xcodebuild` MCP tools are preferred over raw `xcodebuild` for simulator workflows (run `session_show_defaults` once per session before the first build/run/test).

### FrameZero Studio (`FrameZeroStudio/`, pnpm workspace)
```bash
cd FrameZeroStudio
pnpm install
pnpm dev               # web on 127.0.0.1:5173, bridge on 127.0.0.1:8787
pnpm dev:web           # web only
pnpm dev:bridge        # bridge only (WebSocket: ws://127.0.0.1:8787/framezero/preview)
pnpm test              # vitest across all packages + studio-web visual checks
pnpm typecheck
pnpm build
pnpm --filter @framezero/studio-web test                # one package only
```
Visual diff scripts live in `apps/studio-web/scripts/` and are invoked from `studio-web`'s `test` script — they require `playwright install chromium` and the Python deps in `requirements-visual.txt`.

CI mirrors these: `.github/workflows/swift.yml` runs `swift build/test` in `MotionEngineKit` and `pnpm test/build` in `FrameZeroStudio`.

## Architecture (read `ARCHITECTURE.md` for the full version)

The runtime models UI as **a continuously simulated world**, not a sequence of frames. Three invariants follow:

1. State is the source of truth for rest configurations.
2. Properties are continuously solved toward targets — animations are never "started" or "stopped."
3. Interruption preserves both current value and velocity. Retargeting must not zero velocity unless the rule says so.

### Runtime layer order (MotionEngineKit/Sources/MotionEngineKit/)

- **Schema** (`MotionSchema.swift`): closed-enum, declarative `schemaVersion: 1` document — `nodes`, `machines`, `triggers`, `dragBindings`, `bodies`, `forces`. Author selectors (id/role/properties) compile down to concrete `(nodeID, AnimatableProperty)` channel keys before simulation.
- **Validation/compile**: rejects ambiguous documents, expands aliases (e.g. uniform `scale` → `scale.x`/`scale.y`), and produces resolved channels. Vector-like values are stored as scalar channels at runtime.
- **Physics** (`MotionEngine.swift`): pure Swift, SwiftUI-independent. Each channel owns `current`, `velocity`, `target`, `rule`. Primitives: `spring`, `decay`, `tween`, `immediate`, `passthrough`, `body`, `force`. Integrate with semi-implicit Euler, clamp `dt` to ~32 ms, guard NaN/inf, deterministic stepping for tests.
- **Runtime state**: tracks current machine state, in-flight transition, entering/exiting/spawned nodes, gesture overrides. Spawned pseudo-elements (ripples, particles) get synthetic IDs `transitionID.spawnID.sequence` so repeat triggers don't collide.
- **SwiftUI bridge** (`MotionRenderer.swift`, `MotionRenderStyle.swift`, `MotionHostView.swift`): two-layer model — a layout skeleton measures rest frames; the visible layer applies presentation transforms (`.offset`, `.scaleEffect`, `.rotationEffect`, `.opacity`) without SwiftUI `.animation()`. Two integration modes: JSON-owned (`MotionRuntimeView`) and host-owned (`.motionDriven(by:nodeID:frame:useJSONLayout:)`). Effects render through `MotionEffectsOverlay`.
- **Display driver** (`DisplayLinkTicker.swift`): `CADisplayLink` with explicit timestamps so pause/resume/interruption preserve velocity.
- **Input**: discrete `triggers` request state changes; transitions match exactly one `(trigger, from)` pair. Drag bindings temporarily override channels via `passthrough` and hand velocity back on release. Each binding declares `absolute` vs `relativeToGestureStart` and which platform velocity source maps to which channel.

### FrameZero Studio data flow

```
StudioProject (editor-only) ──compile──▶ .motion.json (schemaVersion: 1)
                                            │
                                            ▼
                          studio-bridge (HTTP + WebSocket on :8787)
                                            │
                                            ▼
                                iOS simulator app (MotionEngineKit)
```

- `packages/framezero-schema` — Zod mirror of schemaVersion 1.
- `packages/framezero-compiler` — `StudioProject` → `.motion.json`. Exported JSON must contain **no editor-only metadata**.
- `packages/framezero-fixtures` — shared authoring fixtures used by tests.
- `apps/studio-web` — React/Vite editor (single-bundle: `src/main.tsx`, `src/styles.css`).
- `apps/studio-bridge` — `tsx` HTTP+WS server. Validates documents, broadcasts to simulator, surfaces apply/reject feedback to the editor.

The bridge **must not** clear the simulator's last valid preview when an invalid document arrives — surface the error, keep the previous frame.

## Operating Rules

These come from `AGENTS.md`, `Documentation/FIGMA_NATIVE_LAYER_WORKFLOW.md`, and `Documentation/Contracts/`. They override generic defaults.

- **Figma → FrameZero recreation is native-primitive only.** Do not use SVG, PNG, image export, screenshot, or composite asset fallback unless the user explicitly approves a fallback for the exact layer. If a Figma layer cannot be reproduced natively, stop and identify the missing primitive — improve the primitive instead of baking the layer as an asset. Recreate one Figma layer at a time and isolate-render before composing. See `Documentation/FIGMA_NATIVE_LAYER_WORKFLOW.md`.
- **Contracts before code.** `Documentation/Contracts/` is the Phase 0 lock (product workflow, motion JSON, studio project, preview protocol, multi-agent process, phase plan). Public-contract changes need an amendment before implementation continues — no silent drift. Exported `.motion.json` must have no editor-only fields.
- **Branch model** (`Documentation/Contracts/AGENT_PROCESS.md`): `main` ← `phase/<name>` ← `task/<name>` ← `child/<task>-<slice>`. Children merge only into their parent task; tasks only into the phase; phases only into main.
- **Completion bar.** A task is not done without: branch + commit ref, contract link, build result, test result, simulator/browser evidence when behavior changed, and independent review. "Looks fine" is not evidence.

## Sample fixtures

Canonical `.motion.json` documents live in `Examples/` and `AnimationEngine/Resources/`:
- `Examples/Phase1Card.motion.json` — first implementation fixture (schema validation, scalar channels, single state machine, tap, spring).
- `Examples/ReactiveCard.motion.json` — end-to-end target (presence, drag velocity handoff, pseudo-element spawn).
- `Examples/ParallelComponents.motion.json` — role-selector parallel choreography.
