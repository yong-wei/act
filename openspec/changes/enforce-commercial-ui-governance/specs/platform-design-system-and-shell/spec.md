## ADDED Requirements

### Requirement: Platform token use is enforceable
The system SHALL provide source-level checks that enforce approved platform and commercial brand token usage for new or migrated UI surfaces.

#### Scenario: New UI bypasses approved tokens
- **WHEN** a new or migrated page, shell, panel, or shared component introduces direct visual styling that duplicates platform token roles
- **THEN** the check SHALL fail or report the bypass according to governance mode
- **AND** the code SHALL either use approved tokens or register a justified design-system addition.

### Requirement: Shell retirement is tracked by route inventory
The system SHALL maintain a route and shell inventory for primary platform surfaces and track legacy-shell retirement through migration references.

#### Scenario: A legacy shell remains after commercial migration
- **WHEN** a migrated route still uses a legacy shell component
- **THEN** the inventory SHALL identify whether that shell is intentionally retained, adapted, or scheduled for removal
- **AND** undocumented shell duplication SHALL fail or be reported by governance mode.
