# marine-fleet-rollout Specification

## Purpose
TBD - created by archiving change migrate-fleet-marine-scenes. Update Purpose after archive.
## Requirements
### Requirement: All marine consumers use one scene architecture
All seven marine simulation routes and their active embedded consumers SHALL use the shared marine architecture with profile-level differences only.

#### Scenario: The dredger route is integrated
- **WHEN** the final marine route mounts its scene
- **THEN** it uses existing shared modules without adding experiment-specific logic to them

### Requirement: Fleet migration preserves existing capabilities
Migration SHALL preserve numerical behavior, camera interaction, task UI, audio policy, model semantics and annotation behavior.

#### Scenario: A migrated teaching run is replayed
- **WHEN** the same control inputs and numerical seed are used
- **THEN** numerical outputs and evaluation remain equivalent to the baseline and established user interactions remain available

### Requirement: Fleet acceptance uses real active paths
Acceptance SHALL cover the active production consumers and SHALL include dynamic evidence for the distinct ship behaviors.

#### Scenario: Fleet acceptance is reported
- **WHEN** the change is proposed for completion
- **THEN** the report includes seven-route quality coverage and cruise, platform, ice and shallow-water cases rather than only a destroyer demo

### Requirement: Fleet completion includes executed dynamic acceptance
Fleet completion SHALL include actual active-route and embedded-consumer runs with dynamic visual evidence and measured hardware context; source-reference tests alone SHALL NOT establish completion.

#### Scenario: The fleet series is reported complete
- **WHEN** the completion report is assembled
- **THEN** it identifies executed vessel scenarios, actual performance results and unresolved acceptance items separately
- **AND** missing hardware or missing runtime evidence is not relabeled as passed

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

