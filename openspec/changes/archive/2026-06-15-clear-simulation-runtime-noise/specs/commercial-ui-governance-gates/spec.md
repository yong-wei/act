## ADDED Requirements

### Requirement: Simulation visual QA records runtime noise
Commercial UI visual QA SHALL record page errors and tracked simulation console warnings with each simulation screenshot manifest.

#### Scenario: Simulation screenshot evidence is captured
- **WHEN** local visual QA captures a simulation detail route
- **THEN** the evidence manifest SHALL include route, theme, viewport, screenshot path, page errors, and tracked console warnings
- **AND** known error-level findings or tracked simulation warnings SHALL fail the relevant simulation QA profile unless a temporary exception names the owner and removal condition.

### Requirement: Simulation QA rejects noisy final baselines
Commercial UI governance SHALL reject final simulation visual baselines that still include known shared runtime errors.

#### Scenario: Final simulation QA is evaluated
- **WHEN** final simulation QA reviews all detail routes
- **THEN** the known `classList` null error and known Three.js deprecation warnings SHALL be absent from the accepted baseline
- **AND** the reviewer SHALL NOT classify those messages as harmless screenshot noise without a documented technical disposition.
