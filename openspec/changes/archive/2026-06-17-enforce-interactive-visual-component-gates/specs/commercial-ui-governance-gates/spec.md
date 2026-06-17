## ADDED Requirements

### Requirement: Interactive visual component QA is contract-gated
Commercial UI governance SHALL treat the Product Design visual component contract as an acceptance gate for interactive course visual components.

#### Scenario: Visual component implementation is reviewed
- **WHEN** a change implements or modifies `visual.stage`, `visual.derivationStage`, `visual.blockDiagram`, `visual.signalFlowGraph`, `visual.annotatedMedia`, embedded visual activities, or course-embedded control workbench capabilities
- **THEN** acceptance evidence SHALL include design contract path, visual source path, teaching mapping, student screenshot matrix, teacher screenshot matrix, light theme screenshot, dark theme screenshot, mobile screenshot, desktop screenshot, projection screenshot, manifest audit, tests, browser audit, and backend evidence sample
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

### Requirement: Interactive visual components cover required state and viewport matrices
Commercial UI governance SHALL require component-specific role, state, theme, and viewport matrices for interactive visual components.

#### Scenario: Component state matrix is incomplete
- **WHEN** a visual component acceptance artifact lacks student unreleased, student released, student submitted, teacher reveal or derivation-in-progress, teacher answer reveal, or teacher diagnostic aggregation evidence
- **THEN** visual component QA SHALL fail
- **AND** the missing state SHALL identify component id, route, role, theme, and viewport.

#### Scenario: Component-specific state is missing
- **WHEN** a block or signal-flow diagram lacks graph constructed evidence
- **OR** annotated media lacks selected-hotspot evidence
- **THEN** visual component QA SHALL fail
- **AND** the report SHALL identify the missing component-specific state.

#### Scenario: Viewport matrix is incomplete
- **WHEN** visual component evidence lacks mobile, desktop, or projection viewport coverage
- **THEN** visual component QA SHALL fail
- **AND** the missing viewport SHALL be reported for the affected component.

#### Scenario: Responsive safety fails
- **WHEN** a screenshot or browser audit shows horizontal overflow, teacher controls covering the primary stage, or unreadable labels in a required viewport
- **THEN** visual component QA SHALL fail
- **AND** the failure SHALL be treated as a blocking product QA regression.

### Requirement: Interactive visual component screenshots are traceable
Commercial UI governance SHALL require screenshot evidence to be traceable to a component, route, role, theme, viewport, and state.

#### Scenario: Screenshot naming is ambiguous
- **WHEN** screenshot evidence does not encode or declare `componentId`, `route`, `role`, `theme`, `viewport`, and `state`
- **THEN** visual component QA SHALL fail
- **AND** repeated screenshots SHALL NOT satisfy multiple matrix cells unless the artifact explicitly proves the same rendered state is intentional.

### Requirement: Interactive visual components are keyboard and focus accessible
Commercial UI governance SHALL require keyboard reachability, visible focus, and teaching-semantic labels for interactive visual components.

#### Scenario: Interactive visual control is not keyboard reachable
- **WHEN** hotspots, graph nodes, graph paths, formula blocks, reveal controls, or embedded activity anchors cannot be reached and operated by keyboard or an equivalent accessible mechanism
- **THEN** visual component QA SHALL fail
- **AND** the affected target SHALL be named in the accessibility report.
