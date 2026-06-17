## ADDED Requirements

### Requirement: Interactive visual component QA is contract-gated
Commercial UI governance SHALL treat the Product Design visual component contract as an acceptance gate for interactive course visual components.

#### Scenario: Visual component implementation is reviewed
- **WHEN** a change implements or modifies `visual.stage`, `visual.derivationStage`, `visual.blockDiagram`, `visual.signalFlowGraph`, `visual.annotatedMedia`, embedded visual activities, or course-embedded control workbench capabilities
- **THEN** acceptance evidence SHALL include design contract path, visual source path, student screenshot, teacher screenshot, light theme screenshot, dark theme screenshot, non-default state screenshot, manifest audit, tests, and backend evidence sample
- **AND** missing evidence SHALL fail the gate.

#### Scenario: Browser audit is role-incomplete
- **WHEN** browser audit only covers the student role or only covers the teacher role
- **THEN** visual component QA SHALL fail
- **AND** the audit report SHALL identify the missing role and route.

### Requirement: Interactive visual component blockers are enforced
Commercial UI governance SHALL block visual component completion when contract blockers are present.

#### Scenario: Blocking visual regression is detected
- **WHEN** a visual component uses course-private duplicate control panels, a generic `interactive-figure` carrier, a derivation card list, image-only formulas, missing formula block color roles, static-only diagrams that should produce evidence, unrecorded hotspots, missing teacher diagnostics, or visible engineering semantics
- **THEN** the component SHALL be marked blocking
- **AND** the implementation SHALL NOT be accepted until the blocker is fixed and re-audited.

### Requirement: Interactive visual components support light and dark themes
Commercial UI governance SHALL require light and dark theme evidence for interactive visual components.

#### Scenario: Component has only one theme screenshot
- **WHEN** an implementation acceptance artifact lacks either light or dark theme screenshot evidence
- **THEN** the visual gate SHALL fail
- **AND** the missing theme SHALL be reported for the affected component.
