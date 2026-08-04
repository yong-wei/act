## Why

The new Teaching Projection has no populated ACT course bindings. Current published/used lessons, handouts, runtime lessons, and interactive manifests need a bounded migration to ActKG Canonical IDs without creating an all-repository candidate pool or blocking unrelated courses.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## What Changes

- Enumerate only currently published/used courses, handouts, runtime lessons, interactive manifests, and classroom steps.
- Add authoring `projectionMode` and `knowledgeRefs` with explicit roles, while preserving deterministic runtime generation.
- Migrate bindings in the fixed order: existing crosswalk, card references, manifest knowledge fields, exact normalized label/alias match, then one author semantic decision for ambiguous/split/merge cases.
- Classify every active resource as `BOUND`, `EXPLICIT_NONE`, or `REVIEW_REQUIRED`; unresolved items block only the affected course package.
- Preserve old IDs in an auditable crosswalk and do not infer bindings from fuzzy/model-only matches.

## Capabilities

### New Capabilities

None. This populates the `act-teaching-projection` contract from the prior change.

### Modified Capabilities

- `canonical-knowledge-resource-binding`: active-resource migration and cutover are restricted to current course packages and explicit authoring evidence.

## Impact

- Course authoring manifests, runtime lesson/interactive metadata, canonical resource binding artifacts, crosswalks, and per-course readiness reports.
- Course-specific projection gates and migration diagnostics; no upstream ActKG data or Prisma schema change.
