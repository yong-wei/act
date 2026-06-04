## ADDED Requirements

### Requirement: Navigation layers are explicit and non-competing
The system SHALL distinguish global product navigation, role cockpit navigation, contextual workspace navigation, and local tool navigation.

#### Scenario: A primary page renders navigation
- **WHEN** homepage, login, Interactive Learning, simulation hub, Control Workbench, Arena, adaptive learning, profile, teacher, admin, or knowledge graph renders
- **THEN** the page SHALL expose only the navigation layers relevant to its context
- **AND** local tool tabs, role cockpit links, and global product destinations SHALL NOT be presented as one undifferentiated menu.

### Requirement: Route inventory governs shell and navigation decisions
The system SHALL maintain an inventory of representative routes and their expected shell, navigation layers, role scope, and floating dock behavior.

#### Scenario: A route changes shell or navigation
- **WHEN** a primary route changes its header, sidebar, breadcrumb, cockpit action, contextual return action, or floating dock behavior
- **THEN** the change SHALL update or satisfy the route inventory
- **AND** route aliases and authentication callback destinations SHALL remain compatible.
