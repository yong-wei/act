## Why

Lessons 4-1 through 5-6 and cruise-comfort are closer to the shared manifest runtime, but they still carry historical module aliases and course-local registry extensions. The refactor is not complete until the stable lesson group also passes the standard module gates.

## What Changes

- Migrate 4-1, 4-2, 4-3, 4-4, 4-5, 4-6, 4-7, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, and cruise-comfort to canonical module classes.
- Remove remaining course-local module alias use where shared canonical modules can render the same behavior.
- Preserve existing Control Odyssey, compute, activity, and report behavior.
- Extend the migrated lesson inventory so all existing runtime-first lessons are covered by standard module gates.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `interactive-course-standard-module-migration`: Adds the stable lesson group migration requirement.
- `interactive-module-taxonomy`: Applies canonical modules across the remaining existing lesson inventory.

## Impact

- Affects manifests and shared/course-local panel registries for module 4, module 5, and cruise-comfort.
- Completes standard-module coverage before legacy adapters can be removed.
