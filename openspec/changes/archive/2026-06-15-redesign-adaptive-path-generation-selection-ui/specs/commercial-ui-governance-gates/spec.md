## ADDED Requirements

### Requirement: Adaptive generation UI requires design-qa evidence
Commercial UI governance SHALL require visual evidence for the adaptive path generation and selection UI against the accepted handoff and concept images.

#### Scenario: Adaptive generation UI is reviewed
- **WHEN** `/assessment/adaptive-practice` generation or selection UI changes
- **THEN** evidence SHALL include desktop and 320px mobile screenshots in light and dark themes
- **AND** it SHALL include generation main state, Konling parameter state, path comparison state, cold-start state, and shared dock non-overlap.

#### Scenario: Visual subagent review runs
- **WHEN** implementation evidence is ready
- **THEN** a browser-capable visual subagent SHALL compare screenshots to the handoff and concept images
- **AND** unresolved BLOCK findings SHALL fail acceptance.
