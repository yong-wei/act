## Why

The platform needs permanent gates so new interactive lessons cannot regress into answer-dropping submissions or unclassified sync errors. Manual inspection after each class is too late.

## What Changes

- Add tests or static checks that enumerate response-producing manifest pages and verify shared submission path usage.
- Add data-quality reports that summarize answer availability, score availability, question summaries, sync incident quality, reports, and snapshots.
- Include 5-2 and later lessons in the enforced coverage inventory.
- Update interactive lesson implementation guidance with the new evidence gate.

## Capabilities

### New Capabilities

- `course-data-quality-gates`: Repository gates and reporting for course evidence usability.

### Modified Capabilities

- None.

## Impact

- `scripts/tests/*`
- `scripts/db/*`
- `src/features/interactive/__tests__/*`
- `.codex/skills/interactive-lesson-implementation/*`
- Data-governance reporting utilities
