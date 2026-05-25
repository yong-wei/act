## ADDED Requirements

### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and profile in stable relative order.

### Requirement: Homepage and student cockpit expose complete core entries
The system SHALL migrate homepage and student cockpit entry surfaces to the unified role-navigation model with a complete core student entry matrix.

#### Scenario: Student opens homepage or dashboard
- **WHEN** a student-visible homepage, `/dashboard`, or cockpit entry surface renders
- **THEN** it SHALL expose the configured student core entries for simulations, knowledge/resource workspace, Arena, Control Workbench, adaptive learning, and profile/cockpit actions in stable relative order
- **AND** mobile layouts at 320px SHALL provide drawer or menu access to the same visible entries without dead links.

### Requirement: Auth and profile entrypoints reuse shared navigation surfaces
The system SHALL keep login, role redirects, and profile/cockpit actions consistent with the unified role-navigation model.

#### Scenario: User signs in or opens profile
- **WHEN** `/login`, an embedded login surface, or `/profile` is opened during migration
- **THEN** the UI SHALL reuse the shared auth/profile entry contracts and return users to role-appropriate `/dashboard`, `/teacher`, or `/admin` cockpit destinations without duplicating page-local navigation.

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
