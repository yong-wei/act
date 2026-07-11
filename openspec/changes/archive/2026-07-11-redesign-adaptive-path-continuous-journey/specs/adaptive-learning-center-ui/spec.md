## ADDED Requirements

### Requirement: Path execution uses a compact inline journey
The adaptive learning center SHALL render an active path as a compact ordered journey whose focused node expands in place with its details and actions.

#### Scenario: Student scans a long path
- **WHEN** an active path contains multiple completed, current, future, or locked nodes
- **THEN** the UI SHALL render compact node summaries connected by a continuous adaptive line
- **AND** the current and focused nodes SHALL remain identifiable without requiring the student to scroll to a separate detail panel.

#### Scenario: Student focuses a node
- **WHEN** the student activates a path node
- **THEN** that same node container SHALL expand to show its recommendation reason, estimated time, evidence, checkpoint or result state, and allowed actions
- **AND** another previously expanded node SHALL collapse.

#### Scenario: Path execution renders on a narrow viewport
- **WHEN** the execution workspace renders at a width from 320px to 375px
- **THEN** module titles, summaries, current-node labels, metrics, nodes, and actions SHALL reflow without single-character columns, overlap, clipping, or horizontal page scrolling.

### Requirement: Path nodes distinguish resource type from execution state
The adaptive learning center SHALL encode resource type and execution state as separate accessible visual dimensions.

#### Scenario: Mixed resource path renders
- **WHEN** a path contains knowledge, lesson, assessment, simulation, control-workbench, Arena, reflection, external-resource, or Konling nodes
- **THEN** each resource type SHALL use a stable low-saturation semantic tone limited to node markers, accent edges, icons, or soft local backgrounds together with a visible type label
- **AND** current, completed, skipped, blocked, and locked states SHALL use independent icons, labels, borders, or availability cues.

#### Scenario: Color information is unavailable
- **WHEN** a student cannot distinguish the resource or state colors
- **THEN** the icon, text label, state label, and control availability SHALL still identify both resource type and execution state.

### Requirement: Path execution prioritizes the active learning task
The path execution intent SHALL place the compact journey and current action before secondary summaries and management surfaces.

#### Scenario: Active path execution opens
- **WHEN** the route intent is `path-execution`
- **THEN** the page SHALL show a compact path heading, essential progress, and the journey before learning history, resource entry, or management modules
- **AND** it SHALL NOT repeat equivalent hero, recommendation, current-node, and six-card statistics as equal-priority regions.

### Requirement: Path-launched resources expose continuous journey controls
Every governed path node type admitted to execution SHALL use a defined continuous-journey behavior. Platform-owned destinations for `interactive_lesson`, `knowledge_card`, `textbook_section`, `slides`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `reflection`, `checkpoint`, and `konling` SHALL expose the shared journey control either on the destination page or in the owning path-center activity. `external_resource` SHALL use the governed external fallback.

#### Scenario: Resource is still incomplete
- **WHEN** a path-launched resource has not produced accepted completion evidence
- **THEN** `返回学习路径` SHALL remain available
- **AND** the next action SHALL be disabled or replaced by an explicit blocked or pending-result status.

#### Scenario: Resource completion advances the path
- **WHEN** the server accepts completion evidence and returns a ready next action
- **THEN** the resource surface SHALL enable a visible action naming the next node
- **AND** the student SHALL be able to enter that node without first returning to the path center.

#### Scenario: Path-center activity completes
- **WHEN** an adaptive assessment, checkpoint, reflection, or Konling activity is executed inside the path center
- **THEN** the owning node SHALL retain the same inline journey control and update its next action from the accepted completion response
- **AND** the student SHALL NOT need to close the activity and activate `开始学习` again.

#### Scenario: External resource cannot host journey controls
- **WHEN** an `external_resource` target leaves the platform
- **THEN** the platform SHALL keep the path center available while opening the external target in a separate browsing context
- **AND** returning to the path center SHALL refresh journey state and use governed explicit-access or completion evidence before enabling the next node without requiring another `开始学习` action.

#### Scenario: Owned destination lacks journey integration
- **WHEN** a platform-owned path target has not implemented the shared journey control or owning path-center behavior
- **THEN** the node SHALL NOT be presented as continuous-journey ready
- **AND** the UI SHALL expose a verifiable fallback or block execution rather than silently lose path context.

#### Scenario: Final node completes
- **WHEN** accepted completion leaves no further executable node
- **THEN** the journey control SHALL show path completion or terminal-validation status
- **AND** its primary continuation SHALL lead to the same path's summary rather than fabricate another node.
