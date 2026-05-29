## Why

The early interactive lessons include the first large divergence between runtime-first submission governance and standard module rendering. Lessons 2-2 through 3-4 now have runtime manifests for submission evidence but no manifest modules, while 2-1 has many single-lesson custom module and interaction names.

## What Changes

- Migrate lessons 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 to the canonical module taxonomy.
- Populate or rewrite manifest modules so these lessons no longer depend on unregistered module kinds.
- Preserve existing lesson order, student-facing behavior, shared submission evidence, and finalization behavior.
- Add per-lesson verification so early lessons are covered by module gates and submission gates.

## Capabilities

### New Capabilities
- `interactive-course-standard-module-migration`: Tracks full-course migration coverage from legacy or empty manifests to standard module manifests.

### Modified Capabilities
- `interactive-module-taxonomy`: Applies canonical module classes to the early lesson group.
- `course-data-quality-gates`: Requires early migrated lessons to pass module taxonomy gates.

## Impact

- Affects runtime manifests and student/teacher panels for 2-1 through 3-4.
- Builds on the taxonomy, registry gates, and response contracts.
- Does not change course pedagogy or step order.
