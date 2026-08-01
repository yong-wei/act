## 1. Stop and preserve Legacy paths

- [x] 1.1 Add a read-only stopped archive state for unfinished Legacy knowledge paths.
- [x] 1.2 Preserve immutable steps, execution events, deviation records, and original Legacy revision.
- [x] 1.3 Preserve the declared learning goal or user intent separately without mapping old steps.

## 2. Add Canonical replanning

- [x] 2.1 Define Canonical path identity and version fields independent from Legacy paths.
- [x] 2.2 Require current cumulative portrait, version-matched CourseCoverage, reviewed KAQ binding, and a formally released Teaching Projection; treat engineering-only relations as insufficient.
- [x] 2.3 Generate a new path without inherited Legacy progress when all inputs are ready.
- [x] 2.4 Return an explicit pending state when teaching semantics or goal resolution is unavailable, without engineering-relation inference.

## 3. Verify transition behavior

- [x] 3.1 Add migration tests proving no unfinished Legacy step can execute after cutover.
- [x] 3.2 Add tests proving preserved goals do not constrain the new node sequence.
- [x] 3.3 Add planning tests for valid Teaching Projection, missing semantics, cycles, and out-of-coverage objects.
- [x] 3.4 Run path domain tests, typecheck, and strict OpenSpec validation.
