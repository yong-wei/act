## MODIFIED Requirements

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
