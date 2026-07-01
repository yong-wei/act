## ADDED Requirements

### Requirement: Classroom lifecycle actions shall use product states
Classroom launch, reuse, join, projection, finalization, deletion, and review-entry actions SHALL use product-owned lifecycle states and recovery paths.

#### Scenario: an active classroom already exists
- **WHEN** a teacher launches a class-bound or temporary classroom and an active compatible session exists
- **THEN** the UI SHALL offer reuse, create-new, and cancel choices with explicit class/session identity and no native confirm dependency.

#### Scenario: a student joins with an invalid or unavailable classroom code
- **WHEN** a classroom code is malformed, not found, expired, closed, full, or unauthorized
- **THEN** the UI and API SHALL expose the same recovery category and next action.

#### Scenario: a classroom is ended or deleted
- **WHEN** a teacher ends an active classroom or deletes an ended classroom
- **THEN** the UI SHALL show impact preview, product confirmation, execution status, and post-action recovery.
- **AND** students and direct teacher links SHALL render the correct ended or unavailable state.

### Requirement: Classroom runtime variants shall share lifecycle semantics
Class-bound, temporary, demo, and real session runtime variants SHALL share launch, projection, end, and recovery semantics where the action is lifecycle-owned.

#### Scenario: a teacher opens projection or runtime direct links
- **WHEN** a teacher opens a waiting, projection, runtime, or ended direct link
- **THEN** the page SHALL recover the session state or show a product recovery state without normal live-state misrepresentation.

### Requirement: Classroom lifecycle audit closure shall be evidence backed
Classroom lifecycle findings SHALL be closed only with linked implementation evidence.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference tests, UI evidence, and residual scope.
