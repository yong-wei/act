## Why

5-1 and 5-2 did not form course completion pre/post tracking results because the teacher review page only parses a small set of hard-coded state kinds. Future lessons need CourseEvidenceSpec-driven parsing.

## What Changes

- Add a shared parser for StudentState.data, CourseEvidenceSpec, manifest metadata, and submission evidence summaries.
- Return pre, post, delta, evidenceQuality, step ids, and recoverability.
- Keep course_review and showcase_review compatibility paths.
- Prioritize 5-3 through 5-6 verification.

## Capabilities

### New Capabilities

- `course-review-prepost-tracking`

### Modified Capabilities

- None.

## Impact

- src/app/classroom/teacher/[sessionId]/review/page.tsx
- shared course review parser
- teacher review tests
