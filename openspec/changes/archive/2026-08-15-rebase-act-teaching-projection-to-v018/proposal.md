## Why

ACT's current Teaching Projection and prerequisite publication are bound to the
v0.9 Authority snapshot. Switching only the engineering graph to v0.18 would
create a mixed production state. Existing teaching references therefore need a
capture-bound rebase against the full v0.9 to v0.18 identity impact set.

## What Changes

- Capture the current active course, resource, card, textbook locator,
  prerequisite, learning-path, Konling, and RAG reference denominator at one Git revision.
- Resolve every existing teaching reference against the v0.18 candidate by
  stable object identity or an explicit reviewed mapping record.
- Carry forward unchanged identities, apply reviewed split/merge/successor
  mappings, and emit `REVIEW_REQUIRED` for unresolved or ambiguous references.
- Rebuild a complete inactive Teaching Projection and prerequisite publication
  bound to the exact v0.18 snapshot and input capture.
- Prohibit Chinese/English name similarity, aliases, embeddings, or terminology
  labels from authoring a teaching relation or successor mapping.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `act-teaching-projection-rebase`: support a full v0.9 to v0.18 rebase with an
  exact captured denominator and explicit reviewed identity mappings.

## Impact

- Affects Teaching Projection rebase tooling, prerequisite publication,
  mapping worklists, active-course reference validation, and related tests.
- Depends on `import-actkg-v018-authority-candidate`; it is independent of the
  localized display-label change.
- Does not re-review published ActKG engineering semantics or use the historical
  4,880-DEFER CourseCoverage population as the current denominator.
