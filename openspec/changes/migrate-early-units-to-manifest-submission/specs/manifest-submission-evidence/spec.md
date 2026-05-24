## ADDED Requirements

### Requirement: Early unit response pages use manifest submission evidence
The system SHALL route response-producing steps in 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 through the shared manifest submission evidence path.

#### Scenario: Early unit submit uses shared controller
- **WHEN** a student submits a response-producing step in 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, or 3-4
- **THEN** the student page SHALL submit through `useManifestSubmissionController`
- **AND** the emitted event payload SHALL use the `manifest-submission-v2` evidence envelope.

#### Scenario: Direct lesson submit bypass is removed
- **WHEN** migrated early unit student pages are inspected
- **THEN** they SHALL NOT call `trackCourseEvent` directly with `COURSE_EVENT_TYPES.LESSON_SUBMIT` or `COURSE_EVENT_TYPES.LESSON_RESUBMIT`
- **AND** no lesson-local wrapper SHALL preserve the old direct-submit behavior.

#### Scenario: Custom early unit evidence is preserved
- **WHEN** a migrated early unit submits parameter, calculation, simulation, or workspace output
- **THEN** the shared submission path SHALL include that output as structured extra evidence associated with the manifest step
- **AND** post-class analysis SHALL NOT depend only on mutable student state to recover the submitted result.
