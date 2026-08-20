## Why

`/profile/portfolio` currently initializes classroom works, simulation designs, and ethics cases as empty client data. Its follow-up requests also target write-only or user-id based endpoints, so real learning evidence is silently absent from the student's portfolio. This breaks the learning-process companion loop: students cannot review durable classroom, simulation, or ethics evidence in the personal learning record.

## What Changes

- Add an authenticated, server-owned portfolio evidence read model for the current student.
- Project durable classroom step submissions into safe classroom-work summaries.
- Project the student's simulation logs into parameter and score summaries without exposing raw trajectories.
- Project the student's ethics logs, including whether remediation is complete and the student's own justification.
- Distinguish an empty source from an unavailable source in the portfolio response and UI.
- Remove the portfolio page's placeholder arrays and direct calls to write-only or user-id based endpoints.
- Keep prompt assessment history outside this change; its persistence and authorization are handled by the separate prompt-history change.

## Capabilities

### New Capabilities

- `student-portfolio-evidence`: Authenticated, user-scoped projection of classroom, simulation, and ethics learning evidence into the personal portfolio.

### Modified Capabilities

- None.

## Impact

- Adds a student-only portfolio evidence API and a small server-side projection helper.
- Updates `src/app/(main)/profile/portfolio/page.tsx` and its tests.
- Reads existing `StudentStepResponse`, `SimulationLog`, and `EthicalLog` records; no schema migration and no new learning-fact writes are required.
- Does not modify prompt assessment persistence, formal learning records, official scores, or learning-portrait calculations.
