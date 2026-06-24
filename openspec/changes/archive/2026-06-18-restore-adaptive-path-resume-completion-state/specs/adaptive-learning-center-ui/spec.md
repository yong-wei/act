## ADDED Requirements

### Requirement: Adaptive path center restores the learner's current journey
The adaptive path center SHALL treat the learner's selected path as the default journey object when the student returns to the center.

#### Scenario: Active path exists and no deep link is supplied
- **WHEN** an authenticated student opens `/assessment/adaptive-practice` without `pathId`, `nodeId`, or a path-specific intent
- **THEN** the page SHALL load the latest active path for the current user and supported goal where available
- **AND** it SHALL render the path execution/resume workspace before cold-start generation or preset goal choices.

#### Scenario: Completed path exists and no active path exists
- **WHEN** an authenticated student opens the path center and the latest path is completed
- **THEN** the page SHALL show a completed-path summary with path name, completed node count, completion time when available, evidence status, and next recommended action
- **AND** it SHALL keep `生成新路径` or `切换目标` as secondary actions.

#### Scenario: No path exists
- **WHEN** no active, fallback, or completed path can be read for the student
- **THEN** the page SHALL render the cold-start generation state with student-facing language
- **AND** it SHALL NOT imply that a previously selected path was lost.

### Requirement: Path execution shows durable completion effects after return
The adaptive path center SHALL show node completion and next-node advancement from governed path execution state after students return from launched resources or re-enter the center.

#### Scenario: Path node completion is recorded
- **WHEN** a path node writes a governed `completed` execution event
- **THEN** the path center SHALL mark that node as completed, show its evidence or result state, and make the next eligible node the visible current node
- **AND** completed-node review and continued interaction SHALL remain separate from the original completion.

#### Scenario: Completion result is still pending
- **WHEN** a path node reports local completion but the required path execution or typed result reference is not yet bound
- **THEN** the path center SHALL show `结果待同步` or equivalent student-facing pending language
- **AND** dependent nodes SHALL remain blocked or locked until the required path execution state is available.

#### Scenario: Student leaves and returns later
- **WHEN** the student leaves the path center after selecting or completing part of a path and later returns
- **THEN** the selected path, completed nodes, current node, evidence summary, and alternatives SHALL remain visible without requiring the original selection URL.
