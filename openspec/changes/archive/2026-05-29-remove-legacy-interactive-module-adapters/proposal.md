## Why

After all existing courses are migrated, keeping legacy aliases and lesson-private module variants would let future lessons reintroduce the same taxonomy sprawl. The final series step must make the standard module system a hard boundary.

## What Changes

- Remove or disable migration-only legacy alias use for migrated lessons.
- Tighten gates so unregistered module classes, unregistered response kinds, and legacy aliases fail tests.
- Require every existing runtime-first interactive lesson to be present in the standard-module migration inventory.
- Keep only explicit historical compatibility paths that are not used by new or migrated manifests.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `interactive-module-taxonomy`: Retire migration aliases as an authoring or migrated-manifest escape hatch.
- `course-data-quality-gates`: Make standard module and response gates strict.
- `interactive-course-standard-module-migration`: Declare full existing-course migration complete.

## Impact

- Affects shared manifest runtime gates, legacy alias tables, and all runtime manifests.
- This is intentionally blocked on all migration changes.
- This is a breaking governance change for new course authoring.
