# Product Workflow Contract

## Purpose

FrameZero Studio should make animation authoring easier than hand-writing Swift or JSON. Designers create motion visually, developers receive deterministic FrameZero JSON, and the iOS runtime proves whether the output works.

## Source Of Truth

- The Studio project file is the source of truth for authoring.
- The exported `.motion.json` is a generated runtime artifact.
- `MotionEngineKit` is the source of truth for runtime semantics.
- The iOS simulator is the source of truth for preview correctness.
- Browser preview is useful feedback, not final proof.

## Designer Flow

1. Open FrameZero Studio locally.
2. Create or open a local Studio project.
3. Add components: circle, rounded rectangle, text, and later richer templates.
4. Assign roles to one or more components.
5. Create phases on a timeline.
6. Animate selected nodes or shared roles.
7. Preview quickly in the browser.
8. Send the generated JSON to the iOS simulator.
9. Tune until the simulator result feels correct.
10. Export the Studio project and `.motion.json`.

## Developer Flow

1. Pull the Studio project and exported `.motion.json`.
2. Run package tests and iOS preview locally.
3. Inspect generated JSON in version control.
4. Use `MotionRuntimeView` or `.motionDriven(...)` with the exported JSON.
5. Reject output that does not load cleanly in `MotionEngineKit`.

## Local-First Constraints

- No required cloud account.
- No required hosted database.
- No required network service for authoring.
- Projects must open, edit, preview, export, and run offline.
- All primary project state lives in local files or local browser storage.
- Generated files must be reproducible from committed source artifacts.
- GCP, auth, collaboration, and remote sessions are later layers.

## MVP Acceptance Criteria

- A user can create a blank local project.
- A user can add at least two visible nodes.
- A user can assign a shared role to multiple nodes.
- A user can create at least two phases.
- A user can animate multiple existing nodes in parallel through role selectors.
- Studio can export valid `schemaVersion: 1` FrameZero JSON.
- The iOS simulator can load and preview the exported JSON.
- Invalid documents produce actionable errors and do not blank the previous valid preview.

## Non-Goals

- Cloud sync.
- Multiplayer editing.
- Marketplace or shared asset library.
- Full Figma replacement.
- Browser-perfect SwiftUI rendering.
- Arbitrary scripting inside animation JSON.

