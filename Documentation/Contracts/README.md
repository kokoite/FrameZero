# FrameZero Studio Contracts

These contracts are the Phase 0 lock for FrameZero Studio.

FrameZero Studio is local-first. The web editor owns authoring ergonomics, `MotionEngineKit` owns runtime semantics, and the iOS simulator is the source of truth for preview.

## Contracts

- [Product Workflow](PRODUCT_WORKFLOW.md): designer and developer workflow, local-first constraints, and MVP acceptance.
- [Motion JSON](MOTION_JSON.md): current `schemaVersion: 1` runtime document supported by `MotionEngineKit`.
- [Studio Project](STUDIO_PROJECT.md): editor-only project format that compiles to clean `.motion.json`.
- [Preview Protocol](PREVIEW_PROTOCOL.md): local WebSocket protocol between Studio and the iOS preview app.
- [Agent Process](AGENT_PROCESS.md): lead, child, reviewer, branch, and merge rules for parallel work.
- [Phase Plan](PHASE_PLAN.md): implementation phases and task ownership model.

## Non-Negotiables

- No cloud dependency before the local authoring loop is strong.
- No second animation runtime in the browser.
- No editor-only metadata in exported `.motion.json`.
- No merge without contract, verification, and independent review.
- No completion claim without test or simulator evidence appropriate to the change.

