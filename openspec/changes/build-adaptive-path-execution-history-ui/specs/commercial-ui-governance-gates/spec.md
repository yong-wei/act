## ADDED Requirements

### Requirement: Adaptive execution and history UI requires design-qa evidence
Commercial UI governance SHALL require visual evidence for adaptive path execution and history surfaces against the accepted handoff and concept images.

#### Scenario: Adaptive execution UI is reviewed
- **WHEN** current path execution, node detail, skip, or history UI changes
- **THEN** evidence SHALL include desktop and 320px mobile screenshots in light and dark themes
- **AND** it SHALL include active full-path map, current-node state, completed-node actions, skip warning, history timeline, and shared dock non-overlap.

#### Scenario: Visual subagent review runs
- **WHEN** implementation evidence is ready
- **THEN** a browser-capable visual subagent SHALL compare screenshots to the handoff, `03-active-path-execution.png`, and `04-history-evidence-record.png`
- **AND** unresolved BLOCK findings SHALL fail acceptance.
