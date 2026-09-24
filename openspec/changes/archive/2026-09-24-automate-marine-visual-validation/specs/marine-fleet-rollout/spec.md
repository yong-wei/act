## ADDED Requirements

### Requirement: Marine visual acceptance runs deterministically without routine manual steps
Marine acceptance SHALL execute named real-scene sequences and local quality checks automatically, without requiring manual screenshots or another physical device.

#### Scenario: A local acceptance run starts
- **WHEN** The configured M5 reference host runs the suite
- **THEN** The suite produces deterministic actual-output checks, images and failure locations for the active fleet consumers.

### Requirement: Visual tests preserve real dynamics and feature fidelity
Quality checks SHALL detect declared artifacts and missing features without rewarding frozen waves, excessive blur or disabled effects.

#### Scenario: A feature is intentionally removed in a test
- **WHEN** The diagnostic scene disables a required reflection or introduces a wrong ocean plane
- **THEN** The validation detects the defect instead of accepting a nonblank image.
