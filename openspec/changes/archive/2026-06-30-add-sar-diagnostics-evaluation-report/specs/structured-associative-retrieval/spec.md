## ADDED Requirements

### Requirement: SAR exposes diagnostics and evaluation traces
The system SHALL expose privacy-safe diagnostics for SAR projection and query behavior.

#### Scenario: Administrator reviews SAR health
- **WHEN** an administrator opens SAR diagnostics or requests the SAR report payload
- **THEN** the system SHALL expose event count, entity count, relation count, source type counts, privacy scope counts, query trace summaries, hop counts, privacy rejection counts, limitation counts, and downstream verified citation rate where available.

#### Scenario: SAR trace is serialized
- **WHEN** a SAR query trace is persisted, displayed, or exported
- **THEN** the trace SHALL include seed entities, expanded entities, selected events, rejected refs, limitations, version refs, and downstream citation/source-pack handoff state
- **AND** it SHALL omit raw private evidence and hidden internals.

### Requirement: SAR evaluation includes a multi-hop teaching demo
The system SHALL provide a deterministic SAR demo fixture for multi-hop teaching retrieval.

#### Scenario: Control-correction demo query is executed
- **WHEN** the demo asks why a learner should address frequency response margins before controller correction simulation and Arena validation
- **THEN** the SAR trace SHALL show LearningGoal, graph nodes, resources, learner evidence limitations, simulation/Arena evidence, Source Pack handoff, and verified citation outcomes where available.
