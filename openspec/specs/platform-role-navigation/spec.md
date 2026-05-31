## Purpose
Define role-specific platform entrypoints, route compatibility, feature-gated future destinations, and shared cockpit navigation contracts for student, teacher, admin, and unauthenticated surfaces.
## Requirements
### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and Interactive Learning in stable relative order.
- **AND** Personal Center SHALL NOT be counted as one of the core student module entries.

### Requirement: Homepage and student cockpit expose complete core entries
The system SHALL migrate homepage and student cockpit entry surfaces to the unified role-navigation model with a complete core student entry matrix.

#### Scenario: Student opens homepage or dashboard
- **WHEN** a student-visible homepage, `/dashboard`, or cockpit entry surface renders
- **THEN** it SHALL expose the configured student core entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and Interactive Learning in stable relative order
- **AND** mobile layouts at 320px SHALL provide drawer or menu access to the same visible entries without dead links.
- **AND** the Interactive Learning entry SHALL target `/interactive-learning`.

### Requirement: Auth and profile entrypoints reuse shared navigation surfaces
The system SHALL keep login, role redirects, and profile/cockpit actions consistent with the unified role-navigation model.

#### Scenario: User signs in or opens profile
- **WHEN** `/login`, an embedded login surface, `/profile`, or an account menu profile action is opened during migration
- **THEN** the UI SHALL reuse the shared auth/profile entry contracts and return users to role-appropriate `/dashboard`, `/teacher`, or `/admin` cockpit destinations without duplicating page-local navigation.
- **AND** `/profile` SHALL remain reachable through account, cockpit, or profile-specific surfaces even though it is not a core student module entry.

### Requirement: Future destinations are feature-flagged
The system SHALL represent unavailable future destinations with explicit feature-flag metadata.

#### Scenario: Backing feature is not implemented
- **WHEN** a navigation entry depends on a future ResourceNode, adaptive path, Konling, governance, or experiment capability
- **THEN** the navigation schema SHALL either hide the entry or render a disabled state according to product configuration rather than linking to an incomplete route.

### Requirement: Role cockpit routing stays compatible
The system SHALL preserve role cockpit redirects and existing route aliases while unified navigation is introduced.

#### Scenario: Authenticated user opens cockpit action
- **WHEN** an authenticated user uses the cockpit action from any unified shell page
- **THEN** the user SHALL be routed to `/dashboard`, `/teacher`, or `/admin` according to their role.

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

### Requirement: Student intent groups drive commercial entry surfaces
The platform SHALL expose student destinations through the learning-intent groups learn, practice, challenge, experiment, review, and account/profile.

#### Scenario: Homepage or student cockpit renders commercial entries
- **WHEN** homepage or student cockpit renders primary product destinations
- **THEN** the visible grouping or ordering SHALL follow student intent groups
- **AND** implementation module names SHALL NOT be the only hierarchy used to organize the page.

### Requirement: Navigation coverage is testable
The system SHALL provide tests or script checks that verify central navigation coverage for commercial student intent groups, core destinations, account/profile semantics, and route aliases.

#### Scenario: Navigation schema changes
- **WHEN** the central navigation schema is changed
- **THEN** tests SHALL verify that learn, practice, challenge, experiment, review, and account/profile intents remain represented where required
- **AND** Interactive Learning, Arena, Control Workbench, adaptive learning, knowledge/resource workspace, simulations, and profile/cockpit access remain reachable according to route configuration.

