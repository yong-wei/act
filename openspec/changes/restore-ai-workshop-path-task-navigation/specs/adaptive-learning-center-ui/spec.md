## MODIFIED Requirements

### Requirement: Adaptive path center isolates route-intent workspaces
The adaptive learning center SHALL render one primary workspace per route intent. A path task launched from a governed student surface SHALL preserve the goal, path, node, and `path-execution` intent needed to render the specified path task.

#### Scenario: Landing intent is opened
- **WHEN** a student opens `/assessment/adaptive-practice` without an intent
- **THEN** the page SHALL prioritize continuing the current path, generating a new path, or reviewing evidence
- **AND** it SHALL NOT render unselectable preset goals or all downstream states as the main scroll content.

#### Scenario: Path execution intent is opened for a specified node
- **WHEN** a student opens `intent=path-execution` with a valid goal, path ID, and node ID
- **THEN** the page SHALL render the selected path map, the specified node detail, its authoritative current or locked state, and the evidence summary as the primary workspace
- **AND** the generation panel SHALL be closed unless the student explicitly opens an adjustment action
- **AND** a locked specified node SHALL remain inspectable but SHALL NOT start an exercise until its readiness conditions are satisfied.

#### Scenario: Path execution intent is incomplete or invalid
- **WHEN** a student opens `intent=path-execution` without a valid goal, path ID, node ID, or authorized path context
- **THEN** the page SHALL render a truthful recovery state
- **AND** it SHALL NOT silently enter the generic practice workspace or infer a node from a title or array position.

#### Scenario: Evidence review intent is opened
- **WHEN** a student opens `intent=evidence-review` with a path id
- **THEN** the page SHALL render path completion overview, timeline, selection or adjustment history, node results, Konling interventions, skip and return records, and evidence labels as the primary workspace.

### Requirement: Student path intents shall render truthful recovery states
Adaptive path selection, execution, evidence review, and bad path contexts SHALL render truthful student-facing states instead of normal progress when the backing path or evidence is unavailable. Route parameters SHALL be treated as navigation hints only; the server SHALL re-confirm the authenticated student's ownership and the requested node's membership and readiness.

#### Scenario: `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **WHEN** `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **THEN** the page SHALL explain the missing context, preserve the intended action, and offer generation, evidence review, or return actions.

#### Scenario: A path task points to a stale or unauthorized node
- **WHEN** a path task URL references a path or node that is missing, no longer belongs to the authenticated student, or is not a member of the selected path
- **THEN** the server SHALL reject the requested execution context or return a truthful recovery state
- **AND** the page SHALL not expose another student's path data or fabricate progress
- **AND** the student SHALL receive a real action to return to the path center or reload the current path.

#### Scenario: a path node launches a resource
- **WHEN** a path node launches a resource
- **THEN** returning to the center SHALL restore path id, node id, goal id, completion state, and evidence summary when available.

