## MODIFIED Requirements

### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and Interactive Learning in stable relative order.
- **AND** Personal Center SHALL NOT be counted as one of the core student module entries.
- **AND** Data Center SHALL NOT be visible as a student core, review, or fallback navigation destination.

#### Scenario: Virtual lab compatibility route is resolved
- **WHEN** simulation navigation is rendered for students or guests
- **THEN** `/simulations` SHALL be the canonical simulation catalog entry.
- **AND** `/virtual-lab` SHALL be treated as a redirect-only compatibility route to `/simulations`, not as a second student navigation destination.
