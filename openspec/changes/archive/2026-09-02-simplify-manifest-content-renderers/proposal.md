## Why

After renderer registration is consolidated, the canonical manifest content
renderer remains a large branch-heavy implementation with repeated payload
normalization, card lookup, math/content formatting, and role conditions.  Its
size obscures the already-established plugin and submission contracts and
raises the cost of every course migration.

## What Changes

- Apply the `code-simplification` workflow to the canonical manifest content
  renderer after C13, reducing repeated branches and unclear intermediates
  while preserving exact behavior.
- Simplify dispatch, payload access, content/card rendering, and fallback paths
  with named predicates, guard clauses, and shared pure helpers where they
  remove actual duplication.
- Preserve plugin lookup, role projection, reference-answer privacy, evidence
  classification, math rendering, response prefills, missing-field diagnostics,
  and optional/required degradation.
- Record before/after complexity and behavior evidence; extracting files alone
  is not an accepted simplification.
- Retain existing public imports only where callers remain; do not add a second
  renderer or change the manifest plugin contract.

## Capabilities

### New Capabilities

- `manifest-content-renderer-simplification`: Defines the behavior-preserving
  simplification and evidence requirements for the canonical renderer.

### Modified Capabilities

None.  `manifest-runtime-plugin-contract` remains unchanged and owns all
  plugin identity, role, evidence, and missing-renderer semantics.

## Impact

- Primarily affects `src/features/interactive/shared/manifest-runtime/content-
  renderers.tsx` and its focused unit/contract tests, with adjacent canonical
  helpers only when required by an identified duplication.
- Uses C13's consolidated registry and is downstream of
  `consolidate-course-renderer-registration-and-retire-legacy-renderer`.
- No course content, runtime identity/hash, session access, live/evidence
  behavior, database schema, plugin key, or Assignment API changes.
