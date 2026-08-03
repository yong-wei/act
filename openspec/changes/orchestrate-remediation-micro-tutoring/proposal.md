## Why

Governed wrong-answer attribution from Issue #1157 identifies a learner's canonical knowledge node and misconception, but the platform does not yet turn that evidence into a short, actionable and verifiable remediation task. Issue #1158 closes that gap without allowing generated questions, inaccessible resources or uncertain diagnoses to become formal learning interventions.

## What Changes

- Add learner-triggered orchestration that consumes an owned, governed wrong-answer attribution.
- Select accessible remediation resources deterministically from canonical knowledge-node, misconception and prerequisite bindings.
- Select an existing governed isomorphic or variant validation question; never generate a formal validation question.
- Persist an immutable, version-bound orchestration result containing either a complete 5–10 minute micro-tutoring task snapshot or a sanitized unavailable result.
- Revalidate authorization and reference versions when reading a persisted result, failing closed on revocation or drift.
- Add regression coverage for successful orchestration, missing inputs, authorization failures, reference drift, idempotency and sensitive-data exclusion.

## Capabilities

### New Capabilities

- `remediation-micro-tutoring-orchestration`: Learner-triggered, deterministic and governed orchestration of remediation resources and validation questions from wrong-answer attribution.

### Modified Capabilities

None.

## Impact

- Adds Prisma persistence and migration for immutable remediation orchestration results.
- Adds a server-side assessment-domain orchestrator and learner-facing API route.
- Reads existing wrong-answer attribution, canonical knowledge/resource bindings and governed assessment-item metadata.
- Adds unit and route-level tests; no automatic mastery/path mutation, teacher aggregation UI or intervention-effect evaluation is introduced.
