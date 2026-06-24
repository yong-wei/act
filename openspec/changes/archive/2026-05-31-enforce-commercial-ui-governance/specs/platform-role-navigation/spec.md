## ADDED Requirements

### Requirement: Navigation coverage is testable
The system SHALL provide tests or script checks that verify central navigation coverage for commercial student intent groups, core destinations, account/profile semantics, and route aliases.

#### Scenario: Navigation schema changes
- **WHEN** the central navigation schema is changed
- **THEN** tests SHALL verify that learn, practice, challenge, experiment, review, and account/profile intents remain represented where required
- **AND** Interactive Learning, Arena, Control Workbench, adaptive learning, knowledge/resource workspace, simulations, and profile/cockpit access remain reachable according to route configuration.
