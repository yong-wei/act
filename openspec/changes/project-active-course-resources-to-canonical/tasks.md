## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## 1. Active inventory and authoring contract

- [x] 1.1 Enumerate current published/used courses, runtime lessons, handouts, interactive manifests/steps, and classroom resources with source revision/digests.
- [x] 1.2 Add authoring `projectionMode` and `knowledgeRefs` schemas and deterministic runtime status fields without editing generated runtime by hand.

## 2. Deterministic migration

- [x] 2.1 Build the old-ID crosswalk and apply one-to-one, card, manifest, and exact label/alias mappings in that order.
- [x] 2.2 Emit `BOUND`, `EXPLICIT_NONE`, and `REVIEW_REQUIRED` records with mapping method, source evidence, and package scope.
- [x] 2.3 Add fixtures for duplicate, split, merge, fuzzy-only, stale, and exact mappings; prove ambiguous items cannot publish.

## 3. Author decisions and package gates

- [x] 3.1 Provide a single author semantic decision record for each ambiguous/split/merge item and make repeated builds reuse it deterministically.
- [x] 3.2 Build per-course impact/readiness reports and ensure unresolved items block only the corresponding package.
- [x] 3.3 Verify new authoring rejects old graph IDs after migration while legacy crosswalk remains readable.

## 4. Verification

- [x] 4.1 Run focused inventory, mapping, status, deterministic rebuild, and package-gate tests.
- [x] 4.2 Run `rtk openspec validate project-active-course-resources-to-canonical --type change --strict` and `rtk openspec validate --changes --strict`.
