# FrameZero Studio Phase Plan

## Phase 0: Contracts And Architecture Lock

Goal: make parallel work safe.

Deliverables:

- Product workflow contract.
- Runtime Motion JSON contract.
- Studio project contract.
- Local preview protocol.
- Multi-agent process contract.

Acceptance:

- Local-first workflow is explicit.
- iOS runtime remains the source of truth.
- Studio project and `.motion.json` responsibilities are separated.
- Parallel task ownership and review gates are defined.

## Phase 1: Local Web Studio MVP

Goal: create a local browser editor that can author a basic FrameZero animation and export valid JSON.

Status: shipped locally.

Parallel tasks:

- Editor shell: layout, top bar, layers panel, inspector shell.
- Schema/compiler: Zod schema, Studio project model, deterministic compiler.
- Component authoring: circle, rounded rectangle, text, roles, property inspector.
- Phase timeline: add, delete, reorder, edit, and play phases.

Acceptance:

- User can add visible nodes.
- User can assign shared roles.
- User can create phases.
- User can animate multiple existing nodes in parallel through role selectors.
- Studio exports valid `schemaVersion: 1` `.motion.json`.
- Exported JSON passes `MotionEngineKit` validation.

## Phase 2: Local iOS Simulator Preview

Goal: Web Studio sends generated JSON to the simulator and receives runtime apply/reject feedback.

Status: shipped locally.

Parallel tasks:

- Local bridge server.
- iOS preview sync client.
- Studio preview panel.
- End-to-end preview verification.

Acceptance:

- Web edits reach the simulator.
- Valid documents apply.
- Invalid documents are rejected without clearing the last valid preview.
- Studio displays iOS runtime errors.
- Reconnect sends the latest full document.

## Phase 3: Full Local Authoring

Goal: make the local editor useful for designers without hand-writing JSON.

Status: first shipped slice. The Studio can add components, assign roles, edit phases, add arc/jiggle/action controls, export JSON, persist locally, and send to the simulator. Dragging on-canvas, multi-select editing, reordering, and richer visual inspection remain future work.

Parallel tasks:

- Visual canvas editing.
- Multi-selection and role assignment.
- Advanced motion controls.
- Particles and temporary component action UI.
- Local project save/open/import/export.
- UX polish and validation display.

Acceptance:

- Designer can start from blank.
- Designer can add multiple components.
- Designer can animate components together or separately.
- Designer can preview in iOS.
- Designer can export JSON that developers can ship.

## Phase 4: Hardening

Goal: make the project reliable enough for open-source users.

Parallel tasks:

- Test suite and fixtures.
- Performance and preview latency.
- Accessibility and visual QA.
- One-command local startup.
- Contributor documentation.

Acceptance:

- `pnpm test` passes for Studio.
- `swift test` passes for `MotionEngineKit`.
- Xcode simulator build passes.
- Fixture corpus covers supported motion features.
- Setup documentation works from a clean checkout.

## Later: GCP / Remote Sessions

Cloud starts only after local authoring and local preview feel strong.

Potential later services:

- Cloud Run session server.
- Firestore project/version storage.
- Cloud Storage assets and recordings.
- Firebase Auth.
- Shared remote preview sessions.

Cloud must not change the local project format or local preview loop.
