## Semantic Review Protocol

The implementing agent must inspect each selected resource and assign fields based on resource meaning. The agent must not stop merely because a field is marked `needs-human-review`, `semantic-review-required`, or similar. In this project, that label means an implementing agent performs semantic review and an independent reviewer checks the evidence.

Scripts may be used only to:

- enumerate stable workqueue items
- show current missing fields
- validate that completed fields satisfy the helper
- produce before/after summaries

Scripts must not auto-fill K/A/Q mappings, graph refs, path disposition, path stage, evidence policy, or review rationale as accepted completion.

## Batch Boundary

In scope:

- registered resource records
- knowledge cards
- knowledge infographs
- their direct citation targets and launch targets

Out of scope:

- runtime lesson step/media families
- textbook/reference search-document rows
- assessment item semantic review

Ambiguous resources should be classified with reviewed limitation or exclusion rationale rather than promoted to path-plannable.

## Formal Audit Projection

The tracked item-review source is applied while formal resource-field-completion rows are constructed, before summaries, workqueues, runtime projections, LearningGoal baselines, and path-readiness gates are derived. The generator also retains the pre-review rows solely for the core sidecar workqueue's `startingBlockerCodes`; semantic review does not erase content-hash, evidence-contract, readiness, or dependency gaps.

Materialization is an explicit frozen-snapshot operation: `npm run db:materialize-core-semantic-review` reads the tracked audit JSONL and summary metadata instead of re-enumerating live candidates. The tracked `core-registered-knowledge-resource-semantic-materialization-manifest.json` pins the HEAD legacy audit bytes, stable summary metadata, 4,683 non-scope rows, invariant fields of the 608 scope rows, review-source bytes, and the 5,291-row denominator. Exact legacy-byte identity is the only condition that permits initial materialization; every other input must already satisfy the complete formal review projection. The core workqueue, review source, review items, and summary remain the immutable before-state; only the formal audit and its downstream artifacts are re-derived.
