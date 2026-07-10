## ADDED Requirements

### Requirement: Arena path nodes bind concrete challenge tasks
Every path-plannable `arena_task` ResourceNode SHALL bind a stable Arena task identity and a verified concrete challenge route.

#### Scenario: Arena task enters the path registry
- **WHEN** an Arena task is promoted to a path-plannable or terminal-validation node
- **THEN** its stable node id SHALL be based on `arena-task:<taskId>`, its source kind and source reference SHALL identify the Arena task, and its launch target SHALL resolve to `/arena/challenges/<taskId>`
- **AND** the referenced task SHALL exist in the governed Arena task catalog.

#### Scenario: Arena task uses a generic or placeholder target
- **WHEN** an `arena_task` node points to `/arena`, uses a knowledge node as its source identity, lacks a task id, or resolves to an unknown challenge
- **THEN** registry or fixture validation SHALL mark it path-ineligible
- **AND** path execution SHALL block or repair the target from a verified stable task mapping rather than launch the Arena hall.

#### Scenario: Persisted path contains a legacy Arena target
- **WHEN** a restored path contains an Arena node with a generic or invalid target
- **THEN** the system SHALL repair it only when a unique verified task mapping exists
- **AND** otherwise SHALL require path regeneration or an explicit recovery action without treating the node as executable.
