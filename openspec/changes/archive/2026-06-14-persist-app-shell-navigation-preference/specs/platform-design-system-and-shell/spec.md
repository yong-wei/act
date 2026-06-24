## ADDED Requirements

### Requirement: AppShell desktop navigation defaults to collapsed and persists user preference
The shared AppShell SHALL default eligible desktop navigation to the collapsed rail and persist the user's explicit expanded or collapsed preference across platform pages.

#### Scenario: User opens an eligible desktop route without a stored preference
- **WHEN** a user opens a primary workspace route such as `/knowledge`, `/arena`, `/simulations`, an interactive learning workspace, a teacher workspace, or an administrator workspace at a desktop viewport
- **THEN** the platform navigation SHALL render in the approved collapsed desktop rail by default
- **AND** route navigation SHALL remain reachable through icons, accessible labels, focus order, and active route indication.

#### Scenario: User changes navigation state
- **WHEN** the user expands or collapses the desktop navigation
- **THEN** the chosen state SHALL be persisted as a shell-owned preference
- **AND** subsequent student, teacher, administrator, and workspace AppShell routes SHALL restore that state until the user changes it again.

#### Scenario: Stored preference is missing or invalid
- **WHEN** AppShell cannot read a valid persisted navigation preference
- **THEN** it SHALL fall back to collapsed desktop navigation
- **AND** it SHALL NOT throw, render an invalid rail width, or create an uncontrolled layout state.

#### Scenario: Viewport changes to mobile
- **WHEN** the viewport uses the mobile platform navigation pattern
- **THEN** the persisted desktop rail preference SHALL NOT force a desktop rail into the mobile layout
- **AND** mobile drawer behavior SHALL remain governed by the mobile AppShell contract.
