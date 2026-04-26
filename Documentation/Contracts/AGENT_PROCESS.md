# Multi-Agent Process Contract

## Operating Model

FrameZero Studio work is contract-first. No implementation starts until the relevant task contract is accepted.

Each implementation task has:

- one task lead;
- up to three child agents;
- one independent reviewer;
- one QA or verification owner when behavior is visible or risky.

The lead is accountable for the final task outcome. Child agents own scoped slices. The independent reviewer checks both child work and lead integration.

## Roles

### Program Owner

Owns sequencing, scope decisions, and final acceptance.

### Phase Lead

Owns cross-task consistency inside a phase.

### Task Lead

Owns the task contract, child assignments, integration branch, conflict resolution, verification, and handoff.

### Child Agent

Owns one scoped implementation slice. A child agent cannot change public contracts, shared schemas, routing, global state, or design tokens without lead approval.

### Independent Reviewer

Reviews actual diffs, not summaries. Must not be the task lead or a child agent on that task.

### QA / Verification Agent

Runs the test gate and captures evidence.

## Branch Strategy

```text
main
  phase/<phase-name>
    task/<task-name>
      child/<task-name>-<slice>
```

Rules:

- Child branches merge only into their parent task branch.
- Task branches merge only into the phase branch.
- Phase branches merge into `main`.
- Every merge requires review evidence.
- Public contract changes require contract amendment before code continues.

## Task Contract Template

```md
# Task Contract: <name>

## Goal

## Owner

## Child Agents

## Scope

## Out Of Scope

## Public Interfaces

## Dependencies

## Files / Areas Expected To Change

## Acceptance Criteria

## Test Requirements

## Merge Risks

## Reviewers
```

## Required Flow

1. Task lead drafts the contract.
2. Child agents confirm scope.
3. Phase lead checks cross-task compatibility.
4. Independent reviewer checks reviewability.
5. Contract is marked accepted.
6. Child agents implement scoped slices.
7. Lead reviews and integrates child work.
8. Independent reviewer audits child diffs and lead integration.
9. QA runs the appropriate gate.
10. Lead merges upward only after approval.

## Gates

### Child Gate

- Assigned scope complete.
- Relevant tests pass.
- No unrelated files changed.
- No unauthorized shared-interface changes.
- Manual or simulator evidence attached when UI behavior changed.

### Task Gate

- All child work integrated.
- Contract acceptance criteria met.
- Typecheck/build/test pass for affected modules.
- Browser or simulator smoke test completed when applicable.
- Independent reviewer approved.

### Phase Gate

- Full app/package tests pass.
- iOS simulator build passes when Swift code changed.
- Core workflows verified.
- Known risks documented.
- Phase lead approved.

### Main Gate

- Clean working tree.
- Full test suite passed.
- Production or simulator build passed as appropriate.
- Documentation updated.
- Final review approved.

## Contract Change Protocol

If implementation reveals a contract is wrong:

1. Stop affected work.
2. Lead proposes a contract amendment.
3. Child agents confirm impact.
4. Phase lead checks cross-task effects.
5. Independent reviewer confirms updated acceptance criteria.
6. Contract is re-accepted.
7. Implementation resumes.

No silent contract drift.

## Completion Standard

A task is complete only when the lead can provide:

- branch and commit reference;
- contract link;
- build result;
- test result;
- simulator or browser evidence when relevant;
- known risks;
- independent reviewer approval.

