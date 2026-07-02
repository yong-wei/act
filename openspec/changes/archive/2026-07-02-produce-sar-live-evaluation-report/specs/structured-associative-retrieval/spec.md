## MODIFIED Requirements

### Requirement: SAR evaluation includes a multi-hop teaching demo
The system SHALL provide deterministic and live-evaluable SAR evidence for multi-hop teaching retrieval.

#### Scenario: Control-correction demo query is executed
- **WHEN** the demo asks why a learner should address frequency response margins before controller correction simulation and Arena validation
- **THEN** the SAR trace SHALL show LearningGoal, graph nodes, resources, learner evidence limitations, simulation/Arena evidence, Source Pack handoff, and verified citation outcomes where available.

#### Scenario: SAR live evaluation report is generated
- **WHEN** an administrator or evaluator generates a SAR live evaluation report
- **THEN** the report SHALL include representative queries, SAR-assisted candidate refs, ordinary retrieval baseline refs, multi-hop hit judgment, verified citation rate, Source Pack handoff, privacy rejection counts, candidate adoption or rejection, limitations, and at least two target-user feedback or structured test records
- **AND** SAR candidate refs SHALL remain distinct from verified citations.

#### Scenario: SAR evaluation report includes Arena results
- **WHEN** a SAR evaluation report references Arena score, validity, ranking, attempt policy, or evaluation metrics
- **THEN** those official outcomes SHALL be sourced only from persisted ArenaSubmission or official evaluation run records
- **AND** LearningFact, SAR trace, KAQ writeback, and learner evidence projections SHALL be labeled as auxiliary learning evidence context rather than official Arena outcomes.

#### Scenario: SAR evaluation report is exported or rendered
- **WHEN** the SAR evaluation report is displayed or exported
- **THEN** it SHALL omit raw learner answers, hidden Arena internals, private Konling memory, raw audit traces, and unverified candidate content presented as fact.
