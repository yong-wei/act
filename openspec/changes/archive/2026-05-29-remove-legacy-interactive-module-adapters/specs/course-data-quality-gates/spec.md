## ADDED Requirements

### Requirement: Standard module gates are strict
The course data-quality gate SHALL fail on every unregistered module class, unregistered response kind, or missing compute capability reference in new or migrated lessons.

#### Scenario: Unregistered module fails
- **WHEN** the strict gate scans runtime manifests
- **AND** a module kind is not a canonical module class
- **THEN** the gate SHALL fail with the lesson id, step id, module id, and offending kind.

#### Scenario: Unregistered response fails
- **WHEN** the strict gate scans response-producing activity cards
- **AND** a response kind is not canonical
- **THEN** the gate SHALL fail with the lesson id, step id, card id, and offending response kind.

#### Scenario: Missing compute capability fails
- **WHEN** the strict gate scans a `compute.panel`
- **AND** no registered capability reference is present
- **THEN** the gate SHALL fail unless an explicitly documented historical compatibility exception applies.
