## ADDED Requirements

### Requirement: Brand application kit is required before page migration
The platform SHALL provide a brand application kit for commercial UI migrations.

#### Scenario: Downstream UI migration starts
- **WHEN** a downstream route family migration begins
- **THEN** the migration SHALL have access to approved app mark, logo lockup, route badge, course badge, Arena badge, workbench chrome, evidence snapshot, governance snapshot, and report watermark references
- **AND** each reference SHALL state light and dark theme behavior.

### Requirement: Iconography and assets have one governed language
The platform SHALL define icon family, stroke, optical size, texture, and visual asset rules for commercial surfaces.

#### Scenario: A route adds icons or imagery
- **WHEN** navigation, command, status, badge, report, course, Arena, or workspace assets are introduced
- **THEN** they SHALL follow the governed brand asset rules
- **AND** they SHALL NOT mix generic developer-tool icon language, unrelated clipart, or decorative assets without a route or evidence role.

### Requirement: Brand typography and numeric language are governed
The platform SHALL define typography and numeric readout rules for premium learning, instrument, evidence, operations, and report surfaces.

#### Scenario: A redesigned route renders headings, metrics, or evidence labels
- **WHEN** a public, student, workspace, knowledge/data, teacher, admin, or report surface displays headings, numeric values, status labels, or evidence provenance
- **THEN** typography, weight, spacing, tabular numbers, and label treatments SHALL follow the brand application kit
- **AND** metrics or labels SHALL NOT appear as generic dashboard card copy disconnected from task, source, confidence, or next action.
