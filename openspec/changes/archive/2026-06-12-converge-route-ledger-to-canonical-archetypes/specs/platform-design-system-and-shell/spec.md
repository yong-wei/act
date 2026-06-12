## ADDED Requirements

### Requirement: Shell migration ownership is declared before implementation
The platform design system SHALL require primary shell migrations to be owned through the central route ledger before route components are changed.

#### Scenario: AppShell migration begins
- **WHEN** a primary route is prepared for AppShell, workspace shell, or local shell retirement work
- **THEN** the route ledger SHALL identify archetype, owning change, legacy shell disposition, theme support, dock behavior, and visual QA profile
- **AND** the implementation SHALL not create page-local shell ownership outside the ledger.
