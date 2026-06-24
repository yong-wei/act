## Context

The repository already has a synthetic intelligent teaching assistant demo package. The new series needs a final acceptance layer that proves the upgraded closed loop works as an integrated product and produces evidence suitable for a competition submission or internal review.

## Goals / Non-Goals

**Goals:**

- Create deterministic demo seed/reset for the full assistant closed loop.
- Add acceptance checks for all visible steps and privacy boundaries.
- Produce effect-report metrics and exportable report data.
- Provide a runbook for local demo rehearsal.

**Non-Goals:**

- Using real student data by default.
- Claiming measured learning gains without collected evidence.
- Connecting new checks to GitHub Actions while quota is constrained.

## Decisions

### Decision 1: Demo acceptance follows the closed-loop story

Acceptance should run in the same order as the demo: submission, conversion, draft grading, teacher approval, writeback, diagnosis, paths, Konling explanation, prep-pack overlay, and effect report.

### Decision 2: Synthetic and real evidence are separated

Synthetic fixture metrics can prove workflow readiness. Real user feedback and classroom metrics must be clearly labeled and imported through a separate, privacy-reviewed path.

### Decision 3: Effect report is data-backed

The report should include metric definitions, data windows, numerator/denominator, exclusions, and source references for every displayed effect claim.

## Validation

- Demo seed/reset is deterministic and idempotent.
- Acceptance checks verify visible product surfaces and privacy redaction.
- Effect report export validates metric definitions and source references.
- `rtk openspec validate assistant-closeloop-demo-effect-report --strict` passes.
