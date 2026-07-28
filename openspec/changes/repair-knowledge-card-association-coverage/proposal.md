## Why

Issue #982 identified that `/knowledge` exposes graph nodes without usable knowledge-card associations. The current runtime graph contains 838 nodes, while only 297 matching runtime cards exist. Nodes without cards silently lose the card entry, so users cannot distinguish missing content from an intentional exclusion.

## What Changes

- Materialize missing authoring cards from the existing base knowledge-graph fields without overwriting reviewed cards.
- Add an explicit exclusion registry requiring a reason for any node that intentionally has no standalone card.
- Audit every exported graph node into linked, missing-authoring, invalid-mapping-or-runtime, or excluded dispositions.
- Make the formal runtime export fail closed when any node remains missing or invalid.
- Export a deterministic runtime coverage report and test every node-to-card resource path.

## Capabilities

### New Capabilities

- `knowledge-card-association-coverage`: defines complete, reasoned knowledge-card coverage and authoring/runtime identity consistency.

### Modified Capabilities

- None.

## Impact

- Adds missing Markdown cards under `course-content/authoring/knowledge/cards/nodes/` and their formal runtime projections.
- Updates the global runtime graph resource arrays and adds `course-content/runtime/knowledge/cards/coverage.json`.
- Changes no UI component, database schema, learner data, or knowledge-node canonicalization rule.
