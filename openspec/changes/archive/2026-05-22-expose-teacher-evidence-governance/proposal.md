## Why

Teachers need to know which class and student insights are trustworthy, which students need evidence collection, and which sessions should not be used directly for evaluation.

## What Changes

- Add evidence state, confidence level, evidence count, source coverage, status markers, and last evidence time to class insight students.
- Add feature cache coverage to class governance summary.
- Add recent session quality aggregation.
- Add individual evidence drawer data with recent facts, durable submissions, and session report quality.

## Capabilities

### New Capabilities

- `teacher-evidence-governance`

### Modified Capabilities

- None.

## Impact

- src/app/api/teacher/classes/[classId]/insights/route.ts
- src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts
- teacher class and student pages
