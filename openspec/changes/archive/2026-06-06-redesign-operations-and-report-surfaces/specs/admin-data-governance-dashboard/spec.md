## ADDED Requirements

### Requirement: Admin governance surfaces use action-oriented risk hierarchy
The admin data governance dashboard SHALL present governance risks, pending checks, source freshness, and repair actions through an action-oriented hierarchy.

#### Scenario: Admin governance renders
- **WHEN** `/admin/data-governance` or related governance dashboard surfaces render
- **THEN** critical risks, stale sources, pending jobs, and repair actions SHALL be visually prioritized
- **AND** metrics SHALL not appear as disconnected decorative cards without action context.

### Requirement: Admin governance connects configuration, source quality, repair, and redacted output
The admin governance UI SHALL connect system/user changes to governance status, repair actions, and privacy-safe outputs.

#### Scenario: Governance state requires attention
- **WHEN** user import, role permission, system configuration, source coverage, session data quality, or privacy scope affects governance status
- **THEN** the UI SHALL show affected object, freshness or quality state, repair or review action, restricted-state explanation, and redacted report/export availability where applicable
- **AND** governance status SHALL NOT be presented as decorative metrics without an actionable path.
