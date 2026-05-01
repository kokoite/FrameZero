# FrameZero — Active Backlog

Single-source-of-truth for what's queued. Update status as items move through the pipeline. Dispatch in parallel against any items whose `dependsOn` is empty or shipped.

## Status taxonomy

- `queued` — not started, no design yet
- `design` — Researcher in flight OR design memo at `.claude/queued-coder-briefs/<slug>.md`
- `impl` — Codex Coder in flight on a `task/<slug>` branch
- `review` — Teammate post-impl review in flight
- `shipped` — merged to main and pushed to origin

## Priority

- `P0` — blocks the web renderer reaching feature-complete v1 (must finish before users can replace the iOS simulator with the browser for canonical fixtures)
- `P1` — high-leverage polish that materially improves authoring or fidelity
- `P2` — nice-to-have, can wait until a fresh consumer-panel pitch

## Pipeline

| ID | Status | P | Item | Depends on | Notes |
|----|--------|---|------|------------|-------|
| 7b | shipped | P0 | Web renderer Phase 7b — drag bindings (slingshot interaction layer) | — | `8d14d0c` Snap-back only; projectile flight is 7c. handleDragChanged + handleDragEnded with pull-clamp + charge feedback + 5-channel snap-back springs. 16 runtime tests (was 9, +7 drag). |
| 7c-triggers | shipped | P0 | Web renderer Phase 7c-triggers — automatic + after trigger dispatch | 7b | `cfaa29c` Researcher solved the gating mystery: Swift's applyState doesn't mutate currentStates; only fire(triggerID:) does. TS applyState was incorrectly mutating it. Fix: dispatchTrigger() is sole owner of currentStates mutation; applyState is a dumb channel-target-applier. Phase 2 parity trace still green. 21 runtime tests (was 16, +5). |
| 7c-projectile | shipped | P0 | Web renderer Phase 7c-projectile — projectile flight physics | 7b, 7c-triggers | `a9535de` ActiveProjectile + tickProjectiles + handleDragEnded launch decision + releaseDragShape on both branches. Researcher pre-pass solved the integration ordering and the "releaseDragShape on both branches" trap. 30 runtime tests (was 21, +9 projectile incl. Swift parity trace). |
| 8 | queued | P0 | Web renderer Phase 8 — Studio editor cutover behind a flag | 7b, 7c-triggers, 7c-projectile | Replace `apps/studio-web/src/main.tsx` advisory canvas with `MotionCanvasRenderer`. Feature-flag (env var or query param) so advisory canvas stays available for one release. **Last P0 chain blocker.** |
| demo-bug | design | P1 | Fix polygon/star positioning in `web-renderer-demo.ts` gallery | — | Diagnosis (2026-05-01): `childSlots` default (zstack) returns origin (0,0) at parent top-left; SwiftUI `ZStack` centers. Cards' offsets are applied to a top-left baseline instead of a centered baseline, so the gallery row drifts. Fix candidate: zstack origin = ((parentW-childW)/2, (parentH-childH)/2). RISK: Phase1Card uses metric-resolved `safeArea.centerX` offsets that may have been authored against the current top-left semantics; flipping default could shift its visual position (channel-value parity test would still pass — it compares values, not pixels). Researcher pass needed to confirm Swift `MotionRenderer.swift` zstack semantics before pushing. |
| 5b | queued | P1 | Web renderer Phase 5b — particles, components, screenShake, MotionEffectsOverlay | — | Channel-overlay constructs Swift adds on top of channels. Independent of phase 7 chain. |
| pixel-parity | queued | P1 | Pixel-parity harness | — | Headless Playwright screenshots vs `xcodebuild` simulator screenshots for canonical fixtures. Catches gradient endpoint divergence, plusDarker approximation, ctx.filter+shadow compounding, etc. |
| compositing-group | queued | P1 | True `compositingGroup()` via offscreen canvas | — | Per-node save/restore approximates but diverges on cross-child blending. Offscreen pre-render fixes. |
| plus-darker | queued | P1 | plusDarker correct compositing | compositing-group | Currently maps to `multiply` + warn-once. Correct via offscreen pre-multiplication. |
| editor-panels | queued | P1 | Studio editor UI for typed fields shipped this session | 8 | reduceMotionPolicy toggle, motionSensitivity per-rule, stagger slider, stroke options panel, polygon/star authoring, line endpoint dragging, blendMode picker (18), cornerRadii inputs, typed cornerRadius shortcut, shadow inset toggle, layerBlur slider. Each is a small commit; can ship in parallel after 8 lands. |
| particle-allowlist | queued | P1 | Type particle/component spec style allowlists | — | `MotionParticleSpec` / `MotionComponentSpec` still use untyped `style: Record<>` for blendMode/cornerRadius/shadow. Researcher flagged this as out-of-scope for #5; needs a separate pass. |
| svg-scinot | queued | P2 | Fix SVG path scientific-notation tokenization | — | `1.5e2` splits in both Swift and TS tokenizers. Cross-platform fix in both runtimes. |
| svg-relative | queued | P2 | Implement true relative SVG path commands | svg-scinot | Lowercase `m/l/c/q` currently treated as absolute (matches Swift bug). Fix both runtimes. |
| svg-coverage | queued | P2 | Expand SVG command coverage: H, V, S, T, A | svg-relative | Each needs running-state in the parser (last command's control point for S/T, arc-to-bezier for A). |
| bridge-ws-tests | queued | P2 | Bridge ws-level integration tests (B0.4 follow-up) | — | `studio-bridge/src/server.ts` auto-binds dev port; refactor to factory accepting ephemeral ports, then add handshake test cases I deferred when shipping B0.4. |
| figma-mask | queued | P2 | Mask (alpha/luminance) support | — | Needs fresh consumer-panel pitch. |
| figma-bgblur | queued | P2 | Background blur (`.ultraThinMaterial`) | — | Needs pitch. |
| figma-autolayout | queued | P2 | Auto-layout extras (spacing, alignItems, justifyContent, per-side padding) | — | Needs pitch. |
| figma-image-fit | queued | P2 | Image fit modes (cover/contain/fill/tile) | — | Image kind currently warn-only; needs HTMLImageElement loading + caching too. |
| figma-multifill-stroke | queued | P2 | Per-fill stroke + multiple fills with blend | — | Schema + renderer expansion. |
| figma-bool-ops | queued | P2 | Boolean ops (compile-time bake to path) | — | Compiler work; runtime ships path. |
| figma-component | queued | P2 | Component/instance as typed node kind | — | Overlaps existing `spawnComponents` action; needs contract amendment first. |
| ota | queued | P2 | OTA distribution stream | — | Schema-versioned signed `.motion.json` fetch + cache layer. Original consumer-panel-approved item, untouched. Needs full pitch + decomposition. |
| repo-cleanup | queued | P2 | `.gitignore` the loose screenshots/scripts/MP4s in repo root | — | ~30 untracked files pollute `git status`. Two commits this session accidentally swept some in (per `feedback_no_broad_git_add.md` lesson). Should be moved to a scratch dir or ignored. |

## Conventions

- A single P0 chain blocks v1: **7b → 7c → 8**. Don't reorder.
- P1 items are independent and can run in parallel with the P0 chain (the demo-bug fix, 5b, pixel-parity harness, compositing-group, editor-panels-design, particle-allowlist).
- P2 items are independent of each other (and of P0/P1) unless `dependsOn` says otherwise.
- When dispatching: prefer 1 P0 + N P1 in parallel rather than N P0 (P0 chain is sequential).
- Update `Status` and add a one-line note when an item moves. Record the commit hash on `shipped`.
- New items: append at the bottom with a fresh ID, depends-on, and a one-paragraph problem statement. If a Researcher pre-pass exists, link the design memo at `.claude/queued-coder-briefs/<id>.md`.

## Shipped this session (for context)

`b3d9375` stroke options · `b7e02d0` per-corner radii · `2534e08` polygon+star · `0f15b5e` line · `3442113` typed shadow+layerBlur · `880882d` typed blendMode · `b7c5a7f` typed cornerRadius shortcut · `e91d22b` inner shadow · `c363b1c` web-renderer Phase 1 · `07977cb` Phase 2 · `42a8ab1` Phase 3 · `d05a40e` Phase 4 · `08cbf29` Phase 5 · `3b65857` Phase 6 · `42dfaab` Phase 6b · `59aea42` Phase 7a · `06c2295` web-renderer demo · plus the earlier reduced-motion / cubic-bezier / stagger / channel inspector / B0.x merges. Total: 32 commits, 438 unit tests.
