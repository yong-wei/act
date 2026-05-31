## ADDED Requirements

### Requirement: Commercial navigation has three explicit layers
The system SHALL distinguish global product navigation, role cockpit navigation, and contextual workspace navigation.

#### Scenario: A product workspace renders
- **WHEN** Arena, Control Workbench, adaptive learning, interactive learning, teacher, or admin UI renders
- **THEN** it SHALL expose the appropriate contextual navigation without duplicating the full global navigation as a competing primary menu.

### Requirement: Student navigation is grouped by learning intent
The system SHALL support student-facing navigation groups for learn, practice, challenge, experiment, and review/profile intents.

#### Scenario: Student opens a primary entry surface
- **WHEN** a student-visible entry surface renders product destinations
- **THEN** it SHALL group or order entries by learning intent rather than by implementation module names alone.

### Requirement: Profile and cockpit actions have separate semantics
The system SHALL treat profile as an account or learning-record action and cockpit as the role-level operational entry.

#### Scenario: Both actions are available
- **WHEN** a page exposes both profile and cockpit access
- **THEN** the UI SHALL make cockpit the role workspace action and profile the account or record action without presenting both as equivalent primary module entries.

### Requirement: Contextual return targets are route-derived
The system SHALL derive contextual return targets from the current workspace mode and route context.

#### Scenario: Control Workbench opens from Arena
- **WHEN** Control Workbench is opened from an Arena challenge or publication
- **THEN** the return action SHALL target the corresponding Arena context instead of the generic interactive-learning page.

### Requirement: Authentication routes preserve destination intent
The system SHALL preserve callback and role intent through login, authentication error, account, profile, and cockpit entry surfaces.

#### Scenario: Student is redirected to login for profile
- **WHEN** a student opens `/login?callbackUrl=%2Fprofile`
- **THEN** the login surface SHALL preserve `/profile` as the intended destination after successful sign-in
- **AND** it SHALL expose account/profile and role cockpit semantics without presenting them as competing primary product modules.
