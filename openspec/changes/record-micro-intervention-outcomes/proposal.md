## Why

Issue #1158 can assemble a governed short remediation task, but it does not retain what a learner actually did or turn the governed validation outcome into a bounded next-step recommendation. Without a separate intervention record, retry handling is ambiguous and later recommendations cannot be traced to the attribution, resource, assessment, and session versions that produced them.

## What Changes

- Add server-created, append-only micro-intervention instances for learner-owned available remediation tasks.
- Record idempotent start, resource-use, hint, completion, duration, and validation-submission events against the instance.
- Bind every instance and outcome to its immutable orchestration snapshot, attribution, selected resources, validation-question version/content hash, and learner session.
- Evaluate the selected governed validation question server-side without writing adaptive mastery, learning-path, or teacher-aggregation state.
- Return learner-safe, auditable next-step recommendations: governed higher-order transfer practice when available, controlled unavailability when it is not, and governed prerequisite splitting before a manual-practice/tutoring fallback on failure.

## Capabilities

### New Capabilities

- `micro-intervention-outcomes`: Durable, idempotent recording and learner-safe recommendation of governed remediation intervention outcomes.

### Modified Capabilities

None.

## Impact

- Adds Prisma models and an additive migration for intervention instances and immutable event/outcome history.
- Extends the assessment remediation API and its server-side domain service.
- Reads existing remediation orchestration, governed assessment catalog, resource-node authority, and prerequisite graph projections.
- Adds unit and route tests for retries, version binding, recommendations, and learner projection privacy. No automatic mastery/path mutation, cross-session history aggregation, or teacher aggregation is introduced.
