## Why

The current submission gate inventory is centered on 5-2 through 5-6. Runtime-first lessons in modules 2, 3, 4, and 5 can still regress into direct lesson submit events or answer-dropping pages if they are outside the inventory.

## What Changes

- Replace or extend the module 5 gate inventory with a course-wide inventory.
- Use CourseEvidenceSpec and runtime manifests to enumerate response-producing steps.
- Fail when a student page bypasses useManifestSubmissionController or submitManifestStepResponse.
- Keep 5-3 through 5-6 as priority pre-class checks.

## Capabilities

### New Capabilities

- `course-data-quality-gates`

### Modified Capabilities

- None.

## Impact

- src/features/interactive/manifest-submission-gate-inventory.ts
- src/features/interactive/__tests__/*
- package.json test:course-data-quality-gates
