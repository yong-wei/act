## Purpose

Define the canonical response vocabulary for manifest-driven interactive lesson
activity cards so rendering, scoring, submission evidence, and governance
classification use the same response semantics while legacy manifests are
migrated.
## Requirements
### Requirement: Response kinds are canonical
The system SHALL define a finite canonical response vocabulary for manifest activity cards.

#### Scenario: New activity uses canonical response kind
- **WHEN** a new or migrated activity card collects an answer
- **THEN** its response kind SHALL be one of `choice.single`, `choice.binary`, `choice.multi`, `text.short`, `text.long`, `text.structured`, `parameter.set`, `ordering.sequence`, `matching.pairs`, `table.builder`, `simulation.result`, or `training.result`
- **AND** historical names SHALL be accepted only through explicit alias normalization during migration.

### Requirement: Response aliases normalize predictably
The system SHALL normalize legacy response names to canonical response kinds before scoring or evidence classification.

#### Scenario: Text aliases normalize to text response
- **WHEN** a legacy activity uses `fill_text`, `text`, `short_response`, `short_text`, or `observation_text`
- **THEN** the activity SHALL normalize to a canonical text response kind
- **AND** the original alias MAY be retained only as trace metadata.

#### Scenario: Matching aliases normalize to matching response
- **WHEN** a legacy activity uses `drag_match`, `triple_match`, or `match`
- **THEN** the activity SHALL normalize to `matching.pairs`
- **AND** scoring SHALL compare item-option structure rather than answer text order.

#### Scenario: Ordering aliases normalize to ordering response
- **WHEN** a legacy activity uses `drag_sort` or `card_sort`
- **THEN** the activity SHALL normalize to `ordering.sequence`
- **AND** scoring SHALL preserve partial structure detail.

### Requirement: Derivation answers preserve reveal context
Responses collected from a derivation stage SHALL preserve the reveal step context in which the student answered.

#### Scenario: Student answers during a reveal step
- **WHEN** a student submits an answer from a derivation stage
- **THEN** the response payload SHALL include the active reveal step id, max reveal step seen, visited reveal step ids, and referenced formula block ids when applicable
- **AND** scoring and teacher review SHALL NOT treat answers from different reveal contexts as indistinguishable.

#### Scenario: Student revises after more reveal steps
- **WHEN** a student submits again after additional reveal steps become visible
- **THEN** the response evidence SHALL preserve the earlier reveal-context answer and the later reveal-context answer
- **AND** teacher diagnostics SHALL be able to show where understanding changed.

#### Scenario: Derivation feedback is generated
- **WHEN** derivation-stage feedback is generated for a student response
- **THEN** the response payload SHALL support misconception tag ids, student feedback mode, teacher next prompt, and retry or review action
- **AND** the feedback SHALL be tied to the active reveal step and formula block ids.

### Requirement: Structure diagram responses preserve graph evidence
Responses collected from block diagrams and signal-flow graphs SHALL preserve graph-specific selections and constructed states.

#### Scenario: Student selects a feedback path
- **WHEN** a student selects a path, loop, node, branch, or feedback structure
- **THEN** the response payload SHALL include selected graph element ids, teaching labels, interaction mode, and active reveal state
- **AND** scoring SHALL compare graph structure rather than only answer text.

#### Scenario: Student constructs a graph
- **WHEN** a student drags or creates graph elements
- **THEN** the response payload SHALL include element positions, connections, unmatched elements, missing reference elements, and extra elements
- **AND** teacher review SHALL be able to display the structural difference.

#### Scenario: Structure diagram feedback is generated
- **WHEN** feedback is generated for a block diagram or signal-flow graph response
- **THEN** the response payload SHALL support misconception tag ids, student feedback mode, teacher next prompt, and retry or review action
- **AND** the feedback SHALL reference teaching labels for affected nodes, paths, loops, or branches.

### Requirement: Annotated media responses preserve selected evidence
Responses collected from annotated media and embedded visual activities SHALL preserve selected visual evidence and activity context.

#### Scenario: Student selects image evidence
- **WHEN** a student selects annotations or hotspots in annotated media
- **THEN** the response payload SHALL include annotation ids, evidence roles, active reveal state, and any embedded activity answer
- **AND** scoring SHALL be able to distinguish correct evidence from plausible but wrong hotspots.

#### Scenario: Embedded activity submits from a visual surface
- **WHEN** a student submits an answer from inside a visual stage or annotated media surface
- **THEN** the response payload SHALL conform to the canonical activity response contract
- **AND** it SHALL include the visual module id and anchor id.

#### Scenario: Annotated media feedback is shown
- **WHEN** annotated media or embedded visual activity feedback is generated
- **THEN** the response payload SHALL support misconception tag ids, student feedback mode, teacher next prompt, and retry or review action
- **AND** the feedback fields SHALL be suitable for immediate feedback, teacher-led feedback, or post-class review.

