## ADDED Requirements

### Requirement: Generated classrooms bind an immutable published courseware revision
Classroom sessions launched from smart-preparation output SHALL bind the exact immutable published courseware revision and runtime manifest identity selected at launch.

#### Scenario: Teacher launches generated courseware
- **WHEN** a teacher creates a class-bound or temporary classroom from a published generated courseware revision
- **THEN** the session SHALL store the courseware revision id, projected lesson-plan id, manifest hash, displayed courseware version, and plan-baseline version
- **AND** the launch and waiting surfaces SHALL identify the selected courseware revision to the teacher.

#### Scenario: Courseware is revised after classroom creation
- **WHEN** a newer lesson-plan or courseware revision is created after a session has bound an earlier courseware revision
- **THEN** the existing session SHALL continue to render the originally bound manifest
- **AND** session evidence, responses, review, and finalization SHALL retain that original revision identity.

#### Scenario: Student joins a generated classroom
- **WHEN** an authorized student joins a classroom bound to generated courseware
- **THEN** the student runtime SHALL resolve only the published student projection for the bound revision
- **AND** it SHALL NOT read mutable smart-preparation drafts, teacher-only answers, provider audits, or newer unbound revisions.

#### Scenario: Generated revision is unavailable
- **WHEN** a session route cannot resolve its bound courseware revision or the manifest hash differs from the stored identity
- **THEN** the runtime SHALL show a product recovery state and record a deterministic integrity incident
- **AND** it SHALL NOT silently substitute the latest lesson or courseware revision.
