## MODIFIED Requirements

### Requirement: Challenge detail page is a read-only challenge entry
The challenge detail page SHALL present challenge information, rules, related knowledge, leaderboard summary, and a unified control-workbench entry; it MUST NOT provide controller parameter submission or local simulation execution.

#### Scenario: Detail page has no submission form
- **WHEN** a challenge detail page renders
- **THEN** it SHALL NOT render `ArenaSubmissionPanel`
- **AND** it SHALL NOT render `ArenaBlackBoxSubmissionPanel`
- **AND** it SHALL render a single workbench entry link resolved from the task and object routing rules

#### Scenario: Workbench is the only official submit surface
- **WHEN** a student wants to submit a solution for a supported workbench challenge
- **THEN** the student SHALL submit through the corresponding workbench
- **AND** the challenge detail page SHALL only explain that simulation and submission occur in the control workbench

#### Scenario: Unified entry label
- **WHEN** the challenge detail page renders its primary workbench call to action
- **THEN** the visible button text MUST be `进入控制工作台`
- **AND** the page MUST NOT use old primary entry labels such as `进入多表征工作台`, `进入黑箱仿真`, or `进入 MPC 课程`

#### Scenario: Recommended method context remains visible
- **WHEN** the challenge detail page renders a task with allowed methods
- **THEN** it SHALL still show the allowed methods or recommended preset context
- **AND** this context MUST NOT replace the unified primary entry label

## ADDED Requirements

### Requirement: Arena hall uses unified control-workbench entry language
The Arena hall SHALL describe task entry with the unified control workbench concept rather than exposing legacy implementation routes.

#### Scenario: Task card entry language
- **WHEN** an Arena task card renders for a non-Odyssey task
- **THEN** it MUST use control-workbench entry language
- **AND** it MUST avoid presenting legacy route names as the primary student action

#### Scenario: Odyssey task card exception
- **WHEN** an Arena task card renders for a Control Odyssey task
- **THEN** it MAY preserve Odyssey-specific entry language
- **AND** it MUST still preserve the Arena task context in the link
