## MODIFIED Requirements

### Requirement: Classroom launch shall preserve class or temporary-session identity
Teacher launch flows SHALL require and display an explicit owned active class identity through one shared launch dialog, administrator launch flows MAY retain temporary identity, and all launch flows SHALL prevent accidental duplicate active sessions.

#### Scenario: Class-bound launch
- **WHEN** a teacher starts a lesson from any teacher launch surface
- **THEN** the shared launch dialog SHALL preselect the current owned active class when launched from a class route and otherwise preselect the teacher's valid default class
- **AND** the teacher SHALL be able to select another owned active class for that session
- **AND** the launch UI, projection header, QR/code dialog, student runtime, and session summary SHALL display the selected class identity
- **AND** duplicate active sessions for the same teacher, lesson, and class SHALL require explicit reuse or new-session confirmation.

#### Scenario: Teacher has no launchable class
- **WHEN** a teacher opens the shared launch dialog without any owned active class
- **THEN** the dialog SHALL show an unavailable state and a class-creation action
- **AND** classroom creation SHALL remain disabled.

#### Scenario: Teacher request omits or invalidates class identity
- **WHEN** a teacher classroom request omits `classId`, references another teacher's class, or references an inactive class
- **THEN** the API SHALL reject the request without silently substituting the default class
- **AND** it SHALL NOT create a classless teacher session.

#### Scenario: Administrator temporary launch
- **WHEN** an administrator starts a temporary classroom without a class id
- **THEN** the UI SHALL label it as temporary
- **AND** students SHALL not see raw session ids as the primary classroom identity.

#### Scenario: Existing classless teacher session is read
- **WHEN** an existing teacher session has no recorded class identity
- **THEN** the system SHALL preserve it as unattributed historical data
- **AND** it SHALL NOT infer or backfill the teacher's current default class.

#### Scenario: Existing classless teacher session finishes
- **WHEN** an existing classless teacher session transitions from active to finished
- **THEN** finalization SHALL leave its class identity unset
- **AND** participant profiles or the teacher's current default SHALL NOT be used as inferred historical attribution
- **AND** a later explicit teacher history-repair action MAY assign a reviewed class.

### Requirement: Generated classrooms bind an immutable published courseware revision
Classroom sessions launched from smart-preparation output SHALL bind the exact immutable published courseware revision and runtime manifest identity selected at launch, and teacher launches SHALL also bind an explicitly selected owned active class.

#### Scenario: Teacher launches generated courseware
- **WHEN** a teacher creates a classroom from a published generated courseware revision
- **THEN** the shared launch dialog SHALL require an owned active class selection
- **AND** the session SHALL store that class id, the courseware revision id, projected lesson-plan id, manifest hash, displayed courseware version, and plan-baseline version
- **AND** the launch and waiting surfaces SHALL identify the selected class and courseware revision to the teacher.

#### Scenario: Administrator launches generated courseware temporarily
- **WHEN** an administrator creates a temporary classroom from a published generated courseware revision without a class id
- **THEN** the session MAY retain temporary identity
- **AND** it SHALL store the courseware revision id, projected lesson-plan id, manifest hash, displayed courseware version, and plan-baseline version.

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
