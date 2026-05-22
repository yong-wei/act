## Why

The shared evidence path only improves data usability if response-producing course pages actually use it. Module 5 contains the current 5-2 and later lessons where future teaching data must not repeat the 5-1 answer-dropping pattern.

## What Changes

- Inventory every response-producing page in 5-2, 5-3, 5-4, 5-5, and 5-6.
- Replace lesson-local submission tracking with the shared manifest submission path.
- Preserve existing student state and teacher summaries while standardizing event payloads.
- Include special parameter, simulation, and training-result panels as structured extra evidence.
- Add guards proving 5-2 and later lessons are fully migrated.

## Capabilities

### New Capabilities

- `module5-submission-migration`: Migration coverage for module 5 response-producing pages.

### Modified Capabilities

- None.

## Impact

- `src/features/interactive/unit-5-2-*`
- `src/features/interactive/unit-5-3-*`
- `src/features/interactive/unit-5-4-*`
- `src/features/interactive/unit-5-5-*`
- `src/features/interactive/unit-5-6-*`
- Shared manifest runtime tests and module 5 course tests
