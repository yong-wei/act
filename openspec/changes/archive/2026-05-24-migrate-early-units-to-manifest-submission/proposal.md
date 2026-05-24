## Why

Courses 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 are classroom-style interactive courses, but they still lack runtime manifests and submit directly through `LESSON_SUBMIT` / `LESSON_RESUBMIT`. They need the same manifest submission evidence path already used by 2-1, 3-5 through 4-7, and module 5.

## What Changes

- Add runtime `interactive-manifest.json` files for 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4.
- Convert those student pages from direct course submit events to `useManifestSubmissionController` and `submitManifestStepResponse`.
- Add `CourseEvidenceSpec` support for each migrated lesson, including response-producing steps, objective scoring metadata, and pre/post/summary mappings where available.
- Expand `COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY` and `REQUIRED_RUNTIME_FIRST_GATE_LESSONS` to include the migrated early units.
- Remove local submission bypass logic rather than wrapping it behind the shared controller.

## Capabilities

### New Capabilities

### Modified Capabilities
- `manifest-submission-evidence`: Early unit response pages must use the v2 manifest submission envelope.
- `course-evidence-specs`: Early runtime-first unit lessons must resolve supported evidence specs.
- `course-data-quality-gates`: Submission gates must include the migrated early units.

## Impact

- `course-content/runtime/lessons/2-2`, `2-3`, `2-4`, `3-1`, `3-2`, `3-3`, `3-4`
- `src/features/interactive/unit-2-2-*` through `unit-3-4-*`
- `src/lib/unit-2-2-course.ts` through `src/lib/unit-3-4-course.ts`
- `src/features/interactive/course-submission-gate-inventory.ts`
- `src/lib/data-governance/course-evidence-specs.ts`
- Manifest submission and course data-quality gate tests.
