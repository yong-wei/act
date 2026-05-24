## Why

`/interactive-learning/courses/cruise-comfort-boppps` remains a premium special course built on legacy classroom code. It should stay as a course route, but its implementation must be rebuilt to the same runtime manifest, submission, evidence, and finalization standards as the unit lessons.

## What Changes

- Rebuild cruise-comfort as a standard interactive course with a runtime manifest and shared student/teacher session framework.
- Add a `CourseEvidenceSpec` and response-producing submission inventory for cruise-comfort.
- Route student responses through `useManifestSubmissionController` and `manifest-submission-v2`.
- Route teacher finalization through the unified finalization adapter.
- Delete legacy cruise classroom code that would remain as a parallel implementation path.

## Capabilities

### New Capabilities
- `cruise-comfort-standard-course`: Defines the standard-course contract for the rebuilt cruise-comfort BOPPPS route.

### Modified Capabilities

## Impact

- `src/app/interactive-learning/courses/cruise-comfort-boppps`
- `src/features/interactive/cruise-classroom`
- `src/lib/cruise-ai-contexts.ts`
- `src/lib/classroom-session-route.ts`
- `src/lib/session-lesson-snapshot.ts`
- Interactive catalog, quick join, route, evidence, and finalization tests.
