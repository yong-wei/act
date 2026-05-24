## 1. Runtime Manifests

- [x] 1.1 Add `interactive-manifest.json` for 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4.
- [x] 1.2 Map every response-producing student step to a manifest activity kind and stable step id.
- [x] 1.3 Include objective reference answers or explicit unsupported-scoring metadata where automatic scoring is not possible.

## 2. Student Submission Migration

- [x] 2.1 Replace direct `COURSE_EVENT_TYPES.LESSON_SUBMIT` / `LESSON_RESUBMIT` calls in the seven student pages.
- [x] 2.2 Use `useManifestSubmissionController` and manifest step lookup helpers for every migrated response-producing step.
- [x] 2.3 Preserve custom panel, parameter, simulation, and calculation outputs as structured extra evidence.

## 3. Evidence Specs And Gates

- [x] 3.1 Register supported `CourseEvidenceSpec` mappings for all seven migrated lessons.
- [x] 3.2 Add the seven lessons to `COURSE_RESPONSE_PRODUCING_LESSON_INVENTORY` and `REQUIRED_RUNTIME_FIRST_GATE_LESSONS`.
- [x] 3.3 Extend gate tests to fail on direct submit events or missing manifest evidence coverage for these lessons.

## 4. Verification

- [x] 4.1 Run focused unit tests for the migrated early courses.
- [x] 4.2 Run `npm run test:course-data-quality-gates`.
- [x] 4.3 Run `npm run lint`.
