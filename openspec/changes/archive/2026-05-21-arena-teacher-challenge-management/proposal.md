## Why

Teacher Arena publishing exists, but it behaves like a configuration page. Arena Pro needs a teaching-management surface: choose suitable challenges, monitor progress, diagnose failures, and prepare classroom review.

## What Changes

- Add teacher-facing challenge recommendation and class-aware publication support.
- Improve publication reports with typical failures, method distribution, Pareto or showcase candidates, and lecture-mode data.
- Clarify homework grading composition and deadline visibility behavior.

## Capabilities

### New Capabilities

- `arena-teacher-challenge-management`

### Modified Capabilities

- None.

## Impact

- `src/features/arena/teacher/teacher-arena-config.tsx`
- `src/features/arena/teacher/publication-report.ts`
- `src/app/teacher/arena/publications/[publicationId]/page.tsx`
- Teacher Arena API routes and tests
