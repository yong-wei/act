## ADDED Requirements

### Requirement: Current Authority detail includes governed learning media
The current Authority node detail SHALL include eligible Knowledge Card content and accepted infographs when available and authorized. Long-form learning media SHALL remain in the inspector and SHALL NOT replace semantic nodes or published relation topology on the canvas.

#### Scenario: Node detail has governed media
- **WHEN** a selected Authority object has eligible card and infograph projections
- **THEN** the inspector SHALL present them after semantic identity and explanation
- **AND** the canvas SHALL remain the primary graph representation

#### Scenario: Governed media is unavailable
- **WHEN** the selected object has no eligible card or infograph, or the current shard Teaching binding is unavailable
- **THEN** semantic detail and published relation summaries SHALL remain available
- **AND** the UI SHALL omit the unavailable media panels and not expose internal asset or review identity
