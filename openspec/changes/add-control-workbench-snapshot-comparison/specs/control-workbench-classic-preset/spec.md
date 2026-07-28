## ADDED Requirements

### Requirement: Classic preset exposes design snapshot comparison
The classic four-view preset SHALL expose session-scoped design snapshot management for compatible free-explore and Arena-bound contexts. It SHALL preserve the existing real-time single-design workflow when no snapshot is saved or visible.

#### Scenario: Classic preset loads without snapshots
- **WHEN** a student opens a compatible classic four-view workbench with no saved snapshots
- **THEN** the preset SHALL render the existing single-design editing and analysis workflow
- **AND** it SHALL not require the student to create or select a snapshot.

#### Scenario: Incompatible context remains rejected
- **WHEN** a workbench context cannot render the classic four-view preset
- **THEN** the preset SHALL continue to show its existing incompatible-workbench state
- **AND** it SHALL NOT expose snapshot comparison for unavailable transfer-function analysis.
