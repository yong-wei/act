## Why

`/interactive-learning/courses/lsum-design-feasible-domain` is a retired special course and should not remain beside the runtime-first interactive course set. Removing it clears the course surface before the remaining lessons are moved onto one standard governance path.

## What Changes

- **BREAKING**: Delete `/interactive-learning/courses/lsum-design-feasible-domain` and its student/teacher routes.
- Remove LSUM-specific feature pages, course constants, AI context registration, preset registration, catalog entries, and session snapshot aliases that exist only for that retired course.
- Update tests so LSUM is asserted as absent rather than preserved as a legacy premium/special course.
- Keep the canonical 2-1 replacement course and other active unit courses unchanged.

## Capabilities

### New Capabilities
- `lsum-course-retirement`: Defines complete retirement of the legacy LSUM special course.

### Modified Capabilities

## Impact

- `src/app/interactive-learning/courses/lsum-design-feasible-domain`
- `src/features/interactive/lsum-design-feasible-domain`
- `src/lib/lsum-course.ts`
- `src/features/teacher/preset-lessons/presets`
- `src/features/interactive/learning-catalog.ts`
- Tests that currently expect LSUM presets or route aliases.
