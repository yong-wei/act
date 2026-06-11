## ADDED Requirements

### Requirement: Prep packs can become runtime enhancement overlays
Approved teacher prep-pack items SHALL be persistable as course enhancement packs that overlay course runtime without mutating base content.

#### Scenario: Enhancement pack is created
- **WHEN** a teacher chooses to prepare runtime insertion from approved prep-pack items
- **THEN** the system SHALL persist pack id, teacher id, class id, goal id, lesson id, source diagnosis, evidence references, insertion targets, item payloads, status, and timestamps
- **AND** draft or rejected prep-pack items SHALL NOT be eligible for activation.

#### Scenario: Enhancement pack is previewed
- **WHEN** a teacher previews an enhancement pack
- **THEN** the preview SHALL show insertion points, generated or linked resources, evidence basis, estimated time, privacy scope, and runtime diff
- **AND** the preview SHALL not publish content to students.

### Requirement: Runtime overlays are teacher-activated and reversible
Course enhancement packs SHALL require teacher activation before affecting student runtime and SHALL remain reversible.

#### Scenario: Pack is activated
- **WHEN** a teacher activates an enhancement pack
- **THEN** only approved items with valid insertion targets SHALL be merged into authorized class or session runtime
- **AND** the merge output SHALL retain pack id, item id, activation metadata, and source evidence references.

#### Scenario: Pack is rolled back
- **WHEN** a teacher rolls back or archives an enhancement pack
- **THEN** student runtime SHALL stop displaying the overlay
- **AND** the base course manifest and authoring content SHALL remain unchanged.

### Requirement: Enhancement impact is traceable
Activated enhancement packs SHALL be linkable to subsequent learning evidence and teacher feedback.

#### Scenario: Post-class evidence is collected
- **WHEN** students interact with content inserted by an enhancement pack
- **THEN** generated learning evidence SHALL reference the pack item where safe
- **AND** teacher reports SHALL be able to compare post-activation evidence with the diagnosis that motivated the pack.
