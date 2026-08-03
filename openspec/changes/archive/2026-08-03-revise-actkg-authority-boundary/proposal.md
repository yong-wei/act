## Why

The current specifications make the engineering Authority wait for an exhaustive ACT CourseCoverage review. That couples an upstream ActKG release to local teaching evidence and treats 4,880 historical `DEFER` rows as a live selector gate, even though ACT does not own ActKG engineering semantics. The boundary must be corrected before versioned Authority and Teaching Projection work can proceed.

## Series Dependencies

- Depends on: none (series root).

## What Changes

- **BREAKING** Separate ActKG engineering Authority from ACT-owned teaching resources and teaching prerequisites.
- Permit a valid, integrity-checked ActKG Bundle to become `ACTIVE` without a CourseCoverage decision for every upstream object.
- Treat the declared snapshot as immutable evidence that may be explicitly staged/activated as Engineering Authority; snapshot creation remains selector-neutral and is not candidate-only.
- Freeze the 34 historical CourseCoverage batches (4,891 members; 11 `INCLUDE`, 4,880 `DEFER`) as an immutable legacy audit manifest; new selectors MUST NOT read its blocking verdicts.
- Keep Aggregate/profile-only upstream objects without ACT bindings outside the current teaching denominator; historical `DEFER` rows remain audit-only.
- Replace exhaustive Release membership and global-course cutover requirements with scope-limited ACT teaching projection gates.
- Keep engineering entities and engineering relations ActKG-owned; ACT only owns course/resource bindings, teaching prerequisites, and teaching consumers.
- Preserve fail-closed integrity, identity, provenance, and compatibility checks; do not add a database or deployment workflow.

## Capabilities

### New Capabilities

None. This change repairs the authority boundary in existing contracts; versioned Authority and Teaching Projection are delivered by dependent changes.

### Modified Capabilities

- `course-knowledge-coverage-overlay`: coverage is an ACT teaching overlay, not an exhaustive engineering-release denominator or Authority gate.
- `current-course-coverage-review`: historical batches become immutable audit evidence and no longer globally block engineering Authority.
- `declared-authoritative-knowledge-snapshot`: a validated ActKG snapshot can be active independently of CourseCoverage and teaching projection readiness.
- `canonical-knowledge-resource-binding`: resource binding cutover is scoped to affected ACT consumers rather than all Release members.
- `canonical-knowledge-kaq-binding`: ActKG engineering packages never own ACT teaching relations; a formally released ACT Teaching Projection owns only its explicit teaching edges, with the existing ACT/KAQ fallback retained until then.

## Impact

- OpenSpec contracts and selectors that currently use `CourseCoverage`, aggregate review closure, or a single global canonical cutover.
- Authority status, legacy audit manifest, ACT teaching overlay status, and consumer readiness/read paths.
- Existing Bundle/Repository/ReleaseSet/Delta identities remain the implementation substrate.
- No Prisma schema, public API, remote deployment, or historical LearningFact rewrite is required in this boundary change.
