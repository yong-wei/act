## ADDED Requirements

### Requirement: Arena challenge detail participates in adaptive path journeys
An Arena challenge detail opened from an adaptive path SHALL preserve the path launch context and expose the shared path journey control.

#### Scenario: Student opens a path-bound challenge
- **WHEN** a student opens `/arena/challenges/<taskId>` with a valid path launch context
- **THEN** the page SHALL identify the concrete challenge while showing `返回学习路径`, current path progress, and the current next-action state
- **AND** opening the detail page alone SHALL NOT mark the Arena node completed.

#### Scenario: Student enters the challenge workbench
- **WHEN** the student activates the challenge detail's primary workbench action
- **THEN** the destination SHALL preserve the same path id, node id, goal id, return target, resource type, and route intent
- **AND** publication, class, or season context SHALL remain intact when present.

#### Scenario: Challenge result is pending
- **WHEN** the Arena node requires a governed submission or preview result that is not yet bound
- **THEN** the challenge detail SHALL keep the next-node action unavailable
- **AND** it SHALL explain that the challenge result must be completed or synchronized before the path can continue.
