## Why

The taxonomy will not hold unless the repository can reject unregistered module classes, unregistered aliases, and response-producing pages that bypass the shared runtime. Current manifests can still add arbitrary `module.kind` strings because the loader and registries are open-ended.

## What Changes

- Add a module definition registry for canonical interactive module classes.
- Add validation or tests that enumerate all runtime manifests and fail on unregistered module classes.
- Add gates for legacy aliases so aliases are visible during migration but cannot be used by newly migrated lessons.
- Extend data-quality gates so module taxonomy violations are reported with lesson, step, and module identifiers.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `interactive-module-taxonomy`: Make the taxonomy executable through a registry and validation behavior.
- `course-data-quality-gates`: Add repository gates for unregistered module classes and unsafe legacy alias usage.

## Impact

- Affects shared manifest runtime registry files and test utilities.
- Affects `course-content/runtime/lessons/*/interactive-manifest.json` validation.
- Adds a hard test surface that future course work must pass before merge.
