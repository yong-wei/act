## ADDED Requirements

### Requirement: Konling coaching is path-aware and citation-enforced
Konling SHALL provide control-correction coaching from server-owned path context and SHALL attach required citations to coaching claims.

#### Scenario: Control-correction coaching starts
- **WHEN** Konling handles a message in a control-correction learning path context
- **THEN** it SHALL load server-owned page context, learner-state slice, active path round, current node, recent evidence, memory summaries, permitted tools, and citation requirements
- **AND** client-provided page hints SHALL NOT expand user, class, resource, path, or privacy scope.

#### Scenario: Personalized recommendation is generated
- **WHEN** Konling recommends a next action, fallback path, readiness decision, or correction step
- **THEN** the response SHALL include at least one content citation and at least one learner, path, execution, simulation, Arena, or intervention evidence citation where available
- **AND** missing or low-confidence evidence SHALL be disclosed as a limitation.

#### Scenario: Simulation or Arena failure is analyzed
- **WHEN** Konling analyzes a simulation failure or Arena submission issue
- **THEN** it SHALL cite the relevant run, summary, replay, official submission, or governed evidence reference plus an instructional content reference
- **AND** it SHALL NOT expose hidden official evaluation internals, raw high-frequency traces, or private memory payloads by default.

#### Scenario: Intervention outcome is captured
- **WHEN** a student accepts, ignores, rejects, or partially accepts a Konling control-correction intervention
- **THEN** the runtime SHALL persist the outcome with path id, node id, evidence references, privacy-safe summary, and confidence state
- **AND** the outcome SHALL be available to governed evidence or feature-cache refresh.
