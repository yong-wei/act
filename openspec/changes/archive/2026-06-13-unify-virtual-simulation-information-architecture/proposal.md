## Why

`/simulations` and `/virtual-lab` currently present separate simulation availability stories. `/simulations` shows all simulation scenarios as task-chain entries, while `/virtual-lab` shows a model library with one open model and several preparing models. This creates conflicting student-facing truth.

## What Changes

- Make `/simulations` the canonical student simulation catalog.
- Convert `/virtual-lab` into a compatibility redirect to `/simulations`.
- Remove deployment/status-style model availability from student-facing simulation catalog cards.
- Register `/virtual-lab` as a compatibility redirect in central navigation contracts so it does not become a competing student entry.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-role-navigation`: register simulation compatibility redirect semantics and preserve one canonical student simulation entry.
- `simulation-course-resource-integration`: define `/simulations` as the canonical standalone simulation catalog while preserving `/simulations/*` deep links.

## Impact

- Affects `/simulations`, `/virtual-lab`, central navigation tests, and OpenSpec specs.
- Does not change simulation detail-page shells, physics, scoring, local panels, Konling dock, or 3D assets.
