## Why

The report's final target is not only implementation but a reproducible proof package: seeded resources, demo class and students, path execution samples, simulation/Arena validation samples, teacher report exports, provider config examples, and acceptance scripts. Without a demo/evaluation package, the closed loop may exist in code but remain hard to verify before release or competition review.

## What Changes

- Define a reproducible control-correction evaluation and demo package.
- Include seed data, scenario scripts, expected metrics, export outputs, privacy notes, deployment notes, and rollback notes.
- Add automated acceptance commands that verify the full loop from learner state to path, execution, Konling correction, Arena validation, and teacher report.
- Require documentation and fixtures to stay aligned with implemented APIs and specs.

## Capabilities

### New Capabilities

- `control-correction-evaluation-demo-package`

## Impact

- Provides the strict final acceptance layer for the whole series.
- Depends on student center, validation, teacher report, and provider compatibility changes.
- Does not add new product behavior beyond fixtures, scripts, documentation, and acceptance gates.
