## Why

The old `/interactive-learning/lesson-*` one-page lesson routes predate the current classroom course model and are now explicitly retired. Keeping them in the route tree and catalog makes the interactive surface ambiguous and leaves a path that can bypass the standard course/session adapters.

## What Changes

- **BREAKING**: Remove all remaining `/interactive-learning/lesson-*` App Router pages for the deprecated one-page lessons.
- Remove catalog, navigation, tests, and quick-entry references that expose retired `lesson-*` routes.
- Preserve the canonical runtime-first course routes such as `/interactive-learning/courses/unit-2-1-modeling-language` and later unit course entries.
- Add a guard that fails if a retired one-page route or catalog entry is reintroduced.

## Capabilities

### New Capabilities
- `legacy-interactive-lesson-retirement`: Defines the retirement contract for deprecated one-page interactive lesson routes.

### Modified Capabilities

## Impact

- `src/app/interactive-learning/lesson-*`
- `src/features/interactive/learning-catalog.ts`
- Interactive catalog, route, and navigation tests that still expect legacy one-page entries.
