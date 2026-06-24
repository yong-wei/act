## ADDED Requirements

### Requirement: Simulation Product Design handoff alignment is governed
Commercial UI governance SHALL require virtual simulation UI implementations to prove alignment with the Product Design handoff before final simulation visual QA.

#### Scenario: Handoff-aligned simulation implementation is reviewed
- **WHEN** a PR implements this change
- **THEN** evidence SHALL include screenshots for `/simulations`, at least one heading-control detail page, at least one DP/positioning detail page, `/simulations/cruise`, and `/interactive-learning/control-workbench` regression where applicable
- **AND** each representative route SHALL identify the handoff section and concept image used as the visual/layout reference
- **AND** evidence SHALL state the selected `/virtual-lab` compatibility role and prove it does not conflict with `/simulations`
- **AND** evidence SHALL include the Control Workbench or course-embedded Concept 3 sample with both available-data and missing-data behavior where the route can produce those states
- **AND** missing handoff-source references SHALL fail acceptance.

### Requirement: Simulation handoff visual verification uses subagent review
The implementation SHALL use an independent subagent visual verification pass before acceptance.

#### Scenario: Visual verification is performed
- **WHEN** implementation screenshots and evidence are ready
- **THEN** a subagent SHALL be given `design-handoff.md`, the three concept image paths, and the produced implementation screenshots
- **AND** the subagent SHALL report pass/fail findings for accepted catalog structure, `/virtual-lab` compatibility role, accepted command-deck composition, accepted learning mission semantics, rejected model-status columns, rejected role switches, rejected duplicate assistant panels, dock non-overlap, keyboard-reachable collapse controls, mobile reachability, contrast, and theme parity
- **AND** unresolved blocking subagent findings SHALL prevent the change from being marked complete.

### Requirement: Final simulation visual QA waits for handoff alignment
The final simulation visual QA gate SHALL validate the handoff-aligned implementation, not the earlier partial visual baseline.

#### Scenario: Final simulation visual QA is evaluated
- **WHEN** `govern-simulation-experience-visual-qa` or its successor runs after this change is registered
- **THEN** it SHALL include this handoff-alignment change as a prerequisite or documented dependency
- **AND** it SHALL reject evidence that only proves route inventory, token usage, or nonblank scenes without handoff alignment.
