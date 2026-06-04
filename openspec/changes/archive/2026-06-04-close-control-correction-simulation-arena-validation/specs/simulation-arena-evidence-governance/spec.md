## ADDED Requirements

### Requirement: Simulation and Arena evidence supports path terminal validation
Governed simulation and Arena evidence SHALL expose privacy-safe validation summaries for control-correction learning paths.

#### Scenario: Path validation reads simulation evidence
- **WHEN** a control-correction path evaluates a simulation validation node
- **THEN** it SHALL consume governed SimulationRun or evidence summary references with task id, owner user, summary metrics, replay confidence, provenance, and confidence state
- **AND** it SHALL NOT scan or expose raw high-frequency trace payloads for normal validation.

#### Scenario: Path validation reads Arena evidence
- **WHEN** a control-correction path evaluates an Arena validation node
- **THEN** it SHALL distinguish preview, official submission, official evaluation, score, validity, replay confidence, and hidden-internal boundaries
- **AND** it SHALL NOT expose hidden official evaluation internals through path, student, or Konling payloads.
