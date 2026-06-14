## ADDED Requirements

### Requirement: Knowledge graph interaction QA blocks jitter regressions
Commercial UI governance SHALL verify that knowledge graph hover, selection, inspector, and drag interactions do not create visible layout jitter.

#### Scenario: Knowledge graph interaction evidence is captured
- **WHEN** governance validates `/knowledge` interaction states
- **THEN** evidence SHALL include hover preview, node selection, inspector open/close, user drag, and explicit relayout states
- **AND** the evidence SHALL prove that hover and selection do not trigger unintended graph redistribution.

#### Scenario: Jitter regression is detected
- **WHEN** pointer hover, node click, or inspector updates visibly reset layout, move unrelated nodes, or remount the graph surface
- **THEN** governance SHALL fail or report a blocking interaction-stability regression.
