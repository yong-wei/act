## Why

The adaptive assessment flow now preserves an immutable, student-scoped answer snapshot, but it does not yet turn a wrong answer into a governed attribution that downstream micro-tutoring can safely consume. Issue #1157 is the first executable slice of tracking issue #976 and establishes that evidence boundary without changing mastery or learning paths.

## What Changes

- Add a student-scoped service that attributes one traceable wrong answer to reviewed graph-node identifiers and controlled misconception tags.
- Persist a versioned, immutable attribution containing only sanitized evidence summaries and references, confidence, limitations, and an explicit attribution state.
- Fail closed for unauthorized, cross-session, version-mismatched, or untraceable attempts.
- Represent incomplete or low-confidence evidence as uncertain and direct it to manual review or repeated practice instead of presenting it as fact.
- Add migration and behavioral tests for authorization, missing evidence, low confidence, deterministic attribution, idempotency, and privacy-safe projection.

## Capabilities

### New Capabilities

- `wrong-answer-evidence-attribution`: Governed attribution and persistence contract for one adaptive-assessment wrong-answer snapshot.

### Modified Capabilities

None.

## Impact

- Adds one Prisma persistence model and migration.
- Adds a feature-level attribution service and its tests under adaptive assessment.
- Consumes the immutable item-reference metadata introduced by #1102.
- Does not add remediation selection, generated validation questions, cross-session history, mastery mutation, path mutation, or teacher aggregation.
