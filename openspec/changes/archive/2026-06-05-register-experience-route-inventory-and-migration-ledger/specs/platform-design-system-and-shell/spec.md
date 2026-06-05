## ADDED Requirements

### Requirement: Shell migration ledger tracks legacy retirement
The design system SHALL maintain a migration ledger for shell adoption and legacy shell retirement.

#### Scenario: Legacy shell is retained during redesign
- **WHEN** a route keeps a legacy shell, topbar, sidebar, breadcrumb, or fixed-control system
- **THEN** the ledger SHALL record whether it is adapted, retained temporarily, or scheduled for replacement
- **AND** it SHALL name the owning change and removal condition.
