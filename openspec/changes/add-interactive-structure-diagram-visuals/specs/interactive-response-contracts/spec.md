## ADDED Requirements

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
