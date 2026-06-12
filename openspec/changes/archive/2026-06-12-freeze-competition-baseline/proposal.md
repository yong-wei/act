## Why

The platform already has diagnosis, document grading, learning paths, Konling modes, prep-pack overlays, and demo effect-report primitives, but they are not frozen into one competition-ready story. Without a fixed baseline, later hardening work can improve isolated modules while still failing the September submission need for a repeatable, auditable, three-minute closed-loop demo.

## What Changes

- Define a competition baseline for the automatic-control intelligent teaching assistant loop: document assignment, rubric grading, diagnosis, path selection, Konling explanation, teacher prep-pack action, overlay impact, and effect report.
- Add a deterministic demo ledger covering accounts, class, students, routes, data origins, expected screenshots, fallback states, and acceptance commands.
- Add seed/reset requirements for synthetic competition data without mutating or mislabeling real learner evidence.
- Record the capability map that links project surfaces to competition requirements and current implementation maturity.
- Establish the baseline that downstream evidence, grading, path/prep-pack, and final visual polish changes must target.

## Capabilities

### New Capabilities

- `competition-demo-baseline`: Defines the deterministic competition scenario, seed/reset contract, route ledger, data-origin rules, and baseline acceptance path.

### Modified Capabilities

- None.

## Impact

- Affects `docs/competition/*`, demo seed/reset scripts or API surfaces, route ledger metadata, demo account fixtures, privacy/data-origin documentation, and Playwright or scripted acceptance paths.
- Does not change grading algorithms, diagnosis scoring, RAG retrieval, Konling runtime behavior, or production data semantics in this change.
