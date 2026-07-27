## MODIFIED Requirements

### Requirement: Path-launched resources expose continuous journey controls
Every governed path node type admitted to execution SHALL use a defined continuous-journey behavior. Platform-owned destinations for `interactive_lesson`, `knowledge_card`, `textbook_section`, `slides`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `reflection`, `checkpoint`, and `konling` SHALL expose the shared journey control either on the destination page or in the owning path-center activity. `external_resource` SHALL use the governed external fallback. Any page rendered with a valid path launch context SHALL expose no more than one visible action whose normalized target and user-facing semantics are equivalent to `返回学习路径`.

#### Scenario: Resource is still incomplete
- **WHEN** a path-launched resource has not produced accepted completion evidence
- **THEN** `返回学习路径` SHALL remain available exactly once within the active journey action surface
- **AND** the next action SHALL be disabled or replaced by an explicit blocked or pending-result status.

#### Scenario: Ready action duplicates the return action
- **WHEN** the projected ready, completion, or recovery action resolves to the same normalized href and return semantics as the journey return action
- **THEN** the journey control SHALL render only the owned `返回学习路径` action
- **AND** it SHALL NOT render the equivalent projected action as a second control.

#### Scenario: Resource completion advances the path
- **WHEN** the server accepts completion evidence and returns a ready next action with a different normalized target
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

#### Scenario: Resource opens outside a path
- **WHEN** a destination page has no valid path launch context
- **THEN** its normal contextual return action SHALL remain available
- **AND** the page SHALL NOT fabricate or duplicate a `返回学习路径` action.
